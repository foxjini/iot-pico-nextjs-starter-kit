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
#   구조 — 세 부분으로 나눠 두었습니다
#     PicoParser   : 받은 글자 한 줄을 읽고 「지금 Pico 상태」를 갱신합니다 (화면과 무관, 순수 파이썬)
#     SerialWorker : 별도 스레드에서 포트를 열고 읽습니다. 뽑혔다 다시 꽂히면 저절로 다시 연결합니다
#     MonitorApp   : tkinter 화면. 0.05초마다 SerialWorker 가 받은 것을 꺼내 화면에 그립니다

import codecs
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
            return {"OK": "ok", "경고": "warn", "실패": "fail"}.get(mark, "")
        m = RE_SERVO.search(s)
        if m:
            self.servo = int(m.group(1))
            self.led = m.group(2)
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
#  ③ MonitorApp — tkinter 화면
# ════════════════════════════════════════════════════════════════════════

FONT = ("Malgun Gothic", 10)
FONT_B = ("Malgun Gothic", 10, "bold")
FONT_BIG = ("Malgun Gothic", 17, "bold")
FONT_SMALL = ("Malgun Gothic", 9)
FONT_LOG = ("Consolas", 10)

C_BG, C_CARD, C_LINE = "#f4f5f7", "#ffffff", "#dcdfe4"
C_TEXT, C_SUB = "#1f2328", "#5f6670"
C_OK, C_WARN, C_FAIL, C_INFO = "#1a7f37", "#b35900", "#cf222e", "#0b5cad"
MARK_COLOR = {"OK": C_OK, "경고": C_WARN, "실패": C_FAIL, "": C_SUB}
LED_COLOR = {"빨강": "#ff3b30", "초록": "#34c759", "파랑": "#0a84ff", "꺼짐": "#d0d3d8"}
STATE_TEXT = {
    "running": ("● 실행 중", C_OK), "stopped": ("■ 멈춤 (Code done running)", C_WARN),
    "error": ("✖ 오류로 멈춤", C_FAIL), "repl": ("› REPL (코드 안 도는 중)", C_WARN),
    "unknown": ("? 아직 모름", C_SUB),
}
QUIET_SECONDS = 10      # 이만큼 아무 글자도 안 오면 「멈춘 것 같다」고 알립니다
MAX_LOG_LINES = 3000


