# pico_monitor.py — Pico 시리얼 모니터 (Windows 11 · Python 3.9 이상)
#
#   Pico 에 넣은 점검 코드(code.py = code_hardware_selftest.py)가 USB 로 보내는 글자를 받아서
#     ① USB 시리얼 포트 연결   ② 출력 그대로 보기
#     ③ CircuitPython 라이브러리 정상 여부   ④ 센서 · 액추에이터 상태
#   를 한 화면에 보여 줍니다.
#
#   실행: 이 폴더의 run_monitor.bat 을 더블클릭하거나,  py pico_monitor.py
#   필요한 것: tkinter(파이썬에 기본 포함) + pyserial
#     pyserial 이 설치돼 있지 않으면 같은 폴더의 pyserial-*.whl 파일을 그대로 불러 씁니다.
#     (pip install 이 막힌 컴퓨터에서도 설치 없이 돕니다)
#
#   구조
#     PicoParser   : 받은 글자 한 줄을 읽고 「지금 Pico 상태」를 갱신합니다 (화면과 무관, 순수 파이썬)
#     SerialWorker : 별도 스레드에서 포트를 열고 읽습니다. 뽑혔다 다시 꽂히면 저절로 다시 연결합니다
#     summarize    : 상태를 「한 줄 판정 + 점검표 8칸」으로 바꿉니다 (화면과 무관)
#     MonitorApp   : tkinter 화면 (밝은 테마). 0.05초마다 받은 것을 꺼내 그립니다

import codecs
import collections
import datetime
import math
import os
import queue
import re
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))

# ── pyserial 불러오기 (없으면 옆의 .whl 을 그대로 씀 — 휠은 zip 이라 파이썬이 바로 읽습니다) ──
try:
    import serial
    from serial.tools import list_ports
except ImportError:
    for name in sorted(os.listdir(HERE)):
        if name.startswith("pyserial") and name.endswith(".whl"):
            sys.path.insert(0, os.path.join(HERE, name))
    try:
        import serial
        from serial.tools import list_ports
    except ImportError:
        serial = None

import tkinter as tk
from tkinter import filedialog, messagebox, ttk


# ════════════════════════════════════════════════════════════════════════
#  ① PicoParser — 한 줄씩 읽어 상태를 갱신 (화면 코드 없음)
# ════════════════════════════════════════════════════════════════════════

# 점검 코드가 쓰는 라이브러리 (code_hardware_selftest.py 의 import 와 같아야 합니다)
LIBS = ["adafruit_dht", "adafruit_motor"]
# 「라이브러리 직접 검사」 때 함께 확인하는 내장 모듈
BUILTINS = ["board", "analogio", "digitalio", "pwmio", "pulseio"]

RE_BANNER = re.compile(r"Adafruit CircuitPython (\S+?) on [^;]*; (.+?) with (\S+)")
RE_VERSION = re.compile(r"\b(\d+\.\d+\.\d+(?:-[\w.]+)?)\b")
RE_ROUND = re.compile(r"=+\s*점검\s*(\d+)\s*회차")
RE_SENSOR = re.compile(r"\[센서\]\s*(온도|습도|조도)\s+(---|-?[\d.]+)")
RE_MARK = re.compile(r"\[(OK|경고|실패)\]\s*(.*)$")
RE_RAW = re.compile(r"raw=\s*(\d+)")
RE_SERVO = re.compile(r"\[서보\]\s*(\d+)°\s*도착\s*->\s*LED\s*(\S+)")
RE_NO_MODULE = re.compile(r"no module named '?([\w.]+)'?", re.IGNORECASE)   # CircuitPython 은 소문자 「no」
RE_ERROR_END = re.compile(r"^\s*(\w+(Error|Exception|Interrupt))\b:?(.*)$")
RE_PROBE_FW = re.compile(r"^@@FW\s+(\S+)\s*\|\s*(.+)$")
RE_PROBE_LIB = re.compile(r"^@@LIB\s+(\S+)\s+(OK|FAIL)\s*(.*)$")

SENSOR_KEY = {"온도": "temp", "습도": "humi", "조도": "light"}
SENSOR_UNIT = {"temp": "℃", "humi": "%", "light": "%"}


