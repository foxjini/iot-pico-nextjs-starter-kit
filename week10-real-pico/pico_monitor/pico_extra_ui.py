# pico_extra_ui.py — 추가 회로 3종 점검 UI (Windows · Python 3.9 이상, 설치 없음)
#
#   Pico 의 code.py = code_extra_circuits.py 와 USB 시리얼로 주고받습니다.
#     · 초음파 거리 보기 (큰 숫자 · 막대 · 추세선)
#     · DC 모터 켜기/끄기 (릴레이)
#     · LED 밝기 0~100% (PWM) — 지금 밝기의 PWM 파형을 같이 그려 줍니다
#     · 초음파 연결 상태가 바뀌면 메시지 창에 원인별 점검 순서를 띄웁니다 (「초음파 진단」 버튼으로 언제든)
#     · 자동 시험 ↔ 수동 조작 전환
#
#   실행: 이 폴더의 run_extra_ui.bat 더블클릭, 또는  py pico_extra_ui.py
#   pico_monitor.py 의 시리얼 연결(SerialWorker · 포트 찾기 · 자동 재연결)과 버튼 · 색을 그대로 씁니다.
#   pyserial 은 같은 폴더의 .whl 을 직접 불러오므로 설치하지 않아도 됩니다.

import collections
import datetime
import json
import os
import queue
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pico_monitor as pm                     # noqa: E402  (같은 폴더)
from pico_monitor import (tk, ttk, messagebox, FlatButton, Tooltip, SerialWorker, find_ports, pick_font,
                          draw_sparkline, C_BG, C_CARD, C_LINE, C_TEXT, C_SUB, C_FAINT, LEVEL_FG, LEVEL_BG)  # noqa: E402

PING_EVERY_MS = 1000       # 수동 조작 중 Pico 에 「살아 있음」 알림 (Pico 는 5초 없으면 모터를 끔)
STALE_SECONDS = 3          # DATA 가 이만큼 안 오면 「응답 없음」
DIST_MAX = 100             # 막대 눈금 최대 (cm) — 넘으면 끝에 붙음
PWM_HZ = 1000              # code_extra_circuits.py 의 PWMOut frequency 와 같게
PWM_V = 3.3                # Pico GPIO HIGH 전압
FLAP_WINDOW = 30           # 이 시간(초) 안에 초음파가 3번 끊겼다 이어지면 접촉 불량 의심

# 초음파 상태별 안내 — (머리줄, 점검 순서)
SONAR_GUIDE = {
    "timeout": ("✖ 응답 없음 — 센서가 메아리 신호(ECHO)를 돌려주지 않습니다. 배선 문제일 가능성이 큽니다", [
        "① 전원: HC-SR04 VCC 가 외부 5V(+), GND 가 공통 GND 에 — 3.3V 로는 동작하지 않거나 불안정합니다",
        "② 신호선: TRIG → GP10, ECHO → 1kΩ → GP11 — 두 선이 서로 바뀌지 않았는지",
        "③ 분압: 1kΩ 은 ECHO 와 GP11 사이, 2kΩ 은 GP11 과 GND 사이 — 바뀌면 GP11 에 1.7V 만 와서 HIGH 로 읽지 못합니다",
        "④ 공통 GND: 외부 5V 어댑터의 (−) 와 Pico GND 가 이어져 있는지",
        "⑤ 그래도 안 되면: USB · 어댑터를 뽑고 점퍼를 하나씩 다시 꽂기 → 다른 HC-SR04 로 바꿔 보기",
    ]),
    "range": ("⚠ 범위 밖 — 센서는 응답하지만 2~400cm 밖의 값입니다. 배선은 대체로 정상입니다", [
        "① 센서 앞 10~50cm 에 손이나 책을 똑바로 대 보세요 — 앞이 비어 있으면 메아리가 너무 늦게 옵니다",
        "② 2cm 보다 가까우면 잴 수 없습니다 — 조금 떨어뜨리세요",
        "③ 천 · 스펀지 · 비스듬한 면은 소리를 흡수하거나 옆으로 튕겨 보냅니다",
        "④ 센서가 브레드보드 · 책상 모서리를 보고 있지 않은지 (센서는 앞쪽 약 15° 원뿔 안을 봅니다)",
    ]),
    "ok": ("✔ 연결 정상", [
        "· 손을 10 → 30 → 50cm 로 움직여 숫자가 따라 바뀌는지 보세요",
        "· 정확도: 자를 대고 10cm · 30cm 에 손을 두어 ±1cm 안이면 정상",
        "· 숫자가 전혀 변하지 않으면 센서가 다른 물체(벽 · 모니터)를 보고 있는 것입니다",
    ]),
}