class MonitorApp:
    def __init__(self, root, auto_port=None):
        self.root = root
        self.q = queue.Queue()
        self.worker = None
        self.parser = PicoParser()
        self.last_rx = None
        self.connected = False
        self.probe = None           # 「라이브러리 직접 검사」 진행 상태
        self.auto_port = auto_port

        root.title("Pico 시리얼 모니터")
        root.geometry("1200x720")
        root.minsize(1000, 600)
        root.configure(bg=C_BG)
        self._style()
        self._build_top()
        body = tk.Frame(root, bg=C_BG)
        body.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        self._build_left(body)
        self._build_log(body)

        self.refresh_ports()
        if auto_port:
            self.port_var.set(auto_port)
            self.toggle_connect()
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        root.after(50, self.poll)
        root.after(500, self.tick)

    # ── 화면 만들기 ────────────────────────────────────────────────
    def _style(self):
        st = ttk.Style()
        try:
            st.theme_use("vista" if sys.platform == "win32" else "clam")
        except tk.TclError:
            pass
        st.configure("TButton", font=FONT, padding=(10, 4))
        st.configure("TCheckbutton", font=FONT, background=C_BG)

    def card(self, parent, title):
        outer = tk.Frame(parent, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        outer.pack(fill="x", pady=(0, 10))
        tk.Label(outer, text=title, font=FONT_B, bg=C_CARD, fg=C_TEXT, anchor="w").pack(
            fill="x", padx=12, pady=(10, 4))
        inner = tk.Frame(outer, bg=C_CARD)
        inner.pack(fill="x", padx=12, pady=(0, 10))
        return inner

    def row(self, parent, label):
        f = tk.Frame(parent, bg=C_CARD)
        f.pack(fill="x", pady=1)
        tk.Label(f, text=label, font=FONT, bg=C_CARD, fg=C_SUB, width=10, anchor="w").pack(side="left")
        v = tk.Label(f, text="—", font=FONT_B, bg=C_CARD, fg=C_TEXT, anchor="w")
        v.pack(side="left", fill="x", expand=True)
        return v

    def _build_top(self):
        top = tk.Frame(self.root, bg=C_BG)
        top.pack(fill="x", padx=12, pady=12)
        tk.Label(top, text="포트", font=FONT_B, bg=C_BG, fg=C_TEXT).pack(side="left")
        self.port_var = tk.StringVar()
        self.port_box = ttk.Combobox(top, textvariable=self.port_var, width=42, state="readonly", font=FONT)
        self.port_box.pack(side="left", padx=(6, 6))
        ttk.Button(top, text="새로고침", command=self.refresh_ports).pack(side="left")
        self.conn_btn = ttk.Button(top, text="연결", command=self.toggle_connect)
        self.conn_btn.pack(side="left", padx=6)
        self.status_lbl = tk.Label(top, text="○ 연결 안 됨", font=FONT_B, bg=C_BG, fg=C_SUB, anchor="w")
        self.status_lbl.pack(side="left", padx=10, fill="x", expand=True)

    def _build_left(self, body):
        left = tk.Frame(body, bg=C_BG, width=380)
        left.pack(side="left", fill="y", padx=(0, 12))
        left.pack_propagate(False)

        c = self.card(left, "Pico")
        self.v_board = self.row(c, "보드")
        self.v_fw = self.row(c, "펌웨어")
        self.v_state = self.row(c, "코드 상태")
        self.v_rx = self.row(c, "마지막 수신")
        self.v_round = self.row(c, "점검 회차")

        c = self.card(left, "CircuitPython 라이브러리")
        self.v_libs = {name: self.row(c, name.replace("adafruit_", "")) for name in LIBS}
        self.v_builtin = self.row(c, "내장 모듈")
        self.v_libnote = tk.Label(c, text="", font=FONT, bg=C_CARD, fg=C_FAIL, wraplength=320,
                                  justify="left", anchor="w")
        self.v_libnote.pack(fill="x", pady=(4, 4))
        self.probe_btn = ttk.Button(c, text="라이브러리 직접 검사", command=self.start_probe)
        self.probe_btn.pack(anchor="w")

    def _build_status_strip(self, parent):
        """센서 3칸 + 액추에이터를 로그 위에 가로로 놓습니다 (1366×768 노트북에서도 다 보이게)"""
        strip = tk.Frame(parent, bg=C_BG)
        strip.pack(fill="x", pady=(0, 10))
        act = tk.Frame(strip, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        act.pack(side="right", fill="y")
        tk.Label(act, text="액추에이터", font=FONT_B, bg=C_CARD, fg=C_TEXT, anchor="w").pack(
            fill="x", padx=10, pady=(8, 0))
        row = tk.Frame(act, bg=C_CARD)
        row.pack(padx=10, pady=(0, 8))
        self.gauge = tk.Canvas(row, width=200, height=100, bg=C_CARD, highlightthickness=0)
        self.gauge.pack(side="left")
        led = tk.Frame(row, bg=C_CARD)
        led.pack(side="left", padx=(6, 0))
        tk.Label(led, text="RGB LED", font=FONT_SMALL, bg=C_CARD, fg=C_SUB).pack()
        self.led_canvas = tk.Canvas(led, width=60, height=60, bg=C_CARD, highlightthickness=0)
        self.led_canvas.pack()
        self.v_led = tk.Label(led, text="—", font=FONT_B, bg=C_CARD, fg=C_TEXT)
        self.v_led.pack()
        self.draw_gauge(None)
        self.draw_led(None)

        self.v_sensor = {}
        for key, label in (("temp", "온도"), ("humi", "습도"), ("light", "조도")):
            tile = tk.Frame(strip, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
            tile.pack(side="left", fill="both", expand=True, padx=(0, 10))
            head = tk.Frame(tile, bg=C_CARD)
            head.pack(fill="x", padx=10, pady=(8, 0))
            tk.Label(head, text=label, font=FONT_B, bg=C_CARD, fg=C_TEXT).pack(side="left")
            mark = tk.Label(head, text="", font=FONT_B, bg=C_CARD, fg=C_SUB)
            mark.pack(side="right")
            val = tk.Label(tile, text="—", font=FONT_BIG, bg=C_CARD, fg=C_TEXT, anchor="w")
            val.pack(fill="x", padx=10)
            hint = tk.Label(tile, text="", font=FONT_SMALL, bg=C_CARD, fg=C_SUB, wraplength=170,
                            justify="left", anchor="nw", height=4)
            hint.pack(fill="x", padx=10, pady=(0, 8))
            self.v_sensor[key] = (val, mark, hint)


    def _build_log(self, body):
        side = tk.Frame(body, bg=C_BG)
        side.pack(side="left", fill="both", expand=True)
        self._build_status_strip(side)
        right = tk.Frame(side, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        right.pack(fill="both", expand=True)
        bar = tk.Frame(right, bg=C_CARD)
        bar.pack(fill="x", padx=10, pady=8)
        tk.Label(bar, text="시리얼 출력", font=FONT_B, bg=C_CARD, fg=C_TEXT).pack(side="left")
        self.autoscroll = tk.BooleanVar(value=True)
        ttk.Checkbutton(bar, text="자동 스크롤", variable=self.autoscroll).pack(side="right")
        ttk.Button(bar, text="기록 저장", command=self.save_log).pack(side="right", padx=4)
        ttk.Button(bar, text="화면 지우기", command=self.clear_log).pack(side="right", padx=4)
        ttk.Button(bar, text="다시 시작 (Ctrl+D)", command=self.restart_code).pack(side="right", padx=4)
        ttk.Button(bar, text="멈춤 (Ctrl+C)", command=self.stop_code).pack(side="right", padx=4)

        frame = tk.Frame(right, bg=C_CARD)
        frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.log = tk.Text(frame, font=FONT_LOG, bg="#fbfbfc", fg=C_TEXT, wrap="word",
                           relief="flat", highlightthickness=1, highlightbackground=C_LINE)
        sb = ttk.Scrollbar(frame, command=self.log.yview)
        self.log.configure(yscrollcommand=sb.set, state="disabled")
        sb.pack(side="right", fill="y")
        self.log.pack(side="left", fill="both", expand=True)
        for tag, color in (("ok", C_OK), ("warn", C_WARN), ("fail", C_FAIL), ("error", C_FAIL),
                           ("info", C_INFO), ("app", "#8250df"), ("time", "#9aa0a6")):
            self.log.tag_configure(tag, foreground=color)
        self.log.tag_configure("error", background="#fff0f0")

    # ── 그림 (서보 게이지 · LED) ────────────────────────────────────
    def draw_gauge(self, angle):
        g = self.gauge
        g.delete("all")
        cx, cy, r = 100, 88, 70
        g.create_arc(cx - r, cy - r, cx + r, cy + r, start=0, extent=180, style="arc",
                     outline=C_LINE, width=10)
        # 반원 게이지: 0° 는 오른쪽, 90° 는 위, 180° 는 왼쪽
        for a, t in ((0, "0°"), (90, "90°"), (180, "180°")):
            rad = math.radians(a)
            x, y = cx + r * math.cos(rad), cy - r * math.sin(rad)
            g.create_text(x + (8 if a == 0 else -8 if a == 180 else 0), y - (10 if a == 90 else -2),
                          text=t, font=("Malgun Gothic", 8), fill=C_SUB)
        if angle is not None:
            rad = math.radians(angle)
            g.create_line(cx, cy, cx + (r - 12) * math.cos(rad), cy - (r - 12) * math.sin(rad),
                          width=4, fill=C_INFO, capstyle="round")
        g.create_oval(cx - 5, cy - 5, cx + 5, cy + 5, fill=C_TEXT, outline="")
        g.create_text(cx, cy - 26, text="—" if angle is None else f"서보 {angle}°",
                      font=FONT_B, fill=C_TEXT)

    def draw_led(self, name):
        c = self.led_canvas
        c.delete("all")
        color = LED_COLOR.get(name, "#d0d3d8")
        if name in ("빨강", "초록", "파랑"):
            c.create_oval(4, 4, 56, 56, fill=color, outline="")          # 빛 번짐
            c.create_oval(14, 14, 46, 46, fill=color, outline="white", width=2)
        else:
            c.create_oval(14, 14, 46, 46, fill=color, outline=C_LINE, width=2)
        self.v_led.configure(text=name or "—")

    # ── 연결 ──────────────────────────────────────────────────────
    def refresh_ports(self):
        self.ports = find_ports()
        labels = [label for _, label, _ in self.ports]
        self.port_box["values"] = labels
        if self.ports and not self.port_var.get():
            self.port_var.set(labels[0])          # Pico 처럼 보이는 포트가 맨 앞
        if serial is None:
            self.set_status("✖ pyserial 이 없습니다 — pyserial-*.whl 파일을 이 폴더에 두세요", C_FAIL)
        elif not self.ports and not self.connected:
            self.set_status("○ 포트가 없습니다 — Pico 를 데이터 USB 케이블로 꽂고 「새로고침」", C_SUB)

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
            self.conn_btn.configure(text="연결")
            self.set_status("○ 연결 끊음", C_SUB)
            self.app_line("연결을 끊었습니다.")
            return
        if serial is None:
            messagebox.showerror("pyserial 없음", "pyserial-3.5-py2.py3-none-any.whl 파일을\n"
                                 "pico_monitor.py 와 같은 폴더에 두세요.")
            return
        dev = self.selected_device()
        if not dev:
            messagebox.showinfo("포트 선택", "포트를 먼저 고르세요. 목록이 비어 있으면 「새로고침」을 누르세요.")
            return
        self.parser.reset()
        self.worker = SerialWorker(dev, self.q)
        self.worker.start()
        self.conn_btn.configure(text="끊기")
        self.set_status(f"… {dev} 여는 중", C_SUB)

    def set_status(self, text, color):
        self.status_lbl.configure(text=text, fg=color)

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
            if (line and "Press any key" in line) or now > p["until"]:
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
            self.connected = True
            self.set_status(f"● 연결됨 — {msg}", C_OK)
            self.app_line(f"{msg} 에 연결했습니다. (Pico 출력이 안 보이면 「다시 시작」을 누르세요)")
        elif state == "waiting":
            self.connected = False
            self.set_status(f"↻ {msg}", C_WARN)
        elif state == "lost":
            self.connected = False
            self.parser.code_state = "unknown"
            self.render()
            self.set_status(f"↻ {msg}", C_WARN)
            self.app_line(msg)
            if self.probe:
                self.probe = None
                self.probe_btn.state(["!disabled"])

    def tick(self):
        """1초마다: 「마지막 수신 n초 전」 갱신, 너무 조용하면 알림"""
        if self.connected and self.last_rx is not None:
            ago = time.monotonic() - self.last_rx
            quiet = ago > QUIET_SECONDS and self.parser.code_state == "running"
            self.v_rx.configure(text=f"{ago:.0f}초 전" + ("  — 출력이 멈췄습니다" if quiet else ""),
                                fg=C_FAIL if quiet else C_TEXT)
        elif not self.connected:
            self.v_rx.configure(text="—", fg=C_TEXT)
        self.root.after(1000, self.tick)

    def render(self):
        p = self.parser
        # 연결하는 순간 그전에 온 글자는 버려지므로, 보드·펌웨어는 재시작이나 직접 검사 때 알 수 있습니다
        if p.board:
            self.v_board.configure(text=p.board, fg=C_TEXT)
        else:
            self.v_board.configure(text="— (「라이브러리 직접 검사」로 확인)", fg=C_SUB)
        self.v_fw.configure(text=("CircuitPython " + p.firmware + (f" · {p.chip}" if p.chip else ""))
                            if p.firmware else "—")
        text, color = STATE_TEXT.get(p.code_state, STATE_TEXT["unknown"])
        if p.code_state == "error" and p.last_error:
            text += "  " + p.last_error[:40]
        self.v_state.configure(text=text, fg=color)
        self.v_round.configure(text=f"{p.round}회차" if p.round else "—")

        for name, lbl in self.v_libs.items():
            st = p.libs[name]
            if st is True:
                lbl.configure(text="✔ 정상", fg=C_OK)
            elif st is None:
                lbl.configure(text="? 아직 모름 (점검이 시작되면 표시)", fg=C_SUB)
            else:
                lbl.configure(text="✖ " + st, fg=C_FAIL)
        bi = p.builtins
        if all(v is None for v in bi.values()):
            self.v_builtin.configure(text="— (「직접 검사」로 확인)", fg=C_SUB)
        elif all(v is True for v in bi.values()):
            self.v_builtin.configure(text=f"✔ {len(bi)}개 모두 정상", fg=C_OK)
        else:
            bad = [k for k, v in bi.items() if v not in (True, None)]
            self.v_builtin.configure(text="✖ " + ", ".join(bad) if bad else "…", fg=C_FAIL if bad else C_SUB)
        self.v_libnote.configure(text=p.lib_note)

        for key, (val, mark, hint) in self.v_sensor.items():
            s = p.sensors[key]
            if not s:
                val.configure(text="—", fg=C_TEXT)
                mark.configure(text="")
                hint.configure(text="")
                continue
            unit = SENSOR_UNIT[key]
            val.configure(text="---" if s["value"] is None else f"{s['value']:.1f}{unit}",
                          fg=MARK_COLOR.get(s["mark"], C_TEXT))
            mark.configure(text=s["mark"], fg=MARK_COLOR.get(s["mark"], C_SUB))
            extra = f"raw {s['raw']}  " if s.get("raw") is not None else ""
            hint.configure(text=extra + s["text"])

        self.draw_gauge(p.servo)
        self.draw_led(p.led)

    # ── 로그 ──────────────────────────────────────────────────────
    def add_line(self, line, tag=""):
        stamp = datetime.datetime.now().strftime("%H:%M:%S ")
        self.log.configure(state="normal")
        self.log.insert("end", stamp, "time")
        self.log.insert("end", line + "\n", tag)
        lines = int(self.log.index("end-1c").split(".")[0])
        if lines > MAX_LOG_LINES:
            self.log.delete("1.0", f"{lines - MAX_LOG_LINES}.0")
        self.log.configure(state="disabled")
        if self.autoscroll.get():
            self.log.see("end")

    def app_line(self, text):
        self.add_line("[모니터] " + text, "app")

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
    if sys.platform == "win32":
        try:   # 고해상도 화면에서 글자가 흐리지 않게
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass
    root = tk.Tk()
    MonitorApp(root, auto_port=port)
    root.mainloop()


if __name__ == "__main__":
    main()