class PicoParser:
    """Pico 가 보낸 줄을 읽어 상태(dict)를 만듭니다. 화면과 상관없어서 따로 시험할 수 있습니다."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.firmware = None        # "10.2.1"
        self.board = None           # "Raspberry Pi Pico 2 W"
        self.chip = None            # "rp2350a"
        self.code_state = "unknown"  # running / stopped / error / repl / unknown
        self.round = 0
        # 라이브러리: None = 아직 모름, True = 정상, 문자열 = 문제 설명
        self.libs = {name: None for name in LIBS}
        self.builtins = {name: None for name in BUILTINS}
        self.lib_note = ""
        # 센서: {"value": float|None, "mark": "OK"/"경고"/"실패", "text": 안내, "raw": int|None}
        self.sensors = {"temp": None, "humi": None, "light": None}
        self.servo = None           # 각도 (int)
        self.led = None             # "빨강"/"초록"/"파랑"/"꺼짐"
        self.arrivals = 0           # 이번 회차에 서보가 도착한 횟수 (0~5) — 순서 점 표시용
        # 추세선용: 센서마다 최근 30개 실제 값
        self.history = {k: collections.deque(maxlen=30) for k in ("temp", "humi", "light")}
        self.last_error = ""
        self._in_traceback = False
        self.probe_done = False

    # 터미널 제목(OSC) — CircuitPython 은 「code.py | 10.2.1」 같은 상태 줄을 제목으로 보냅니다
    def feed_title(self, title):
        m = RE_VERSION.search(title)
        if m and not self.firmware:
            self.firmware = m.group(1)
        if "Done" in title:
            self.code_state = "stopped" if self.code_state != "error" else "error"
        elif "REPL" in title:
            self.code_state = "repl"
        elif "code.py" in title and self.code_state in ("unknown", "stopped"):
            self.code_state = "running"

    def feed(self, line):
        """한 줄을 읽고, 이 줄의 종류("ok"/"warn"/"fail"/"error"/"info"/"")를 돌려줍니다 (화면 색칠용)."""
        s = line.strip()
        if not s:
            return ""

        # ── 「라이브러리 직접 검사」의 응답 ──
        m = RE_PROBE_FW.match(s)
        if m:
            self.firmware = m.group(1)
            board = m.group(2).strip()
            if " with " in board:
                board, self.chip = board.rsplit(" with ", 1)
            self.board = board
            return "info"
        m = RE_PROBE_LIB.match(s)
        if m:
            name, ok, detail = m.group(1), m.group(2) == "OK", m.group(3).strip()
            base = name.split(".")[0]
            target = self.libs if base in self.libs else self.builtins
            target[base] = True if ok else self._explain_lib_error(detail)
            return "ok" if ok else "fail"
        if s == "@@END":
            self.probe_done = True
            return "info"

        # ── 펌웨어 · 실행 상태 ──
        m = RE_BANNER.search(s)
        if m:
            self.firmware, self.board, self.chip = m.group(1), m.group(2), m.group(3)
            self.code_state = "repl"
            return "info"
        if s.startswith("code.py output:") or s.startswith("main.py output:"):
            self.code_state = "running"
            self.last_error = ""
            return "info"
        if s.startswith("Code done running"):
            if self.code_state != "error":
                self.code_state = "stopped"
            return "info"
        if s.startswith(">>>"):
            self.code_state = "repl"
            return ""

        # ── 오류 (Traceback 다음 줄들 중 「…Error: 설명」 줄을 기억) ──
        if s.startswith("Traceback"):
            self._in_traceback = True
            return "error"
        if self._in_traceback:
            m = RE_ERROR_END.match(s)
            if m:
                self._in_traceback = False
                self.last_error = s
                if m.group(1) != "KeyboardInterrupt":
                    self.code_state = "error"
                self._lib_from_error(s)
            return "error"
        if "Incompatible .mpy" in s:
            self._lib_version_mismatch()
            return "fail"

        # ── 점검 코드(code_hardware_selftest.py) 가 찍는 줄 ──
        if s.startswith("[준비]"):
            m = RE_NO_MODULE.search(s)
            if m:
                self._lib_missing(m.group(1))
            return "fail"
        m = RE_ROUND.search(s)
        if m:
            self.round = int(m.group(1))
            self.arrivals = 0
            self.code_state = "running"
            # 회차가 시작됐다 = import 가 모두 성공했다 = 라이브러리 정상
            for k in self.libs:
                self.libs[k] = True
            self.lib_note = ""
            return "info"
        m = RE_SENSOR.search(s)
        if m:
            key = SENSOR_KEY[m.group(1)]
            value = None if m.group(2) == "---" else float(m.group(2))
            mk = RE_MARK.search(s)
            mark = mk.group(1) if mk else ("실패" if value is None else "")
            text = mk.group(2).strip() if mk else ""
            raw = RE_RAW.search(s)
            self.sensors[key] = {"value": value, "mark": mark, "text": text,
                                 "raw": int(raw.group(1)) if raw else None}
            if value is not None:
                self.history[key].append(value)
            return {"OK": "ok", "경고": "warn", "실패": "fail"}.get(mark, "")
        m = RE_SERVO.search(s)
        if m:
            self.servo = int(m.group(1))
            self.led = m.group(2)
            self.arrivals += 1
            return "ok"
        if s.startswith("[서보] 시작 위치"):
            self.servo, self.led = 90, "초록"
            return ""
        if s.startswith("LED 끔"):
            self.led = "꺼짐"
            return "info"
        if "재시도" in s:
            return "warn"
        return ""

    def _lib_missing(self, module):
        base = module.split(".")[0]
        if base in self.libs:
            self.libs[base] = "lib/ 에 없음"
            self.lib_note = "CircuitPython 번들에서 adafruit_dht.mpy 와 adafruit_motor 폴더를 CIRCUITPY/lib/ 에 복사하세요"

    def _lib_from_error(self, s):
        m = RE_NO_MODULE.search(s)
        if m:
            self._lib_missing(m.group(1))
        if "Incompatible .mpy" in s:
            self._lib_version_mismatch()

    def _lib_version_mismatch(self):
        self.lib_note = "라이브러리 버전이 펌웨어와 다릅니다 — 펌웨어와 같은 주 버전(예: 10.x) 번들에서 다시 복사하세요"
        for k in self.libs:
            if self.libs[k] is not True:
                self.libs[k] = "버전 불일치?"

    @staticmethod
    def _explain_lib_error(detail):
        if "no module named" in detail.lower() or "ImportError" in detail:
            return "lib/ 에 없음"
        if "Incompatible" in detail or "mpy" in detail:
            return "버전 불일치"
        return detail[:40] or "불러오기 실패"


# ════════════════════════════════════════════════════════════════════════
#  ② SerialWorker — 포트 열기 · 읽기 · 자동 재연결 (별도 스레드)
# ════════════════════════════════════════════════════════════════════════

RE_OSC = re.compile(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")   # 터미널 제목 (상태 줄)
RE_CSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")             # 커서 · 색 제어


def find_ports():
    """[(장치명, 화면에 보일 이름, Pico 같은가)] — Pico 처럼 보이는 포트를 앞에 둡니다."""
    if serial is None:
        return []
    result = []
    for p in list_ports.comports():
        text = " ".join(str(x) for x in (p.description, p.product, p.manufacturer, p.interface) if x)
        low = text.lower()
        is_pico = (p.vid in (0x239A, 0x2E8A)) or "circuitpython" in low or "pico" in low
        if p.interface and "data" in p.interface.lower():
            is_pico = False          # CircuitPython 의 두 번째(데이터) 포트는 출력이 안 나옵니다
        label = p.device + (" — Pico (CircuitPython)" if is_pico else f" — {p.description}")
        result.append((p.device, label, is_pico))
    result.sort(key=lambda r: (not r[2], r[0]))
    return result


class SerialWorker(threading.Thread):
    """포트를 읽어 queue 로 넘깁니다. 화면(tkinter)은 다른 스레드에서 건드리면 안 되므로
    여기서는 queue 에 넣기만 하고, 그리는 일은 MonitorApp 이 합니다."""

    def __init__(self, port, out_queue):
        super().__init__(daemon=True)
        self.port = port
        self.q = out_queue
        self.ser = None
        self.stop_event = threading.Event()
        self.write_lock = threading.Lock()
        self.decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self.buffer = ""
        self.last_data = time.monotonic()

    def run(self):
        announced_wait = False
        while not self.stop_event.is_set():
            if self.ser is None:
                try:
                    # Pico 의 USB 시리얼은 속도를 무시하지만 관례대로 115200 을 줍니다
                    self.ser = serial.Serial(self.port, 115200, timeout=0.1)
                    self.q.put(("status", "connected", self.port))
                    announced_wait = False
                except Exception as e:   # 포트가 없거나 다른 프로그램이 쓰는 중
                    if not announced_wait:
                        self.q.put(("status", "waiting", self._why(e)))
                        announced_wait = True
                    self.stop_event.wait(1.0)
                    continue
            try:
                data = self.ser.read(self.ser.in_waiting or 1)
            except Exception:
                self._close()
                self.q.put(("status", "lost", "USB 가 빠졌습니다 — 다시 꽂으면 저절로 연결합니다"))
                announced_wait = True
                continue
            if data:
                self.last_data = time.monotonic()
                self._handle_text(self.decoder.decode(data))
            elif self.buffer and time.monotonic() - self.last_data > 0.3:
                # 줄바꿈 없이 끝난 글자(예: REPL 의 「>>> 」)도 잠시 뒤에 보여 줍니다
                self.q.put(("line", self.buffer))
                self.buffer = ""
        self._close()

    def _handle_text(self, text):
        self.buffer += text
        for title in RE_OSC.findall(self.buffer):
            self.q.put(("title", title[2:].rstrip("\x07\x1b\\")))
        self.buffer = RE_CSI.sub("", RE_OSC.sub("", self.buffer))
        if "\x1b" in self.buffer and len(self.buffer) < 300:
            # 제어 문자열이 아직 다 안 왔으면 줄 자르기를 잠시 미룹니다
            head, sep, tail = self.buffer.rpartition("\n")
            if "\x1b" in tail:
                for ln in head.split("\n") if sep else []:
                    self.q.put(("line", ln.replace("\r", "")))
                self.buffer = tail
                return
        *lines, self.buffer = self.buffer.split("\n")
        for ln in lines:
            self.q.put(("line", ln.replace("\r", "")))

    def write(self, data):
        with self.write_lock:
            if self.ser is not None:
                try:
                    self.ser.write(data)
                    return True
                except Exception:
                    pass
        return False

    def stop(self):
        self.stop_event.set()

    def _close(self):
        if self.ser is not None:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None

    @staticmethod
    def _why(e):
        msg = str(e)
        if "PermissionError" in msg or "Access is denied" in msg or "액세스" in msg or "busy" in msg.lower():
            return "다른 프로그램이 이 포트를 쓰는 중입니다 (Thonny · Mu · 다른 모니터 창을 닫으세요)"
        if "FileNotFoundError" in msg or "could not open" in msg or "No such file" in msg:
            return "Pico 를 기다리는 중… (USB 를 꽂으면 저절로 연결합니다)"
        return msg[:80]


# ════════════════════════════════════════════════════════════════════════
#  ③ summarize — 지금 상태를 「한 줄 판정 + 점검표 8칸」으로 (화면과 무관, 따로 시험 가능)
# ════════════════════════════════════════════════════════════════════════

CHIPS = ["연결", "코드", "라이브러리", "온도", "습도", "조도", "서보", "LED"]
SENSOR_LABEL = {"temp": "온도", "humi": "습도", "light": "조도"}
MARK_LEVEL = {"OK": "ok", "경고": "warn", "실패": "fail"}
QUIET_SECONDS = 10      # 이만큼 아무 글자도 안 오면 「출력이 멈췄다」고 알립니다


def summarize(p, link, quiet=False, link_msg=""):
    """(단계, 제목, 할 일, {칸 이름: 단계}) 를 돌려줍니다.
    단계: ok(초록) · warn(호박) · fail(빨강) · idle(회색).  link: none / waiting / lost / connected"""
    chips = dict.fromkeys(CHIPS, "idle")
    chips["연결"] = {"connected": "ok", "waiting": "warn", "lost": "warn"}.get(link, "idle")
    chips["코드"] = {"running": "ok", "stopped": "warn", "repl": "warn", "error": "fail"}.get(p.code_state, "idle")
    libs = list(p.libs.values())
    if any(isinstance(v, str) for v in libs):
        chips["라이브러리"] = "fail"
    elif all(v is True for v in libs):
        chips["라이브러리"] = "ok"
    for key, label in SENSOR_LABEL.items():
        s = p.sensors[key]
        if s:
            chips[label] = MARK_LEVEL.get(s["mark"], "idle")
    if p.servo is not None:
        chips["서보"] = "ok"
    if p.led in ("빨강", "초록", "파랑") or (p.led == "꺼짐" and p.servo is not None):
        chips["LED"] = "ok"      # 멈출 때 점검 코드가 LED 를 끄므로, 색이 바뀌는 걸 이미 봤다면 정상
    if quiet and chips["코드"] == "ok":
        chips["코드"] = "warn"

    # ── 가장 중요한 것 하나만, 할 일과 함께 ──
    if link == "none":
        return "idle", "Pico 에 연결하세요", "USB 로 Pico 를 꽂고 → 위에서 포트를 고른 뒤 → 「연결」을 누르세요.", chips
    if link in ("waiting", "lost"):
        return "warn", "Pico 를 기다리는 중", link_msg or "USB 를 꽂으면 저절로 연결합니다.", chips
    bad_libs = [k for k, v in p.libs.items() if isinstance(v, str)]
    if bad_libs:
        return ("fail", "라이브러리 문제 — " + ", ".join(f"{k}: {p.libs[k]}" for k in bad_libs),
                p.lib_note or "CIRCUITPY/lib/ 에 라이브러리를 복사하세요.", chips)
    if p.code_state == "error":
        return ("fail", "코드가 오류로 멈췄습니다",
                (p.last_error + " — " if p.last_error else "") + "아래 빨간 줄을 확인하고 code.py 를 고쳐 저장하세요.", chips)
    if p.code_state in ("stopped", "repl"):
        return "warn", "점검 코드가 멈춰 있습니다", "「다시 시작」을 누르면 code.py 를 처음부터 다시 실행합니다.", chips
    if quiet:
        return ("fail", f"출력이 {QUIET_SECONDS}초 넘게 없습니다",
                "Pico 가 멈췄거나 리셋됐을 수 있습니다. 내장 LED 가 깜빡이는지 보고 「다시 시작」을 누르세요.", chips)
    if p.round == 0:
        return "idle", "점검 결과를 기다리는 중…", "한 바퀴에 약 15초 걸립니다. 계속 비어 있으면 「다시 시작」을 누르세요.", chips
    for level, word in (("fail", "문제"), ("warn", "주의")):
        keys = [k for k, lab in SENSOR_LABEL.items() if chips[lab] == level]
        if keys:
            names = " · ".join(SENSOR_LABEL[k] for k in keys)
            action = next((p.sensors[k]["text"] for k in keys if p.sensors[k]["text"]), "")
            return level, f"{word} {len(keys)}개 — {names}", action or "시리얼 출력의 해당 줄을 확인하세요.", chips
    return "ok", f"모두 정상 ✓  ({p.round}회차)", "센서 값이 맞는지, 서보 · LED 가 순서대로 움직이는지 눈으로도 확인하세요.", chips


# ════════════════════════════════════════════════════════════════════════
#  ④ 화면 부품 — 평평한 버튼 · 툴팁 · 추세선
# ════════════════════════════════════════════════════════════════════════

# 밝은 테마 — 색은 상태에만 씁니다 (그라데이션 · 장식 색 없음)
C_BG, C_CARD, C_LINE = "#F5F6F8", "#FFFFFF", "#E2E5EA"
C_TEXT, C_SUB, C_FAINT = "#16181D", "#5B616E", "#8A909C"
LEVEL_FG = {"ok": "#1A7F37", "warn": "#9A6700", "fail": "#C62828", "idle": "#8A909C"}
LEVEL_BG = {"ok": "#E8F5EC", "warn": "#FFF4D6", "fail": "#FDECEC", "idle": "#EEF0F3"}
LEVEL_ICON = {"ok": "✔", "warn": "!", "fail": "✖", "idle": "…"}
LED_COLOR = {"빨강": "#E5484D", "초록": "#30A46C", "파랑": "#3E63DD"}
SERVO_STEPS = [90, 180, 90, 0, 90]          # 점검 코드의 순서와 같아야 합니다
MAX_LOG_LINES = 3000
# 「점검 줄만」 보기에서 남길 줄
CHECK_PREFIX = ("[센서]", "[서보]", "====", "[준비]", "Traceback", "[모니터]")


def pick_font(candidates, fallback):
    from tkinter import font as tkfont
    have = set(tkfont.families())
    for name in candidates:
        if name in have:
            return name
    return fallback


class FlatButton(tk.Label):
    """ttk 기본 버튼 대신 쓰는 평평한 버튼. kind = primary(검정) / secondary(흰 바탕+테두리)."""

    STYLES = {
        "primary": dict(bg="#16181D", fg="#FFFFFF", hover="#2E323A", border="#16181D"),
        "secondary": dict(bg="#FFFFFF", fg="#16181D", hover="#F0F2F5", border="#D3D7DE"),
    }

    def __init__(self, parent, text, command, kind="secondary", font=None, tip=None, padx=12, pady=5):
        st = self.STYLES[kind]
        super().__init__(parent, text=text, bg=st["bg"], fg=st["fg"], font=font, padx=padx, pady=pady,
                         cursor="hand2", highlightthickness=1, highlightbackground=st["border"],
                         highlightcolor=st["border"])
        self._st, self._cmd, self._disabled = st, command, False
        self.bind("<Enter>", lambda e: self._paint(hover=True))
        self.bind("<Leave>", lambda e: self._paint())
        self.bind("<ButtonRelease-1>", self._click)
        if tip:
            Tooltip(self, tip)

    def _paint(self, hover=False):
        if self._disabled:
            self.configure(bg="#F0F2F5", fg="#A3A9B3", cursor="arrow")
        else:
            self.configure(bg=self._st["hover"] if hover else self._st["bg"], fg=self._st["fg"], cursor="hand2")

    def _click(self, _e):
        if not self._disabled and self._cmd:
            self._cmd()

    def set_text(self, text):
        self.configure(text=text)

    def state(self, spec=None):
        """ttk 버튼과 같은 모양으로 씁니다: state(["disabled"]) · state(["!disabled"]) · state()"""
        if spec:
            for s in spec:
                if s == "disabled":
                    self._disabled = True
                elif s == "!disabled":
                    self._disabled = False
            self._paint()
        return ("disabled",) if self._disabled else ()


class Tooltip:
    """마우스를 0.5초 올려 두면 한 줄 설명을 띄웁니다."""

    def __init__(self, widget, text):
        self.widget, self.text, self.win, self.job = widget, text, None, None
        widget.bind("<Enter>", self._schedule, add="+")
        widget.bind("<Leave>", self._hide, add="+")
        widget.bind("<ButtonPress>", self._hide, add="+")

    def _schedule(self, _e):
        self.job = self.widget.after(500, self._show)

    def _show(self):
        if self.win:
            return
        x = self.widget.winfo_rootx()
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 4
        self.win = tk.Toplevel(self.widget)
        self.win.wm_overrideredirect(True)
        self.win.wm_geometry(f"+{x}+{y}")
        tk.Label(self.win, text=self.text, bg="#16181D", fg="#FFFFFF", padx=8, pady=4,
                 font=(FONT_UI, 9), wraplength=320, justify="left").pack()

    def _hide(self, _e=None):
        if self.job:
            self.widget.after_cancel(self.job)
            self.job = None
        if self.win:
            self.win.destroy()
            self.win = None


def draw_sparkline(canvas, values, color):
    """최근 값들을 작은 꺾은선으로 그립니다 (값이 1개면 점 하나)."""
    canvas.delete("all")
    w, h = int(canvas["width"]), int(canvas["height"])
    vals = list(values)
    if not vals:
        canvas.create_line(2, h - 3, w - 2, h - 3, fill=C_LINE)
        return
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1.0
    n = len(vals)
    pts = []
    for i, v in enumerate(vals):
        x = 3 + (w - 6) * (i / (n - 1) if n > 1 else 1)
        y = h - 4 - (h - 8) * ((v - lo) / span if hi != lo else 0.5)
        pts += [x, y]
    if n > 1:
        canvas.create_line(*pts, fill=color, width=2, smooth=False)
    canvas.create_oval(pts[-2] - 3, pts[-1] - 3, pts[-2] + 3, pts[-1] + 3, fill=color, outline="")


# ════════════════════════════════════════════════════════════════════════
#  ⑤ MonitorApp — tkinter 화면
# ════════════════════════════════════════════════════════════════════════

FONT_UI = "TkDefaultFont"      # 실제 이름은 창을 만든 뒤 pick_font 로 정합니다
FONT_MONO = "TkFixedFont"


class MonitorApp:
    def __init__(self, root, auto_port=None):
        global FONT_UI, FONT_MONO
        FONT_UI = pick_font(["Malgun Gothic", "맑은 고딕", "Noto Sans CJK KR", "NanumGothic"], "TkDefaultFont")
        FONT_MONO = pick_font(["Consolas", "D2Coding", "NanumGothicCoding", "DejaVu Sans Mono"], "TkFixedFont")
        self.f = {
            "title": (FONT_UI, 13, "bold"), "b": (FONT_UI, 10, "bold"), "n": (FONT_UI, 10),
            "s": (FONT_UI, 9), "verdict": (FONT_UI, 13, "bold"), "icon": (FONT_UI, 16, "bold"),
            "big": (FONT_UI, 20, "bold"), "mono": (FONT_MONO, 10),
        }
        self.root = root
        self.q = queue.Queue()
        self.worker = None
        self.parser = PicoParser()
        self.last_rx = None
        self.connected = False
        self.link = "none"          # none / waiting / lost / connected
        self.link_msg = ""
        self.probe = None           # 「라이브러리 직접 검사」 · 「다시 시작」 진행 상태
        self.auto_port = auto_port
        self.ports = []

        root.title("Pico 시리얼 모니터")
        root.configure(bg=C_BG)
        root.minsize(900, 560)
        if sys.platform == "win32":
            root.state("zoomed")          # 최대화 — 노트북 화면 크기·배율과 상관없이 다 보이게
        else:
            w = min(1200, root.winfo_screenwidth() - 40)
            h = min(720, root.winfo_screenheight() - 80)
            root.geometry(f"{w}x{h}")
        self._style()
        self._build_header()
        self._build_statusbar()            # 맨 아래를 먼저 잡아 두어야 로그가 남은 높이를 다 씁니다
        main = tk.Frame(root, bg=C_BG)
        main.pack(fill="both", expand=True, padx=14, pady=(10, 0))
        self._build_verdict(main)
        self._build_chips(main)
        self._build_strip(main)
        self._build_log(main)

        root.bind("<F5>", lambda e: self.refresh_ports())
        root.bind("<Control-l>", lambda e: self.clear_log())
        self.refresh_ports()
        if auto_port:
            self.port_var.set(auto_port)
            self.toggle_connect()
        self.render()
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        root.after(50, self.poll)
        root.after(1000, self.tick)

    # ── 화면 만들기 ────────────────────────────────────────────────
    def _style(self):
        st = ttk.Style()
        try:
            st.theme_use("clam")           # 어느 PC 에서나 같은 모양
        except tk.TclError:
            pass
        st.configure("TCombobox", fieldbackground=C_CARD, background=C_CARD, bordercolor="#D3D7DE",
                     lightcolor=C_CARD, darkcolor=C_CARD, arrowcolor=C_SUB, padding=4)
        st.map("TCombobox", fieldbackground=[("readonly", C_CARD)], selectbackground=[("readonly", C_CARD)],
               selectforeground=[("readonly", C_TEXT)])
        st.configure("Vertical.TScrollbar", background="#E6E8EC", troughcolor=C_CARD, bordercolor=C_CARD,
                     arrowcolor=C_SUB, lightcolor="#E6E8EC", darkcolor="#E6E8EC")
        self.root.option_add("*TCombobox*Listbox.font", self.f["n"])

    def card(self, parent):
        return tk.Frame(parent, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)

    def _build_header(self):
        bar = tk.Frame(self.root, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        bar.pack(fill="x")
        inner = tk.Frame(bar, bg=C_CARD)
        inner.pack(fill="x", padx=14, pady=8)
        tk.Label(inner, text="Pico 시리얼 모니터", font=self.f["title"], bg=C_CARD, fg=C_TEXT).pack(side="left")
        tk.Label(inner, text="  하드웨어 점검 코드 출력 보기", font=self.f["s"], bg=C_CARD, fg=C_FAINT).pack(
            side="left", pady=(3, 0))

        right = tk.Frame(inner, bg=C_CARD)
        right.pack(side="right")
        self.status_lbl = tk.Label(right, text="● 연결 안 됨", font=self.f["b"], bg=LEVEL_BG["idle"],
                                   fg=LEVEL_FG["idle"], padx=10, pady=4)
        self.status_lbl.pack(side="right", padx=(10, 0))
        self.conn_btn = FlatButton(right, "연결", self.toggle_connect, "primary", self.f["b"],
                                   tip="고른 포트로 Pico 에 연결합니다. 연결 중에는 「끊기」로 바뀝니다.", padx=16)
        self.conn_btn.pack(side="right", padx=(6, 0))
        FlatButton(right, "↻", self.refresh_ports, "secondary", self.f["b"],
                   tip="포트 목록 새로고침 (F5)", padx=8).pack(side="right", padx=(6, 0))
        self.port_var = tk.StringVar()
        self.port_box = ttk.Combobox(right, textvariable=self.port_var, width=30, state="readonly",
                                     font=self.f["n"])
        self.port_box.pack(side="right")
        tk.Label(right, text="포트", font=self.f["n"], bg=C_CARD, fg=C_SUB).pack(side="right", padx=(0, 6))

    def _build_verdict(self, parent):
        self.verdict = tk.Frame(parent, bg=LEVEL_BG["idle"])
        self.verdict.pack(fill="x")
        self.v_bar = tk.Frame(self.verdict, bg=LEVEL_FG["idle"], width=5)
        self.v_bar.pack(side="left", fill="y")
        self.v_icon = tk.Label(self.verdict, text="…", font=self.f["icon"], bg=LEVEL_BG["idle"],
                               fg=LEVEL_FG["idle"], width=2)
        self.v_icon.pack(side="left", padx=(8, 4))
        txt = tk.Frame(self.verdict, bg=LEVEL_BG["idle"])
        txt.pack(side="left", fill="x", expand=True, pady=8)
        self.v_title = tk.Label(txt, text="", font=self.f["verdict"], bg=LEVEL_BG["idle"], fg=C_TEXT, anchor="w")
        self.v_title.pack(fill="x")
        self.v_action = tk.Label(txt, text="", font=self.f["n"], bg=LEVEL_BG["idle"], fg=C_SUB, anchor="w",
                                 justify="left")
        self.v_action.pack(fill="x")
        self._verdict_parts = [self.verdict, self.v_icon, txt, self.v_title, self.v_action]
        self.verdict.bind("<Configure>", lambda e: self.v_action.configure(wraplength=max(200, e.width - 80)))

    def _build_chips(self, parent):
        row = tk.Frame(parent, bg=C_BG)
        row.pack(fill="x", pady=(8, 0))
        self.chip_lbl = {}
        for name in CHIPS:
            lbl = tk.Label(row, text=f"● {name}", font=self.f["b"], bg=LEVEL_BG["idle"], fg=LEVEL_FG["idle"],
                           padx=10, pady=3)
            lbl.pack(side="left", padx=(0, 6))
            self.chip_lbl[name] = lbl

    def _build_strip(self, parent):
        strip = tk.Frame(parent, bg=C_BG)
        strip.pack(fill="x", pady=(8, 0))
        # 오른쪽 두 칸(서보 · LED)을 먼저 붙여 제 폭을 확보하고, 센서 세 칸이 남은 폭을 나눕니다
        led = self.card(strip)
        led.pack(side="right", fill="y")
        tk.Label(led, text="RGB LED", font=self.f["b"], bg=C_CARD, fg=C_TEXT).pack(padx=12, pady=(8, 0))
        self.led_canvas = tk.Canvas(led, width=56, height=56, bg=C_CARD, highlightthickness=0)
        self.led_canvas.pack(padx=12)
        self.v_led = tk.Label(led, text="—", font=self.f["b"], bg=C_CARD, fg=C_SUB)
        self.v_led.pack(pady=(0, 8))

        servo = self.card(strip)
        servo.pack(side="right", fill="y", padx=(0, 8))
        shead = tk.Frame(servo, bg=C_CARD)
        shead.pack(fill="x", padx=12, pady=(8, 0))
        tk.Label(shead, text="서보", font=self.f["b"], bg=C_CARD, fg=C_TEXT).pack(side="left")
        self.v_angle = tk.Label(shead, text="—", font=self.f["b"], bg=C_CARD, fg=C_TEXT)
        self.v_angle.pack(side="right")
        self.gauge = tk.Canvas(servo, width=170, height=58, bg=C_CARD, highlightthickness=0)
        self.gauge.pack(padx=12)
        self.seq = tk.Canvas(servo, width=170, height=26, bg=C_CARD, highlightthickness=0)
        self.seq.pack(padx=12, pady=(0, 6))

        self.v_sensor = {}
        self.spark = {}
        for key in ("temp", "humi", "light"):
            tile = self.card(strip)
            tile.pack(side="left", fill="both", expand=True, padx=(0, 8))
            accent = tk.Frame(tile, bg=LEVEL_FG["idle"], width=4)
            accent.pack(side="left", fill="y")
            body = tk.Frame(tile, bg=C_CARD)
            body.pack(side="left", fill="both", expand=True, padx=(10, 10), pady=(8, 8))
            head = tk.Frame(body, bg=C_CARD)
            head.pack(fill="x")
            tk.Label(head, text=SENSOR_LABEL[key], font=self.f["b"], bg=C_CARD, fg=C_SUB).pack(side="left")
            mark = tk.Label(head, text="", font=self.f["s"], bg=C_CARD, fg=C_FAINT, padx=6)
            mark.pack(side="right")
            val = tk.Label(body, text="—", font=self.f["big"], bg=C_CARD, fg=C_TEXT, anchor="w")
            val.pack(fill="x")
            foot = tk.Frame(body, bg=C_CARD)
            foot.pack(fill="x")
            sp = tk.Canvas(foot, width=110, height=24, bg=C_CARD, highlightthickness=0)
            sp.pack(side="left")
            hint = tk.Label(foot, text="", font=self.f["s"], bg=C_CARD, fg=C_FAINT, anchor="e")
            hint.pack(side="right")
            self.v_sensor[key] = (val, mark, hint)
            self.spark[key] = (sp, accent)

    def _build_log(self, parent):
        box = self.card(parent)
        box.pack(fill="both", expand=True, pady=(8, 10))
        bar = tk.Frame(box, bg=C_CARD)
        bar.pack(fill="x", padx=10, pady=(8, 6))
        tk.Label(bar, text="시리얼 출력", font=self.f["b"], bg=C_CARD, fg=C_TEXT).pack(side="left", padx=(0, 10))
        FlatButton(bar, "멈춤", self.stop_code, font=self.f["n"],
                   tip="Ctrl+C 를 보냅니다. 점검 코드가 서보를 90° 로 돌려놓고 멈춥니다.").pack(side="left", padx=(0, 6))
        FlatButton(bar, "다시 시작", self.restart_code, font=self.f["n"],
                   tip="code.py 를 처음부터 다시 실행합니다 (돌고 있으면 먼저 멈춘 뒤 Ctrl+D).").pack(side="left", padx=(0, 6))
        self.probe_btn = FlatButton(bar, "라이브러리 검사", self.start_probe, font=self.f["n"],
                                    tip="점검 코드를 잠깐 멈추고 REPL 에서 라이브러리 · 내장 모듈을 직접 불러 본 뒤, "
                                        "보드 · 펌웨어를 표시하고 점검 코드를 다시 시작합니다.")
        self.probe_btn.pack(side="left")

        FlatButton(bar, "저장", self.save_log, font=self.f["n"], tip="시리얼 출력을 텍스트 파일로 저장").pack(
            side="right")
        FlatButton(bar, "지우기", self.clear_log, font=self.f["n"], tip="화면의 출력 지우기 (Ctrl+L)").pack(
            side="right", padx=(0, 6))
        self.autoscroll = tk.BooleanVar(value=True)
        self.only_checks = tk.BooleanVar(value=False)
        for text, var, cmd in (("자동 스크롤", self.autoscroll, None),
                               ("점검 줄만", self.only_checks, self.apply_filter)):
            tk.Checkbutton(bar, text=text, variable=var, command=cmd, font=self.f["n"], bg=C_CARD, fg=C_SUB,
                           activebackground=C_CARD, selectcolor=C_CARD, highlightthickness=0, bd=0).pack(
                side="right", padx=(0, 10))

        frame = tk.Frame(box, bg=C_CARD)
        frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.log = tk.Text(frame, font=self.f["mono"], bg="#FBFBFC", fg=C_TEXT, wrap="word", relief="flat",
                           highlightthickness=1, highlightbackground=C_LINE, padx=8, pady=6, spacing1=1)
        sb = ttk.Scrollbar(frame, command=self.log.yview)
        self.log.configure(yscrollcommand=sb.set, state="disabled")
        sb.pack(side="right", fill="y")
        self.log.pack(side="left", fill="both", expand=True)
        for tag in ("ok", "warn", "fail", "error"):
            self.log.tag_configure(tag, foreground=LEVEL_FG["fail" if tag == "error" else tag])
        self.log.tag_configure("error", background=LEVEL_BG["fail"])
        self.log.tag_configure("info", foreground="#0B5CAD")
        self.log.tag_configure("app", foreground=C_SUB, font=(FONT_UI, 9, "italic"))
        self.log.tag_configure("time", foreground="#B0B5BE")
        self.log.tag_configure("noise", elide=False)

    def _build_statusbar(self):
        bar = tk.Frame(self.root, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        bar.pack(side="bottom", fill="x")
        self.v_status = tk.Label(bar, text="", font=self.f["s"], bg=C_CARD, fg=C_SUB, anchor="w")
        self.v_status.pack(side="left", padx=14, pady=4)
        tk.Label(bar, text="F5 포트 새로고침 · Ctrl+L 지우기", font=self.f["s"], bg=C_CARD, fg=C_FAINT).pack(
            side="right", padx=14)

    # ── 그림 (서보 게이지 · 순서 · LED) ─────────────────────────────
    def draw_gauge(self, angle):
        g = self.gauge
        g.delete("all")
        cx, cy, r = 85, 52, 44
        g.create_arc(cx - r, cy - r, cx + r, cy + r, start=0, extent=180, style="arc", outline="#E6E8EC", width=8)
        if angle is not None:     # 0° 는 오른쪽, 180° 는 왼쪽 — 지나온 만큼 진하게
            g.create_arc(cx - r, cy - r, cx + r, cy + r, start=0, extent=angle, style="arc",
                         outline="#C9CED6", width=8)
            rad = math.radians(angle)
            g.create_line(cx, cy, cx + (r - 6) * math.cos(rad), cy - (r - 6) * math.sin(rad),
                          width=3, fill=C_TEXT, capstyle="round")
        g.create_oval(cx - 4, cy - 4, cx + 4, cy + 4, fill=C_TEXT, outline="")
        g.create_text(cx - r - 8, cy, text="180°", anchor="e", font=(FONT_UI, 8), fill=C_FAINT)
        g.create_text(cx + r + 8, cy, text="0°", anchor="w", font=(FONT_UI, 8), fill=C_FAINT)
        self.v_angle.configure(text="—" if angle is None else f"{angle}°")

    def draw_sequence(self, done):
        """순서 점 5개 — 이번 회차에 도착한 만큼 채우고, 마지막 도착을 강조합니다."""
        c = self.seq
        c.delete("all")
        n = len(SERVO_STEPS)
        for i, a in enumerate(SERVO_STEPS):
            x = 15 + i * (140 / (n - 1))
            if i < n - 1:
                c.create_line(x + 6, 8, x + 140 / (n - 1) - 6, 8, fill=C_LINE, width=2)
            filled = i < done
            current = i == done - 1
            col = LEVEL_FG["ok"] if filled else "#D3D7DE"
            rr = 6 if current else 4
            c.create_oval(x - rr, 8 - rr, x + rr, 8 + rr, fill=col if filled else C_CARD, outline=col, width=2)
            c.create_text(x, 21, text=str(a), font=(FONT_UI, 7), fill=C_TEXT if current else C_FAINT)

    def draw_led(self, name):
        c = self.led_canvas
        c.delete("all")
        if name in LED_COLOR:
            col = LED_COLOR[name]
            c.create_oval(6, 6, 50, 50, fill=col, outline="")
            self.v_led.configure(text=name, fg=C_TEXT)
        else:
            c.create_oval(8, 8, 48, 48, fill=C_CARD, outline="#C9CED6", width=2)
            self.v_led.configure(text=name or "—", fg=C_FAINT)

    # ── 연결 ──────────────────────────────────────────────────────
    def refresh_ports(self):
        self.ports = find_ports()
        labels = [label for _, label, _ in self.ports]
        self.port_box["values"] = labels
        if self.ports and not self.port_var.get():
            self.port_var.set(labels[0])          # Pico 처럼 보이는 포트가 맨 앞
        if serial is None:
            self.set_status("✖ pyserial 없음", "fail")
        elif not self.ports and not self.worker:
            self.set_status("● 포트 없음", "idle")
            self.link_msg = "데이터 USB 케이블로 Pico 를 꽂고 ↻ 를 누르세요"
        self.render()

    def selected_device(self):
        text = self.port_var.get()
        for dev, label, _ in self.ports:
            if label == text:
                return dev
        return text.split(" ")[0] if text else None

    def toggle_connect(self):
        if self.worker:
            self.worker.stop()
            self.worker = None
            self.connected = False
            self.link = "none"
            self.probe = None                       # 검사 도중 끊어도 버튼이 다시 살아나게
            self.probe_btn.state(["!disabled"])
            self.conn_btn.set_text("연결")
            self.set_status("○ 연결 끊음", "idle")
            self.app_line("연결을 끊었습니다.")
            self.render()
            return
        if serial is None:
            messagebox.showerror("pyserial 없음", "pyserial-3.5-py2.py3-none-any.whl 파일을\n"
                                 "pico_monitor.py 와 같은 폴더에 두세요.")
            return
        dev = self.selected_device()
        if not dev:
            messagebox.showinfo("포트 선택", "포트를 먼저 고르세요. 목록이 비어 있으면 ↻ 를 누르세요.")
            return
        self.parser.reset()
        # 연결마다 새 큐 — 방금 끊은 옛 스레드가 늦게 넣는 「연결됨」이 화면에 섞이지 않게
        self.q = queue.Queue()
        self.worker = SerialWorker(dev, self.q)
        self.worker.start()
        self.link, self.link_msg = "waiting", f"{dev} 여는 중…"
        self.conn_btn.set_text("끊기")
        self.set_status(f"● {dev} 여는 중", "warn")
        self.render()

    def set_status(self, text, level):
        self.status_lbl.configure(text=text, fg=LEVEL_FG[level], bg=LEVEL_BG[level])

    # ── 버튼: Ctrl+C / Ctrl+D / 라이브러리 검사 ─────────────────────
    def send(self, data, note):
        if self.worker and self.worker.write(data):
            self.app_line(note)
            return True
        self.app_line("Pico 에 연결되어 있지 않습니다.")
        return False

    def stop_code(self):
        self.send(b"\x03", "Ctrl+C 를 보냈습니다 — 점검 코드가 서보를 90° 로 돌려놓고 멈춥니다.")

    def restart_code(self):
        # 이미 멈춰 있으면(REPL · 「Press any key」) Ctrl+D 한 번이면 code.py 가 다시 돕니다.
        # 돌고 있으면 먼저 Ctrl+C 로 멈추고, 서보가 90° 로 돌아간 뒤 Ctrl+D 를 보냅니다.
        if self.parser.code_state in ("stopped", "repl", "error"):
            self.send(b"\x04", "다시 시작: code.py 를 다시 실행합니다…")
        elif self.send(b"\x03", "다시 시작: 멈춘 뒤 code.py 를 다시 실행합니다…"):
            self.probe = {"step": "restart", "until": time.monotonic() + 6}

    def start_probe(self):
        """Pico 를 잠시 REPL 로 불러 라이브러리를 직접 import 해 보고, 끝나면 code.py 를 다시 실행합니다."""
        if self.probe:
            return
        for k in self.parser.libs:
            self.parser.libs[k] = None
        for k in self.parser.builtins:
            self.parser.builtins[k] = None
        self.parser.probe_done = False
        if self.parser.code_state in ("stopped", "repl", "error"):
            # 이미 멈춰 있으면 Enter 로 REPL 에 들어가기만 하면 됩니다
            if self.send(b"\r", "라이브러리 검사: REPL 에서 직접 불러 봅니다…"):
                self.probe = {"step": "wait_repl", "until": time.monotonic() + 1.0}
                self.probe_btn.state(["disabled"])
        elif self.send(b"\x03", "라이브러리 검사: 점검 코드를 잠시 멈춥니다…"):
            self.probe = {"step": "wait_prompt", "until": time.monotonic() + 6}
            self.probe_btn.state(["disabled"])

    PROBE_CODE = (
        "exec(\"import os\\nu=os.uname()\\nprint('@@FW',u.release,'|',u.machine)\\n"
        "for n in " + repr(tuple(BUILTINS + ["adafruit_dht", "adafruit_motor.servo"])) + ":\\n"
        " try:\\n  __import__(n)\\n  m=__import__(n.split('.')[0])\\n"
        "  print('@@LIB',n,'OK',getattr(m,'__version__',''))\\n"
        " except Exception as e:\\n  print('@@LIB',n,'FAIL',repr(e))\\n"
        "print('@@END')\")\r"
    )

    def probe_step(self, line=None):
        """「라이브러리 검사」와 「다시 시작」의 순서를 진행합니다 (줄이 올 때와 시간이 지날 때 불림)."""
        p = self.probe
        now = time.monotonic()
        if p["step"] == "restart":
            if (line and "Press any key" in line) or now > p["until"]:
                self.worker.write(b"\x04")
                self.probe = None
        elif p["step"] == "wait_prompt":
            if self.parser.code_state == "repl":
                # 이미 REPL 로 들어와 있으면(배너 · 「>>>」가 보임) 기다릴 것 없이 바로 진행
                p.update(step="wait_repl", until=now + 0.5)
            elif (line and "Press any key" in line) or now > p["until"]:
                self.worker.write(b"\r")                 # REPL 로 들어갑니다
                p.update(step="wait_repl", until=now + 1.2)
        elif p["step"] == "wait_repl":
            if now > p["until"]:
                self.worker.write(self.PROBE_CODE.encode())
                p.update(step="wait_end", until=now + 8)
        elif p["step"] == "wait_end":
            if self.parser.probe_done or now > p["until"]:
                if not self.parser.probe_done:
                    self.app_line("라이브러리 검사 응답이 없습니다. USB 를 다시 꽂아 보세요.")
                else:
                    bi = self.parser.builtins
                    ok = all(v is True for v in bi.values())
                    self.app_line("라이브러리 검사 결과 — " + ", ".join(
                        f"{k}: {'정상' if v is True else v}" for k, v in {**self.parser.libs, **bi}.items()))
                    if not ok:
                        self.app_line("내장 모듈에 문제가 있습니다 — 펌웨어가 이 보드용인지 확인하세요.")
                self.worker.write(b"\x04")              # code.py 다시 실행
                self.app_line("라이브러리 검사 끝 — 점검 코드를 다시 시작합니다.")
                self.probe = None
                self.probe_btn.state(["!disabled"])

    # ── 받은 것 처리 (0.05초마다) ───────────────────────────────────
    def poll(self):
        changed = False
        try:
            while True:
                kind, *rest = self.q.get_nowait()
                changed = True
                if kind == "line":
                    line = rest[0]
                    self.last_rx = time.monotonic()
                    tag = self.parser.feed(line)
                    if not line.startswith("@@"):
                        self.add_line(line, tag)
                    if line.strip().startswith("KeyboardInterrupt"):
                        self.app_line("↑ Ctrl+C 로 멈춘 것입니다 — 오류가 아닙니다.")
                    if self.probe:
                        self.probe_step(line)
                elif kind == "title":
                    self.last_rx = time.monotonic()
                    self.parser.feed_title(rest[0])
                elif kind == "status":
                    self.on_status(*rest)
        except queue.Empty:
            pass
        if self.probe and self.worker:
            self.probe_step()
        if changed:
            self.render()
        self.root.after(50, self.poll)

    def on_status(self, state, msg):
        if state == "connected":
            self.connected, self.link = True, "connected"
            self.set_status(f"● 연결됨  {msg}", "ok")
            self.app_line(f"{msg} 에 연결했습니다. (출력이 안 보이면 「다시 시작」을 누르세요)")
        elif state == "waiting":
            self.connected, self.link, self.link_msg = False, "waiting", msg
            self.set_status("● 기다리는 중", "warn")
        elif state == "lost":
            self.connected, self.link, self.link_msg = False, "lost", msg
            self.parser.code_state = "unknown"
            self.set_status("● USB 빠짐", "warn")
            self.app_line(msg)
            if self.probe:
                self.probe = None
                self.probe_btn.state(["!disabled"])

    def quiet(self):
        return (self.connected and self.last_rx is not None and self.parser.code_state == "running"
                and time.monotonic() - self.last_rx > QUIET_SECONDS)

    def tick(self):
        """1초마다: 상태줄의 「마지막 수신」과 판정(10초 무출력) 갱신"""
        self.render()
        self.root.after(1000, self.tick)

    def render(self):
        p = self.parser
        level, title, action, chips = summarize(p, self.link, self.quiet(), self.link_msg)
        bg, fg = LEVEL_BG[level], LEVEL_FG[level]
        for w in self._verdict_parts:
            w.configure(bg=bg)
        self.v_bar.configure(bg=fg)
        self.v_icon.configure(text=LEVEL_ICON[level], fg=fg)
        self.v_title.configure(text=title, fg=C_TEXT if level in ("ok", "idle") else fg)
        self.v_action.configure(text="→ " + action if action else "")
        for name, lbl in self.chip_lbl.items():
            lv = chips[name]
            lbl.configure(text=f"{LEVEL_ICON[lv] if lv != 'idle' else '○'} {name}", fg=LEVEL_FG[lv],
                          bg=LEVEL_BG[lv])

        for key, (val, mark, hint) in self.v_sensor.items():
            s = p.sensors[key]
            sp, accent = self.spark[key]
            lv = MARK_LEVEL.get(s["mark"], "idle") if s else "idle"
            accent.configure(bg=LEVEL_FG[lv])
            if not s:
                val.configure(text="—", fg=C_FAINT)
                mark.configure(text="", bg=C_CARD)
                hint.configure(text="")
            else:
                unit = SENSOR_UNIT[key]
                val.configure(text="---" if s["value"] is None else f"{s['value']:.1f}{unit}",
                              fg=C_TEXT if lv == "ok" else LEVEL_FG[lv])
                mark.configure(text=s["mark"], fg=LEVEL_FG[lv], bg=LEVEL_BG[lv])
                hint.configure(text=f"raw {s['raw']}" if s.get("raw") is not None else "")
            draw_sparkline(sp, p.history[key], LEVEL_FG[lv] if lv != "ok" else "#5B616E")

        self.draw_gauge(p.servo)
        self.draw_sequence(p.arrivals)
        self.draw_led(p.led)

        parts = []
        if p.board:
            parts.append(p.board)
        if p.firmware:
            parts.append("CircuitPython " + p.firmware + (f" ({p.chip})" if p.chip else ""))
        if not parts:
            parts.append("보드 · 펌웨어: 「라이브러리 검사」를 누르면 표시")
        if self.connected and self.last_rx is not None:
            parts.append(f"마지막 수신 {time.monotonic() - self.last_rx:.0f}초 전")
        if p.round:
            parts.append(f"점검 {p.round}회차")
        self.v_status.configure(text="  ·  ".join(parts))

    # ── 로그 ──────────────────────────────────────────────────────
    def add_line(self, line, tag=""):
        stamp = datetime.datetime.now().strftime("%H:%M:%S  ")
        important = line.lstrip().startswith(CHECK_PREFIX) or tag in ("error", "fail", "warn")
        extra = () if important else ("noise",)
        self.log.configure(state="normal")
        self.log.insert("end", stamp, ("time",) + extra)
        self.log.insert("end", line + "\n", ((tag,) if tag else ()) + extra)
        lines = int(self.log.index("end-1c").split(".")[0])
        if lines > MAX_LOG_LINES:
            self.log.delete("1.0", f"{lines - MAX_LOG_LINES}.0")
        self.log.configure(state="disabled")
        if self.autoscroll.get():
            self.log.see("end")

    def app_line(self, text):
        self.add_line("[모니터] " + text, "app")

    def apply_filter(self):
        self.log.tag_configure("noise", elide=self.only_checks.get())
        self.log.see("end")

    def clear_log(self):
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")

    def save_log(self):
        name = datetime.datetime.now().strftime("pico_log_%Y%m%d_%H%M.txt")
        path = filedialog.asksaveasfilename(initialfile=name, defaultextension=".txt",
                                            filetypes=[("텍스트", "*.txt")])
        if path:
            with open(path, "w", encoding="utf-8") as f:
                f.write(self.log.get("1.0", "end"))
            self.app_line(f"기록을 저장했습니다: {path}")

    def on_close(self):
        if self.worker:
            self.worker.stop()
        self.root.destroy()


def main():
    # 선생님용: py pico_monitor.py --port COM5  처럼 포트를 바로 지정할 수 있습니다
    port = None
    if "--port" in sys.argv:
        i = sys.argv.index("--port")
        if i + 1 < len(sys.argv):
            port = sys.argv[i + 1]
    # DPI 인식(SetProcessDpiAwareness)은 일부러 켜지 않습니다. 켜면 125~150% 배율에서 글자만 커지고
    # 창 · 그림 크기(픽셀)는 그대로라 카드가 잘립니다. 끄면 Windows 가 창 전체를 같은 비율로 키웁니다.
    root = tk.Tk()
    MonitorApp(root, auto_port=port)
    root.mainloop()


if __name__ == "__main__":
    main()