class ExtraApp:
    def __init__(self, root, auto_port=None):
        font_ui = pick_font(["Malgun Gothic", "맑은 고딕", "Noto Sans CJK KR", "NanumGothic"], "TkDefaultFont")
        font_mono = pick_font(["Consolas", "D2Coding", "NanumGothicCoding", "DejaVu Sans Mono"], "TkFixedFont")
        pm.FONT_UI = font_ui                    # 툴팁 글꼴
        self.f = {"title": (font_ui, 13, "bold"), "b": (font_ui, 10, "bold"), "n": (font_ui, 10),
                  "s": (font_ui, 9), "big": (font_ui, 34, "bold"), "mid": (font_ui, 18, "bold"),
                  "mono": (font_mono, 9)}
        self.root = root
        self.q = queue.Queue()
        self.worker = None
        self.connected = False
        self.ports = []
        self.data = None                        # 마지막 DATA (dict)
        self.data_at = None
        self.hist = collections.deque(maxlen=60)
        self.led_job = None                     # 슬라이더를 끄는 동안 너무 자주 보내지 않게
        self.sonar_kind = None                  # 마지막으로 메시지 창에 알린 초음파 상태
        self.sonar_flaps = collections.deque()  # 정상 → 실패로 바뀐 시각들
        self.flap_warned_at = -1e9

        root.title("추가 회로 점검 — 초음파 · 모터 · LED")
        root.configure(bg=C_BG)
        root.minsize(860, 560)
        if sys.platform == "win32":
            root.state("zoomed")
        else:
            root.geometry(f"{min(1100, root.winfo_screenwidth() - 40)}x{min(700, root.winfo_screenheight() - 80)}")
        st = ttk.Style()
        try:
            st.theme_use("clam")
        except tk.TclError:
            pass
        st.configure("TCombobox", fieldbackground=C_CARD, background=C_CARD, bordercolor="#D3D7DE", padding=4)
        st.configure("Horizontal.TScale", background=C_CARD, troughcolor="#E6E8EC")

        self._header()
        self._statusbar()
        main = tk.Frame(root, bg=C_BG)
        main.pack(fill="both", expand=True, padx=14, pady=10)
        self._mode_bar(main)
        cards = tk.Frame(main, bg=C_BG)
        cards.pack(fill="x", pady=(10, 0))
        self._distance_card(cards)
        self._motor_card(cards)
        self._led_card(cards)
        self._log(main)

        root.bind("<F5>", lambda e: self.refresh_ports())
        self.refresh_ports()
        if auto_port:
            self.port_var.set(auto_port)
            self.toggle_connect()
        self.render()
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        root.after(50, self.poll)
        root.after(PING_EVERY_MS, self.ping)
        root.after(500, self.tick)

    # ── 화면 ────────────────────────────────────────────────────────
    def card(self, parent, title, **pack):
        c = tk.Frame(parent, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        col = len(parent.grid_slaves(row=0))          # 세 카드를 같은 너비로 — 글이 긴 카드가 옆 카드를 밀지 않게
        c.grid(row=0, column=col, sticky="nsew", **pack)
        parent.columnconfigure(col, weight=1, uniform="card")
        parent.rowconfigure(0, weight=1)
        tk.Label(c, text=title, font=self.f["b"], bg=C_CARD, fg=C_TEXT, anchor="w").pack(fill="x", padx=14, pady=(12, 0))
        return c

    def _header(self):
        bar = tk.Frame(self.root, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        bar.pack(fill="x")
        inner = tk.Frame(bar, bg=C_CARD)
        inner.pack(fill="x", padx=14, pady=8)
        tk.Label(inner, text="추가 회로 점검", font=self.f["title"], bg=C_CARD, fg=C_TEXT).pack(side="left")
        tk.Label(inner, text="  HC-SR04 · 릴레이 DC 모터 · PWM LED", font=self.f["s"], bg=C_CARD, fg=C_FAINT).pack(
            side="left", pady=(3, 0))
        right = tk.Frame(inner, bg=C_CARD)
        right.pack(side="right")
        self.status_lbl = tk.Label(right, text="● 연결 안 됨", font=self.f["b"], bg=LEVEL_BG["idle"],
                                   fg=LEVEL_FG["idle"], padx=10, pady=4)
        self.status_lbl.pack(side="right", padx=(10, 0))
        self.conn_btn = FlatButton(right, "연결", self.toggle_connect, "primary", self.f["b"], padx=16,
                                   tip="고른 포트로 Pico 에 연결합니다")
        self.conn_btn.pack(side="right", padx=(6, 0))
        FlatButton(right, "↻", self.refresh_ports, "secondary", self.f["b"], padx=8,
                   tip="포트 목록 새로고침 (F5)").pack(side="right", padx=(6, 0))
        self.port_var = tk.StringVar()
        self.port_box = ttk.Combobox(right, textvariable=self.port_var, width=30, state="readonly", font=self.f["n"])
        self.port_box.pack(side="right")
        tk.Label(right, text="포트", font=self.f["n"], bg=C_CARD, fg=C_SUB).pack(side="right", padx=(0, 6))

    def _mode_bar(self, parent):
        bar = tk.Frame(parent, bg=LEVEL_BG["idle"])
        bar.pack(fill="x")
        self.mode_parts = [bar]
        self.mode_accent = tk.Frame(bar, bg=LEVEL_FG["idle"], width=5)
        self.mode_accent.pack(side="left", fill="y")
        txt = tk.Frame(bar, bg=LEVEL_BG["idle"])
        txt.pack(side="left", fill="x", expand=True, padx=12, pady=8)
        self.mode_parts.append(txt)
        self.mode_title = tk.Label(txt, text="", font=(self.f["b"][0], 12, "bold"), bg=LEVEL_BG["idle"], fg=C_TEXT,
                                   anchor="w")
        self.mode_title.pack(fill="x")
        self.mode_desc = tk.Label(txt, text="", font=self.f["n"], bg=LEVEL_BG["idle"], fg=C_SUB, anchor="w",
                                  justify="left")
        self.mode_desc.pack(fill="x")
        self.mode_parts += [self.mode_title, self.mode_desc]
        btns = tk.Frame(bar, bg=LEVEL_BG["idle"])
        btns.pack(side="right", padx=12)
        self.mode_parts.append(btns)
        FlatButton(btns, "자동 시험", lambda: self.send("AUTO"), font=self.f["n"],
                   tip="Pico 가 혼자서 모터 2초 켜고 끄기 · LED 0→100→0 을 반복합니다").pack(side="right")
        FlatButton(btns, "수동 조작", lambda: self.send("MOTOR OFF"), font=self.f["n"],
                   tip="자동 시험을 멈추고(모터 꺼짐) 아래 버튼으로 직접 조작합니다").pack(side="right", padx=(0, 6))

    def _distance_card(self, parent):
        c = self.card(parent, "① 초음파 거리 (HC-SR04)", padx=(0, 10))
        self.dist_val = tk.Label(c, text="—", font=self.f["big"], bg=C_CARD, fg=C_TEXT, anchor="w")
        self.dist_val.pack(fill="x", padx=14)
        self.dist_bar = tk.Canvas(c, height=22, bg=C_CARD, highlightthickness=0)
        self.dist_bar.pack(fill="x", padx=14, pady=(4, 2))
        self.dist_spark = tk.Canvas(c, width=260, height=48, bg=C_CARD, highlightthickness=0)
        self.dist_spark.pack(anchor="w", padx=14, pady=(4, 0))
        self.dist_hint = tk.Label(c, text="손을 센서 앞 10~50cm 에서 움직여 보세요", font=self.f["s"], bg=C_CARD,
                                  fg=C_FAINT, anchor="w", justify="left", wraplength=300)
        self.dist_hint.pack(fill="x", padx=14, pady=(4, 12))

    def _motor_card(self, parent):
        c = self.card(parent, "② DC 모터 (포토커플러 + 릴레이)", padx=(0, 10))
        self.motor_state = tk.Label(c, text="—", font=self.f["mid"], bg=C_CARD, fg=C_TEXT, anchor="w")
        self.motor_state.pack(fill="x", padx=14, pady=(8, 8))
        row = tk.Frame(c, bg=C_CARD)
        row.pack(fill="x", padx=14)
        FlatButton(row, "켜기", lambda: self.send("MOTOR ON"), "primary", self.f["b"], padx=22, pady=8,
                   tip="MOTOR ON — GP13 을 LOW 로 → 릴레이 켜짐").pack(side="left")
        FlatButton(row, "끄기", lambda: self.send("MOTOR OFF"), "secondary", self.f["b"], padx=22, pady=8,
                   tip="MOTOR OFF — GP13 을 HIGH 로 → 릴레이 꺼짐").pack(side="left", padx=(8, 0))
        tk.Label(c, text="켜면 릴레이가 「딸깍」 하고 모터가 돌아야 합니다.\n"
                         "수동 조작 중 이 창이 닫히거나 USB 가 빠지면 Pico 가 5초 뒤 모터를 끕니다.",
                 font=self.f["s"], bg=C_CARD, fg=C_FAINT, justify="left", anchor="w", wraplength=300).pack(
            fill="x", padx=14, pady=(10, 12))

    def _led_card(self, parent):
        c = self.card(parent, "③ LED 밝기 (PWM)")
        top = tk.Frame(c, bg=C_CARD)
        top.pack(fill="x", padx=14, pady=(8, 0))
        self.led_canvas = tk.Canvas(top, width=44, height=44, bg=C_CARD, highlightthickness=0)
        self.led_canvas.pack(side="left")
        self.led_val = tk.Label(top, text="—", font=self.f["mid"], bg=C_CARD, fg=C_TEXT)
        self.led_val.pack(side="left", padx=10)
        self.led_var = tk.IntVar(value=0)
        self.led_scale = ttk.Scale(c, from_=0, to=100, orient="horizontal", variable=self.led_var,
                                   command=self.on_led_drag)
        self.led_scale.pack(fill="x", padx=14, pady=(8, 4))
        row = tk.Frame(c, bg=C_CARD)
        row.pack(fill="x", padx=14, pady=(2, 12))
        for p in (0, 25, 50, 100):
            FlatButton(row, f"{p}%", lambda p=p: self.set_led(p), font=self.f["n"], padx=8).pack(side="left", padx=(0, 6))
        # PWM 파형 — 슬라이더 값 그대로 (연결 전에도 움직여 볼 수 있음)
        tk.Label(c, text=f"PWM 파형 · GP22 · {PWM_HZ} Hz", font=self.f["s"], bg=C_CARD, fg=C_SUB, anchor="w").pack(
            fill="x", padx=14)
        self.pwm_canvas = tk.Canvas(c, height=104, bg=C_CARD, highlightthickness=0)
        self.pwm_canvas.pack(fill="x", padx=14, pady=(2, 0))
        self.pwm_canvas.bind("<Configure>", lambda e: self.draw_pwm())
        self.pwm_info = tk.Label(c, text="", font=self.f["s"], bg=C_CARD, fg=C_TEXT, anchor="w", justify="left",
                                 wraplength=300)
        self.pwm_info.pack(fill="x", padx=14, pady=(2, 12))
        self.pwm_info.bind("<Configure>", self._wrap_pwm_info)

    def _log(self, parent):
        box = tk.Frame(parent, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        box.pack(fill="both", expand=True, pady=(10, 0))
        bar = tk.Frame(box, bg=C_CARD)
        bar.pack(fill="x", padx=10, pady=(8, 4))
        tk.Label(bar, text="Pico 메시지", font=self.f["b"], bg=C_CARD, fg=C_TEXT).pack(side="left")
        FlatButton(bar, "지우기", self.clear_log, font=self.f["n"]).pack(side="right")
        FlatButton(bar, "초음파 진단", lambda: self.sonar_report(self.current_sonar_kind(), manual=True),
                   font=self.f["n"], tip="지금 초음파 상태와 확인 방법을 메시지 창에 적습니다").pack(side="right", padx=(0, 6))
        self.show_data = tk.BooleanVar(value=False)
        tk.Checkbutton(bar, text="DATA 줄도 보기", variable=self.show_data, font=self.f["n"], bg=C_CARD, fg=C_SUB,
                       activebackground=C_CARD, selectcolor=C_CARD, highlightthickness=0, bd=0).pack(side="right", padx=10)
        frame = tk.Frame(box, bg=C_CARD)
        frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.log = tk.Text(frame, height=8, font=self.f["mono"], bg="#FBFBFC", fg=C_TEXT, wrap="word", relief="flat",
                           highlightthickness=1, highlightbackground=C_LINE, padx=8, pady=6, state="disabled")
        sb = ttk.Scrollbar(frame, command=self.log.yview)
        self.log.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        self.log.pack(side="left", fill="both", expand=True)
        for tag, col in (("ok", LEVEL_FG["ok"]), ("err", LEVEL_FG["fail"]), ("me", "#0B5CAD"), ("time", "#B0B5BE"),
                         ("app", C_SUB), ("data", C_FAINT), ("warn", LEVEL_FG["warn"]), ("guide", C_SUB)):
            self.log.tag_configure(tag, foreground=col)
        self.log.tag_configure("guide", lmargin1=86, lmargin2=100)     # 점검 순서는 시각 아래로 들여 씀

    def _statusbar(self):
        bar = tk.Frame(self.root, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        bar.pack(side="bottom", fill="x")
        self.v_status = tk.Label(bar, text="", font=self.f["s"], bg=C_CARD, fg=C_SUB, anchor="w")
        self.v_status.pack(side="left", padx=14, pady=4)
        tk.Label(bar, text="TRIG GP10 · ECHO GP11(분압) · 모터 GP13(LOW=켜짐) · LED GP22", font=self.f["s"],
                 bg=C_CARD, fg=C_FAINT).pack(side="right", padx=14)

    # ── 연결 ────────────────────────────────────────────────────────
    def refresh_ports(self):
        self.ports = find_ports()
        labels = [lab for _, lab, _ in self.ports]
        self.port_box["values"] = labels
        if self.ports and not self.port_var.get():
            self.port_var.set(labels[0])
        if pm.serial is None:
            self.set_status("✖ pyserial 없음", "fail")

    def selected_device(self):
        text = self.port_var.get()
        for dev, lab, _ in self.ports:
            if lab == text:
                return dev
        return text.split(" ")[0] if text else None

    def toggle_connect(self):
        if self.worker:
            self.worker.stop()
            self.worker = None
            self.connected = False
            self.conn_btn.set_text("연결")
            self.set_status("○ 연결 끊음", "idle")
            self.app_line("연결을 끊었습니다. (수동 조작 중이었다면 Pico 가 5초 뒤 모터를 끕니다)")
            self.render()
            return
        if pm.serial is None:
            messagebox.showerror("pyserial 없음", "pyserial-3.5-py2.py3-none-any.whl 파일을 이 폴더에 두세요.")
            return
        dev = self.selected_device()
        if not dev:
            messagebox.showinfo("포트 선택", "포트를 먼저 고르세요. 목록이 비어 있으면 ↻ 를 누르세요.")
            return
        self.q = queue.Queue()                  # 끊은 옛 스레드의 메시지가 섞이지 않게
        self.worker = SerialWorker(dev, self.q)
        self.worker.start()
        self.data, self.data_at = None, None
        self.conn_btn.set_text("끊기")
        self.set_status(f"● {dev} 여는 중", "warn")

    def set_status(self, text, level):
        self.status_lbl.configure(text=text, fg=LEVEL_FG[level], bg=LEVEL_BG[level])

    def send(self, cmd, quiet=False):
        if self.worker and self.worker.write((cmd + "\r\n").encode()):
            if not quiet:
                self.add_line("→ " + cmd, "me")
            return True
        if not quiet:
            self.app_line("Pico 에 연결되어 있지 않습니다.")
        return False

    # ── LED ────────────────────────────────────────────────────────
    def on_led_drag(self, _value):
        # 끄는 동안 0.15초에 한 번만 보냅니다
        self.draw_pwm()                         # 파형은 끄는 즉시 바꿉니다
        if self.led_job:
            self.root.after_cancel(self.led_job)
        self.led_job = self.root.after(150, lambda: self.set_led(int(float(self.led_var.get()))))

    def set_led(self, p):
        self.led_job = None
        self.led_var.set(p)
        self.draw_pwm()
        self.send(f"LED {p}")

    # ── 받기 ────────────────────────────────────────────────────────
    def poll(self):
        changed = False
        try:
            while True:
                kind, *rest = self.q.get_nowait()
                changed = True
                if kind == "line":
                    self.on_line(rest[0])
                elif kind == "status":
                    state, msg = rest
                    self.connected = state == "connected"
                    if state == "connected":
                        self.sonar_kind = None          # 다시 연결하면 초음파 상태를 처음부터 알림
                        self.set_status(f"● 연결됨  {msg}", "ok")
                        self.app_line(f"{msg} 에 연결했습니다.")
                        self.send("STATUS", quiet=True)
                    else:
                        self.set_status("● USB 빠짐" if state == "lost" else "● 기다리는 중", "warn")
                        if state == "lost":
                            self.app_line(msg)
        except queue.Empty:
            pass
        if changed:
            self.render()
        self.root.after(50, self.poll)

    def on_line(self, line):
        s = line.strip()
        if s.startswith("DATA "):
            try:
                self.data = json.loads(s[5:])
            except ValueError:
                return
            self.data_at = time.monotonic()
            if self.data.get("dist") is not None:
                self.hist.append(self.data["dist"])
            if self.show_data.get():
                self.add_line(s, "data")
            self.watch_sonar()
            return
        if not s:
            return
        tag = "ok" if s.startswith("OK") else "err" if (s.startswith("ERR") or "실패" in s or "Error" in s
                                                         or s.startswith("Traceback") or "[준비]" in s) else ""
        self.add_line(s, tag)

    def ping(self):
        # 수동 조작 중에만 보냅니다 — 자동 시험은 PC 없이도 돌아가니까
        if self.connected and self.data and self.data.get("mode") == "manual":
            self.send("PING", quiet=True)
        self.root.after(PING_EVERY_MS, self.ping)

    def tick(self):
        self.render()
        self.root.after(500, self.tick)

    # ── 그리기 ──────────────────────────────────────────────────────
    def render(self):
        d = self.data
        stale = self.data_at is None or time.monotonic() - self.data_at > STALE_SECONDS
        # 모드 띠
        if not self.connected:
            level, title, desc = "idle", "Pico 에 연결하세요", "USB 로 Pico 를 꽂고 포트를 고른 뒤 「연결」"
        elif stale:
            level, title, desc = "warn", "Pico 응답 기다리는 중…", \
                "code.py 가 code_extra_circuits.py 인지, 오류가 없는지 아래 메시지를 보세요"
        elif d.get("mode") == "manual":
            level, title, desc = "ok", "수동 조작 중", "아래 버튼과 슬라이더로 모터 · LED 를 직접 움직입니다"
        else:
            level, title, desc = "ok", "자동 시험 중", "Pico 가 혼자서 모터 2초 켜고 끄기 · LED 밝기 0→100→0 을 반복합니다. " \
                                                    "버튼을 누르면 수동 조작으로 바뀝니다"
        for w in self.mode_parts:
            w.configure(bg=LEVEL_BG[level])
        self.mode_accent.configure(bg=LEVEL_FG[level])
        self.mode_title.configure(text=title)
        self.mode_desc.configure(text=desc)

        live = d is not None and not stale
        # ① 거리
        dist = d.get("dist") if live else None
        if live and dist is None:
            self.dist_val.configure(text="---", fg=LEVEL_FG["fail"])
            self.dist_hint.configure(text=d.get("err") or "측정 중…", fg=LEVEL_FG["fail"])
        elif live:
            self.dist_val.configure(text=f"{dist:.1f} cm", fg=C_TEXT)
            self.dist_hint.configure(text="손을 센서 앞 10~50cm 에서 움직여 보세요 — 숫자가 따라 바뀌면 정상", fg=C_FAINT)
        else:
            self.dist_val.configure(text="—", fg=C_FAINT)
        self.draw_bar(dist)
        draw_sparkline(self.dist_spark, self.hist, "#5B616E")
        # ② 모터
        if live:
            on = bool(d.get("motor"))
            self.motor_state.configure(text="● 켜짐" if on else "○ 꺼짐", fg=LEVEL_FG["ok"] if on else C_SUB)
        else:
            self.motor_state.configure(text="—", fg=C_FAINT)
        # ③ LED
        p = d.get("led", 0) if live else None
        self.led_val.configure(text="—" if p is None else f"{p}%")
        self.draw_led(p)
        if live and self.led_job is None and d.get("mode") == "auto":
            self.led_var.set(p)                 # 자동 시험 중에는 슬라이더가 Pico 값을 따라감
        self.draw_pwm()
        # 상태줄
        parts = []
        if live:
            parts.append(f"마지막 수신 {time.monotonic() - self.data_at:.1f}초 전")
            parts.append("수동 조작 — 1초마다 PING" if d.get("mode") == "manual" else "자동 시험")
        self.v_status.configure(text="  ·  ".join(parts) or "—")

    def draw_bar(self, dist):
        c = self.dist_bar
        c.delete("all")
        w = max(c.winfo_width(), 200)
        c.create_rectangle(0, 6, w, 16, fill="#E6E8EC", outline="")
        for cm in (0, 25, 50, 75, 100):
            x = cm / DIST_MAX * (w - 2) + 1
            c.create_line(x, 4, x, 18, fill="#C9CED6")
        if dist is not None:
            x = min(dist, DIST_MAX) / DIST_MAX * w
            c.create_rectangle(0, 6, x, 16, fill="#16181D", outline="")

    def draw_led(self, p):
        c = self.led_canvas
        c.delete("all")
        if p is None:
            c.create_oval(4, 4, 40, 40, fill=C_CARD, outline="#C9CED6", width=2)
            return
        # 밝기에 따라 노란색이 진해집니다 (0% = 회색 테두리만)
        k = p / 100
        base = (238, 240, 243)
        lit = (255, 196, 0)
        col = "#%02x%02x%02x" % tuple(int(b + (l - b) * k) for b, l in zip(base, lit))
        c.create_oval(4, 4, 40, 40, fill=col, outline="#C9CED6" if p == 0 else col, width=2)

    def _wrap_pwm_info(self, e):
        w = max(200, e.width)
        if int(self.pwm_info.cget("wraplength")) != w:  # 같은 값이면 다시 설정하지 않음 (Configure 되풀이 방지)
            self.pwm_info.configure(wraplength=w)

    def draw_pwm(self):
        """지금 슬라이더 밝기의 PWM 파형 — 주기 3개, HIGH 시간 · 평균 전압 표시."""
        c = self.pwm_canvas
        c.delete("all")
        p = max(0, min(100, int(round(float(self.led_var.get())))))
        w = max(c.winfo_width(), 220)
        left, right, top, bot = 40, w - 70, 28, 80         # 그림 영역 (오른쪽 70px 은 평균 전압 글자 자리)
        c.create_text(left - 6, top, text=f"{PWM_V}V", anchor="e", font=self.f["s"], fill=C_SUB)
        c.create_text(left - 6, bot, text="0V", anchor="e", font=self.f["s"], fill=C_SUB)
        c.create_line(left, bot, right, bot, fill="#D3D7DE")
        periods = 3
        pw = (right - left) / periods
        hw = pw * p / 100
        pts = []
        for i in range(periods):
            x0 = left + i * pw
            if p == 0:
                pts += [(x0, bot), (x0 + pw, bot)]
            elif p == 100:
                pts += [(x0, top), (x0 + pw, top)]
            else:
                c.create_rectangle(x0, top, x0 + hw, bot, fill="#EEF0F3", outline="")   # HIGH 인 시간
                pts += [(x0, bot), (x0, top), (x0 + hw, top), (x0 + hw, bot), (x0 + pw, bot)]
        c.create_line(*[v for xy in pts for v in xy], fill="#16181D", width=2)
        # 평균 전압 (점선) — LED 가 느끼는 밝기
        avg = PWM_V * p / 100
        ya = bot - (bot - top) * p / 100
        if 0 < p < 100:
            c.create_line(left, ya, right + 4, ya, fill=C_SUB, dash=(4, 3))
            c.create_text(right + 8, ya, text=f"평균 {avg:.2f}V", anchor="w", font=self.f["s"], fill=C_SUB)
        # 첫 주기 아래에 「1 주기」, 위에 「HIGH」 괄호
        period_ms = 1000 / PWM_HZ
        c.create_line(left, bot + 8, left + pw, bot + 8, fill=C_FAINT, arrow="both", arrowshape=(5, 6, 2))
        c.create_text(left + pw / 2, bot + 12, anchor="n", text=f"1 주기 = {period_ms:g} ms", font=self.f["s"], fill=C_SUB)
        if 0 < p < 100 and hw >= 14:
            c.create_line(left, top - 6, left + hw, top - 6, fill=C_FAINT, arrow="both", arrowshape=(5, 6, 2))
            c.create_text(left + hw / 2, top - 8, anchor="s", text=f"HIGH {period_ms * p / 100:.2f} ms", font=self.f["s"],
                          fill=C_SUB)
        duty = p * 65535 // 100
        if p == 0:
            what = "항상 LOW → LED 꺼짐"
        elif p == 100:
            what = "항상 HIGH → LED 가장 밝음"
        else:
            what = f"1초에 {PWM_HZ}번 켜고 끄기 — 눈은 깜빡임 대신 평균 밝기로 봅니다"
        self.pwm_info.configure(text=f"duty {p}% = duty_cycle {duty} / 65535 · {what}")

    # ── 초음파 연결 상태 → 메시지 창 ────────────────────────────────
    def current_sonar_kind(self):
        d = self.data
        if not self.connected or d is None or self.data_at is None or time.monotonic() - self.data_at > STALE_SECONDS:
            return "nodata"
        kind = d.get("sonar")
        if kind is None:                        # 옛 code.py (sonar 항목 없음)
            kind = "ok" if d.get("dist") is not None else ("timeout" if d.get("err") else "wait")
        return kind

    def watch_sonar(self):
        """DATA 를 받을 때마다 — 상태가 바뀌었을 때만 알립니다."""
        kind = self.current_sonar_kind()
        if kind in ("wait", "nodata") or kind == self.sonar_kind:
            return
        now = time.monotonic()
        if self.sonar_kind == "ok":             # 정상이다가 끊김
            self.sonar_flaps.append(now)
        while self.sonar_flaps and now - self.sonar_flaps[0] > FLAP_WINDOW:
            self.sonar_flaps.popleft()
        self.sonar_kind = kind
        self.sonar_report(kind)
        if len(self.sonar_flaps) >= 3 and now - self.flap_warned_at > FLAP_WINDOW:
            self.flap_warned_at = now
            self.add_line(f"[초음파] ⚠ {FLAP_WINDOW}초 동안 {len(self.sonar_flaps)}번 끊겼다 이어졌습니다 — 접촉 불량 의심", "warn")
            self.add_line("센서 다리를 브레드보드에 꾹 눌러 꽂고, 헐거운 점퍼(특히 ECHO · GND)를 새것으로 바꿔 보세요",
                          "guide", stamp=False)

    def sonar_report(self, kind, manual=False):
        if kind == "nodata":
            self.add_line("[초음파] Pico 데이터가 없습니다 — 먼저 연결하고, code.py 가 code_extra_circuits.py 인지 확인하세요",
                          "warn")
            return
        if kind == "wait":
            self.add_line("[초음파] 첫 측정을 기다리는 중입니다…", "app")
            return
        head, steps = SONAR_GUIDE.get(kind, SONAR_GUIDE["timeout"])
        if kind == "ok":
            head = f"{head} — {self.data.get('dist')} cm 응답"
            if not manual:                      # 저절로 알릴 때는 한 줄만
                steps = steps[:1]
        tag = {"ok": "ok", "range": "warn"}.get(kind, "err")
        self.add_line("[초음파] " + head, tag)
        for line in steps:
            self.add_line(line, "guide", stamp=False)

    # ── 로그 ────────────────────────────────────────────────────────
    def add_line(self, text, tag="", stamp=True):
        self.log.configure(state="normal")
        if stamp:
            self.log.insert("end", datetime.datetime.now().strftime("%H:%M:%S  "), "time")
        self.log.insert("end", text + "\n", tag)
        n = int(self.log.index("end-1c").split(".")[0])
        if n > 2000:
            self.log.delete("1.0", f"{n - 2000}.0")
        self.log.configure(state="disabled")
        self.log.see("end")

    def app_line(self, text):
        self.add_line("[UI] " + text, "app")

    def clear_log(self):
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")

    def on_close(self):
        if self.worker:
            if self.data and self.data.get("mode") == "manual":
                self.send("MOTOR OFF", quiet=True)   # 창을 닫을 때 모터는 꺼 두고 나갑니다
                time.sleep(0.1)
            self.worker.stop()
        self.root.destroy()


def main():
    port = None
    if "--port" in sys.argv:
        i = sys.argv.index("--port")
        if i + 1 < len(sys.argv):
            port = sys.argv[i + 1]
    root = tk.Tk()
    ExtraApp(root, auto_port=port)
    root.mainloop()


if __name__ == "__main__":
    main()
