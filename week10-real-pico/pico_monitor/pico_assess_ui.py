# pico_assess_ui.py — 3차 수행평가 회로 점검 UI (Windows · Python 3.9 이상, 설치 없음)
#
#   Pico 의 code.py = assessment/code.py (조이스틱 · 스텝모터 · I2C LCD · RFID-RC522) 와 USB 시리얼로 주고받습니다.
#     · 한 줄 판정 + 점검 칸 8개 (연결 · 코드 · LCD · RC522 · 조이스틱 가운데 · 버튼 · 모터 · 카드)
#     · 조이스틱: 과녁 안에서 점이 기울기를 따라 움직임, X · Y %, 버튼
#     · 스텝모터: 각도 바늘, -90° · +90° · 한 바퀴 · 멈춤 · 0° 맞추기
#     · LCD · RFID: LCD 두 줄을 실물처럼, 마지막 카드 번호 · 시각, 글자 넣기 → LCD
#     · 메시지 창: Pico 출력, 장치별 원인 안내 (「점검 안내」 버튼으로 언제든)
#
#   실행: 이 폴더의 run_assess_ui.bat 더블클릭, 또는  py pico_assess_ui.py  [--port COM5]
#   pico_monitor.py 의 시리얼 연결(SerialWorker · 포트 찾기 · 자동 재연결)과 버튼 · 색을 그대로 씁니다.

import datetime
import json
import math
import os
import queue
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pico_monitor as pm                     # noqa: E402  (같은 폴더)
from pico_monitor import (tk, ttk, messagebox, FlatButton, SerialWorker, find_ports, pick_font,  # noqa: E402
                          C_BG, C_CARD, C_LINE, C_TEXT, C_SUB, C_FAINT, LEVEL_FG, LEVEL_BG)

STALE_SECONDS = 3          # DATA(0.2초마다)가 이만큼 안 오면 「응답 없음」
DEAD = 7                   # code.py 의 가운데 정지 범위 (±%)
CENTER_OK = (20000, 45000)  # 조이스틱 가운데 원값(0~65535)이 이 안이면 정상
LCD_BG, LCD_INK, LCD_CELL = "#B7CC3B", "#1E2A08", "#A9BE30"     # 실물 LCD 색 (녹색 백라이트)

CHIPS = ["연결", "코드", "LCD", "RC522", "조이스틱 가운데", "버튼", "모터", "카드"]

# 장치별 안내 — (머리줄, 점검 순서)
GUIDE = {
    "LCD": ("✖ LCD 를 찾지 못했습니다 (I2C 주소 응답 없음)", [
        "① LCD 모듈: VCC → 외부 5V(왼쪽 빨강 레일), GND → GND",
        "② 레벨 변환(파란 기판): 왼쪽 LV → 3.3V 레일, 오른쪽 HV → 5V 레일, 오른쪽 GND → GND",
        "③ 신호: GP4 → LV1, HV1 → LCD SDA / GP5 → LV2, HV2 → LCD SCL — SDA · SCL 이 바뀌지 않았는지",
        "④ 외부 5V 어댑터가 켜져 있는지 (LCD · 레벨 변환 HV 가 여기서 전원을 받습니다)",
        "⑤ 고친 뒤 Pico 를 다시 시작(Ctrl+D 또는 USB 다시 꽂기) — 주소는 시작할 때만 찾습니다",
    ]),
    "LCD_BLANK": ("⚠ LCD 는 응답하지만 글자가 안 보이면", [
        "① 뒷면 파란 가변저항(대비)을 드라이버로 천천히 돌리기 — 네모 칸만 보이거나 아무것도 안 보일 때",
        "② 백라이트가 꺼져 있으면 뒷면 백라이트 점퍼가 꽂혀 있는지",
    ]),
    "RC522": ("✖ RC522 가 응답하지 않습니다", [
        "① 전원: 3.3V → 3.3V 레일(5V 금지!), GND → GND",
        "② SPI: SCK → GP18, MOSI → GP19, MISO → GP16, SDA(CS) → GP17, RST → GP20, IRQ 비움",
        "③ 모듈 핀머리를 납땜했는지 — 꽂기만 하면 접촉이 불안정합니다",
        "④ 고친 뒤 Pico 를 다시 시작(Ctrl+D 또는 USB 다시 꽂기)",
    ]),
    "RC522_VER": ("⚠ RC522 버전이 0x91 · 0x92 가 아닙니다", [
        "· 0x12 · 0xB2 · 0x88 은 호환 칩입니다 — 대부분 그대로 동작합니다. 카드를 대서 번호가 나오면 정상",
        "· 0x00 · 0xFF 처럼 나오면 MISO(GP16) 연결과 3.3V 를 확인하세요",
    ]),
    "JOY": ("✖ 조이스틱 가운데 값이 이상합니다", [
        "① 조이스틱 「+5V」 핀 → 3.3V 레일 (5V 레일이면 ADC 한계를 넘습니다)",
        "② GND → GND, VRx → GP26, VRy → GP27",
        "③ 시작할 때 조이스틱을 건드리지 않았는지 — 가운데 값은 시작할 때 잽니다",
    ]),
    "MOTOR": ("모터가 안 돌거나 떨기만 하면", [
        "① ULN2003 의 + → 외부 5V, − → GND, On/Off 점퍼가 꽂혀 있는지",
        "② IN1~IN4 → GP10~GP13 순서, 흰 커넥터를 끝까지 꽂았는지",
        "③ 조이스틱을 기울이면 ULN2003 의 LED A~D 가 차례로 깜빡여야 합니다 — LED 는 깜빡이는데 안 돌면 전원 · 커넥터",
    ]),
    "CARD": ("카드를 대도 번호가 안 나오면", [
        "① 리더기 가운데 원 무늬에 1~3cm 로 가까이 — 금속 책상 위는 피하기",
        "② 함께 온 흰 카드 · 파란 키태그(13.56MHz)인지 — 교통카드 · 신용카드는 안 될 수 있습니다",
    ]),
}


class AssessApp:
    def __init__(self, root, auto_port=None):
        font_ui = pick_font(["Malgun Gothic", "맑은 고딕", "Noto Sans CJK KR", "NanumGothic"], "TkDefaultFont")
        font_mono = pick_font(["Consolas", "D2Coding", "NanumGothicCoding", "DejaVu Sans Mono"], "TkFixedFont")
        pm.FONT_UI = font_ui
        self.f = {"title": (font_ui, 13, "bold"), "b": (font_ui, 10, "bold"), "n": (font_ui, 10),
                  "s": (font_ui, 9), "mid": (font_ui, 18, "bold"), "mono": (font_mono, 9),
                  "lcd": (font_mono, 17, "bold"), "uid": (font_mono, 15, "bold")}
        self.root = root
        self.q = queue.Queue()
        self.worker = None
        self.connected = False
        self.ports = []
        self.data = None
        self.data_at = None
        self.seen_press = False          # 이번 연결에서 버튼을 한 번이라도 눌렀나
        self.seen_move = False           # 모터가 한 번이라도 돌았나
        self.card_at = None              # 마지막 카드를 읽은 시각
        self.reported = set()            # 이미 메시지 창에 안내한 문제

        root.title("수행평가 회로 점검 — 조이스틱 · 스텝모터 · LCD · RFID")
        root.configure(bg=C_BG)
        root.minsize(960, 640)
        if sys.platform == "win32":
            root.state("zoomed")
        else:
            root.geometry(f"{min(1180, root.winfo_screenwidth() - 40)}x{min(780, root.winfo_screenheight() - 60)}")
        st = ttk.Style()
        try:
            st.theme_use("clam")
        except tk.TclError:
            pass
        st.configure("TCombobox", fieldbackground=C_CARD, background=C_CARD, bordercolor="#D3D7DE", padding=4)

        self._header()
        self._statusbar()
        main = tk.Frame(root, bg=C_BG)
        main.pack(fill="both", expand=True, padx=14, pady=10)
        self._verdict(main)
        cards = tk.Frame(main, bg=C_BG)
        cards.pack(fill="x", pady=(10, 0))
        self._joy_card(cards)
        self._motor_card(cards)
        self._lcd_card(cards)
        self._log(main)

        root.bind("<F5>", lambda e: self.refresh_ports())
        self.refresh_ports()
        if auto_port:
            self.port_var.set(auto_port)
            self.toggle_connect()
        self.render()
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        root.after(50, self.poll)
        root.after(500, self.tick)

    # ── 화면 ────────────────────────────────────────────────────────
    def card(self, parent, title, **pack):
        c = tk.Frame(parent, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        col = len(parent.grid_slaves(row=0))
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
        tk.Label(inner, text="수행평가 회로 점검", font=self.f["title"], bg=C_CARD, fg=C_TEXT).pack(side="left")
        tk.Label(inner, text="  조이스틱 · 스텝모터 · I2C LCD · RFID-RC522", font=self.f["s"], bg=C_CARD,
                 fg=C_FAINT).pack(side="left", pady=(3, 0))
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

    def _verdict(self, parent):
        bar = tk.Frame(parent, bg=LEVEL_BG["idle"])
        bar.pack(fill="x")
        self.v_parts = [bar]
        self.v_accent = tk.Frame(bar, bg=LEVEL_FG["idle"], width=5)
        self.v_accent.pack(side="left", fill="y")
        txt = tk.Frame(bar, bg=LEVEL_BG["idle"])
        txt.pack(side="left", fill="x", expand=True, padx=12, pady=8)
        self.v_title = tk.Label(txt, text="", font=(self.f["b"][0], 12, "bold"), bg=LEVEL_BG["idle"], fg=C_TEXT,
                                anchor="w")
        self.v_title.pack(fill="x")
        self.v_desc = tk.Label(txt, text="", font=self.f["n"], bg=LEVEL_BG["idle"], fg=C_SUB, anchor="w", justify="left")
        self.v_desc.pack(fill="x")
        self.v_parts += [txt, self.v_title, self.v_desc]
        chips = tk.Frame(parent, bg=C_BG)
        chips.pack(fill="x", pady=(8, 0))
        self.chips = {}
        for i, name in enumerate(CHIPS):
            box = tk.Frame(chips, bg=LEVEL_BG["idle"], highlightthickness=0)
            box.grid(row=0, column=i, sticky="nsew", padx=(0 if i == 0 else 6, 0))
            chips.columnconfigure(i, weight=1, uniform="chip")
            head = tk.Label(box, text="… " + name, font=self.f["b"], bg=LEVEL_BG["idle"], fg=LEVEL_FG["idle"], anchor="w")
            head.pack(fill="x", padx=8, pady=(5, 0))
            val = tk.Label(box, text="—", font=self.f["s"], bg=LEVEL_BG["idle"], fg=C_SUB, anchor="w")
            val.pack(fill="x", padx=8, pady=(0, 5))
            self.chips[name] = (box, head, val)

    def _joy_card(self, parent):
        c = self.card(parent, "① 조이스틱 → 모터 방향 · 속도", padx=(0, 10))
        self.joy_cv = tk.Canvas(c, width=210, height=210, bg=C_CARD, highlightthickness=0)
        self.joy_cv.pack(pady=(8, 4))
        self.joy_val = tk.Label(c, text="X —   Y —", font=self.f["mid"], bg=C_CARD, fg=C_TEXT)
        self.joy_val.pack()
        self.joy_btn = tk.Label(c, text="버튼 —", font=self.f["b"], bg=LEVEL_BG["idle"], fg=LEVEL_FG["idle"],
                                padx=10, pady=3)
        self.joy_btn.pack(pady=(6, 4))
        tk.Label(c, text=f"가운데 ±{DEAD}% 는 정지 · 좌우(X)로 모터 방향과 속도 · 버튼 = 지금 위치를 0°",
                 font=self.f["s"], bg=C_CARD, fg=C_FAINT, wraplength=300, justify="center").pack(padx=10, pady=(0, 12))

    def _motor_card(self, parent):
        c = self.card(parent, "② 스텝모터 28BYJ-48", padx=(0, 10))
        self.dial = tk.Canvas(c, width=210, height=210, bg=C_CARD, highlightthickness=0)
        self.dial.pack(pady=(8, 4))
        self.motor_val = tk.Label(c, text="—", font=self.f["mid"], bg=C_CARD, fg=C_TEXT)
        self.motor_val.pack()
        self.motor_state = tk.Label(c, text="", font=self.f["n"], bg=C_CARD, fg=C_SUB)
        self.motor_state.pack(pady=(2, 6))
        row = tk.Frame(c, bg=C_CARD)
        row.pack(pady=(0, 4))
        for text, cmd, tip in (("−90°", "MOVE -90", "반시계로 90° 돌고 멈춤 (반 스텝 1024개)"),
                               ("+90°", "MOVE +90", "시계로 90° 돌고 멈춤"),
                               ("한 바퀴", "MOVE 360", "한 바퀴(반 스텝 4096개) — 약 9초"),
                               ("멈춤", "STOP", "바로 멈춤")):
            FlatButton(row, text, lambda c_=cmd: self.send(c_), font=self.f["n"], tip=tip, padx=10).pack(
                side="left", padx=3)
        FlatButton(c, "0° 맞추기", lambda: self.send("ZERO"), font=self.f["n"],
                   tip="지금 위치를 0° 로 (조이스틱 버튼과 같음)").pack(pady=(4, 12))

    def _lcd_card(self, parent):
        c = self.card(parent, "③ RFID 카드 → LCD 1602")
        self.lcd_cv = tk.Canvas(c, width=330, height=96, bg=C_CARD, highlightthickness=0)
        self.lcd_cv.pack(pady=(10, 2))
        self.lcd_info = tk.Label(c, text="", font=self.f["s"], bg=C_CARD, fg=C_FAINT)
        self.lcd_info.pack()
        tk.Label(c, text="마지막 카드", font=self.f["s"], bg=C_CARD, fg=C_SUB).pack(pady=(10, 0))
        self.uid_val = tk.Label(c, text="—", font=self.f["uid"], bg=C_CARD, fg=C_TEXT)
        self.uid_val.pack()
        self.uid_time = tk.Label(c, text="카드를 리더기 가운데에 대 보세요", font=self.f["s"], bg=C_CARD, fg=C_FAINT)
        self.uid_time.pack()
        form = tk.Frame(c, bg=C_CARD)
        form.pack(fill="x", padx=14, pady=(12, 4))
        tk.Label(form, text="LCD 글자 넣기 (영문 · 숫자, 줄마다 16자)", font=self.f["s"], bg=C_CARD, fg=C_SUB,
                 anchor="w").grid(row=0, column=0, columnspan=2, sticky="w")
        self.lcd1, self.lcd2 = tk.StringVar(value="Hello Pico 2 W"), tk.StringVar(value="LCD test OK")
        for r, var in ((1, self.lcd1), (2, self.lcd2)):
            tk.Label(form, text=f"{r}줄", font=self.f["s"], bg=C_CARD, fg=C_FAINT).grid(row=r, column=0, sticky="w")
            e = tk.Entry(form, textvariable=var, font=self.f["mono"], relief="flat", highlightthickness=1,
                         highlightbackground="#D3D7DE", highlightcolor="#16181D", width=18)
            e.grid(row=r, column=1, sticky="ew", pady=2, padx=(6, 0))
            e.bind("<Return>", lambda _e: self.send_lcd())
        form.columnconfigure(1, weight=1)
        FlatButton(c, "LCD 에 보내기", self.send_lcd, "primary", self.f["n"],
                   tip="두 줄을 Pico 로 보내 LCD 에 씁니다 — 글자가 보이면 I2C · 레벨 변환 · 대비 모두 정상").pack(pady=(4, 12))

    def _log(self, parent):
        box = tk.Frame(parent, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        box.pack(fill="both", expand=True, pady=(10, 0))
        bar = tk.Frame(box, bg=C_CARD)
        bar.pack(fill="x", padx=10, pady=(8, 4))
        tk.Label(bar, text="Pico 메시지", font=self.f["b"], bg=C_CARD, fg=C_TEXT).pack(side="left")
        FlatButton(bar, "지우기", self.clear_log, font=self.f["n"]).pack(side="right")
        FlatButton(bar, "점검 안내", self.guide_all, font=self.f["n"],
                   tip="지금 문제가 있는 장치와 확인 순서를 메시지 창에 적습니다").pack(side="right", padx=(0, 6))
        self.show_data = tk.BooleanVar(value=False)
        tk.Checkbutton(bar, text="DATA 줄도 보기", variable=self.show_data, font=self.f["n"], bg=C_CARD, fg=C_SUB,
                       activebackground=C_CARD, selectcolor=C_CARD, highlightthickness=0, bd=0).pack(side="right", padx=10)
        frame = tk.Frame(box, bg=C_CARD)
        frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.log = tk.Text(frame, height=7, font=self.f["mono"], bg="#FBFBFC", fg=C_TEXT, wrap="word", relief="flat",
                           highlightthickness=1, highlightbackground=C_LINE, padx=8, pady=6, state="disabled")
        sb = ttk.Scrollbar(frame, command=self.log.yview)
        self.log.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        self.log.pack(side="left", fill="both", expand=True)
        for tag, col in (("ok", LEVEL_FG["ok"]), ("err", LEVEL_FG["fail"]), ("me", "#0B5CAD"), ("time", "#B0B5BE"),
                         ("app", C_SUB), ("data", C_FAINT), ("warn", LEVEL_FG["warn"]), ("guide", C_SUB)):
            self.log.tag_configure(tag, foreground=col)
        self.log.tag_configure("guide", lmargin1=86, lmargin2=100)

    def _statusbar(self):
        bar = tk.Frame(self.root, bg=C_CARD, highlightbackground=C_LINE, highlightthickness=1)
        bar.pack(side="bottom", fill="x")
        tk.Label(bar, text="LCD GP4 SDA · GP5 SCL(레벨 변환) · 모터 GP10~13 · 조이스틱 GP26 · GP27 · GP22 · "
                           "RC522 GP16~20", font=self.f["s"], bg=C_CARD, fg=C_FAINT).pack(side="right", padx=14, pady=4)

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
            if self.connected and self.data and self.data.get("mode") == "pc":
                self.send("STOP", quiet=True)          # PC 명령으로 도는 중이면 멈추고 끊습니다
                time.sleep(0.1)
            self.worker.stop()
            self.worker = None
            self.connected = False
            self.conn_btn.set_text("연결")
            self.set_status("○ 연결 끊음", "idle")
            self.app_line("연결을 끊었습니다.")
            self.render()
            return
        if pm.serial is None:
            messagebox.showerror("pyserial 없음", "pyserial-3.5-py2.py3-none-any.whl 파일을 이 폴더에 두세요.")
            return
        dev = self.selected_device()
        if not dev:
            messagebox.showinfo("포트 선택", "포트를 먼저 고르세요. 목록이 비어 있으면 ↻ 를 누르세요.")
            return
        self.q = queue.Queue()
        self.worker = SerialWorker(dev, self.q)
        self.worker.start()
        self.data, self.data_at = None, None
        self.seen_press = self.seen_move = False
        self.reported.clear()
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

    def send_lcd(self):
        a, b = self.lcd1.get(), self.lcd2.get()
        if not (a + b).isascii() or "|" in a + b:
            self.app_line("LCD 는 영문 · 숫자 · 기호만 쓸 수 있습니다(한글 ✖, 「|」 ✖). 글자를 고쳐 주세요.")
            return
        if len(a) > 16 or len(b) > 16:
            self.app_line("한 줄은 16자까지입니다 — 넘는 글자는 LCD 에서 잘립니다.")
        self.send(f"LCD {a[:16]}|{b[:16]}")

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
                d = json.loads(s[5:])
            except ValueError:
                return
            prev = self.data
            self.data, self.data_at = d, time.monotonic()
            if d.get("sw"):
                self.seen_press = True
            if d.get("moving"):
                self.seen_move = True
            if d.get("uid") and (prev is None or prev.get("uid") != d.get("uid")) and self.card_at is None:
                self.card_at = datetime.datetime.now()
            if self.show_data.get():
                self.add_line(s, "data")
            self.watch()
            return
        if not s:
            return
        if s.startswith("[RFID] 카드 UID:"):
            self.card_at = datetime.datetime.now()
        tag = "ok" if s.startswith("OK") else "err" if (s.startswith("ERR") or "못 찾음" in s or "응답 없음" in s
                                                         or "Error" in s or s.startswith("Traceback")) else \
            "warn" if s.startswith("[주의]") else ""
        self.add_line(s, tag)
        if "LCD 를 못 찾음" in s:
            self.report("LCD")
        elif "RC522 응답 없음" in s:
            self.report("RC522")
        elif s.startswith("[주의] 조이스틱"):
            self.report("JOY")

    def tick(self):
        self.render()
        self.root.after(500, self.tick)

    # ── 판정 ────────────────────────────────────────────────────────
    def live(self):
        return self.connected and self.data is not None and time.monotonic() - self.data_at <= STALE_SECONDS

    def checks(self):
        """{칸 이름: (level, 짧은 값)}"""
        d = self.data or {}
        live = self.live()
        out = {"연결": ("ok", "연결됨") if self.connected else ("idle", "연결 안 됨")}
        if not self.connected:
            return {n: out.get(n, ("idle", "—")) for n in CHIPS}
        out["코드"] = ("ok", "DATA 받는 중") if live else ("warn", "응답 기다림")
        if not live:
            return {n: out.get(n, ("idle", "—")) for n in CHIPS}
        out["LCD"] = ("ok", "주소 " + d["lcd_addr"]) if d.get("lcd_addr") else ("fail", "못 찾음")
        ver = d.get("rc_ver") or ""
        out["RC522"] = ("fail", "응답 없음") if not ver else ("ok", "버전 " + ver) if ver in ("0x91", "0x92") \
            else ("warn", f"버전 {ver} (호환 칩)")
        cx, cy = d.get("cx", 0), d.get("cy", 0)
        ok_c = all(CENTER_OK[0] <= v <= CENTER_OK[1] for v in (cx, cy))
        out["조이스틱 가운데"] = ("ok" if ok_c else "fail", f"X {cx} · Y {cy}")
        out["버튼"] = ("ok", "눌림 확인") if self.seen_press else ("idle", "한 번 눌러 보기")
        out["모터"] = ("ok", f"돎 · {d.get('angle', 0):.0f}°") if self.seen_move else ("idle", "기울이거나 +90°")
        out["카드"] = ("ok", d["uid"]) if d.get("uid") else ("idle", "카드 대 보기")
        return out

    def watch(self):
        """문제가 처음 보이면 메시지 창에 한 번 안내합니다 (DATA 로 알게 된 것)."""
        c = self.checks()
        for chip, key in (("LCD", "LCD"), ("RC522", "RC522"), ("조이스틱 가운데", "JOY")):
            if c[chip][0] == "fail":
                self.report(key)
        if c["RC522"][0] == "warn":
            self.report("RC522_VER")

    def report(self, key, manual=False):
        if key in self.reported and not manual:
            return
        self.reported.add(key)
        head, steps = GUIDE[key]
        self.add_line(f"[{key.split('_')[0]}] " + head, "err" if head.startswith("✖") else "warn")
        for line in steps:
            self.add_line(line, "guide", stamp=False)

    def guide_all(self):
        if not self.connected:
            self.app_line("먼저 Pico 에 연결하세요. 목록에 Pico 가 없으면 USB 케이블(데이터용)과 ↻ 를 확인하세요.")
            return
        if not self.live():
            self.app_line("DATA 가 오지 않습니다 — CIRCUITPY 의 code.py 가 assessment/code.py 인지, "
                          "lcd_i2c.py · mfrc522_lite.py 를 함께 넣었는지, 아래에 오류(Traceback)가 없는지 보세요.")
            return
        c = self.checks()
        keys = [k for chip, k in (("LCD", "LCD"), ("RC522", "RC522"), ("조이스틱 가운데", "JOY")) if c[chip][0] == "fail"]
        if c["RC522"][0] == "warn":
            keys.append("RC522_VER")
        if not self.seen_move:
            keys.append("MOTOR")
        if not self.data.get("uid") and c["RC522"][0] != "fail":
            keys.append("CARD")
        for k in keys:
            self.report(k, manual=True)
        if not keys:
            self.app_line("모든 점검을 통과했습니다. 실물 LCD 에 글자가 안 보이면 아래를 확인하세요.")
        if c["LCD"][0] == "ok":
            self.report("LCD_BLANK", manual=True)

    # ── 그리기 ──────────────────────────────────────────────────────
    def render(self):
        c = self.checks()
        d = self.data if self.live() else None
        levels = [lv for lv, _ in c.values()]
        if not self.connected:
            level, title, desc = "idle", "Pico 에 연결하세요", "USB 로 Pico 를 꽂고 포트를 고른 뒤 「연결」 (외부 5V 어댑터도 켜기)"
        elif d is None:
            level, title, desc = "warn", "Pico 응답 기다리는 중…", \
                "code.py 가 assessment/code.py 인지, lcd_i2c.py · mfrc522_lite.py 를 함께 넣었는지 아래 메시지를 보세요"
        elif "fail" in levels:
            bad = [n for n, (lv, _) in c.items() if lv == "fail"]
            level, title, desc = "fail", "✖ 확인할 것: " + " · ".join(bad), "아래 메시지 창의 순서대로 배선을 확인하세요 (「점검 안내」 버튼)"
        elif "idle" in levels:
            todo = [n for n, (lv, _) in c.items() if lv == "idle"]
            level, title, desc = "warn" if "warn" in levels else "ok", "장치 응답 정상 — 직접 해 볼 것: " + " · ".join(todo), \
                "조이스틱을 좌우로 기울이고, 버튼을 누르고, 카드를 대 보세요"
        else:
            level, title, desc = ("warn" if "warn" in levels else "ok"), "✔ 모두 정상", \
                "조이스틱 → 모터, 카드 → LCD 가 모두 동작합니다"
        for w in self.v_parts:
            w.configure(bg=LEVEL_BG[level])
        self.v_accent.configure(bg=LEVEL_FG[level])
        self.v_title.configure(text=title)
        self.v_desc.configure(text=desc)
        for name, (lv, val) in c.items():
            box, head, vlab = self.chips[name]
            for w in (box, head, vlab):
                w.configure(bg=LEVEL_BG[lv])
            head.configure(text=pm.LEVEL_ICON[lv] + " " + name, fg=LEVEL_FG[lv])
            vlab.configure(text=val)

        # ① 조이스틱
        jx, jy = (d["jx"], d["jy"]) if d else (None, None)
        self.draw_joy(jx, jy)
        if d:
            self.joy_val.configure(text=f"X {jx:+d}%   Y {jy:+d}%", fg=C_TEXT)
            lv = "ok" if d.get("sw") else "idle"
            self.joy_btn.configure(text="버튼 눌림" if d.get("sw") else "버튼 안 눌림", bg=LEVEL_BG[lv], fg=LEVEL_FG[lv])
        else:
            self.joy_val.configure(text="X —   Y —", fg=C_FAINT)
            self.joy_btn.configure(text="버튼 —", bg=LEVEL_BG["idle"], fg=LEVEL_FG["idle"])

        # ② 모터
        self.draw_dial(d["angle"] if d else None, d["moving"] if d else 0)
        if d:
            self.motor_val.configure(text=f"{d['angle']:.1f}°", fg=C_TEXT)
            mv = d.get("moving", 0)
            by = {"joy": "조이스틱", "pc": "PC 명령"}.get(d.get("mode"), "")
            self.motor_state.configure(
                text=("정지 (코일 꺼짐)" if mv == 0 else ("시계 방향" if mv > 0 else "반시계 방향") + f" 도는 중 · {by}")
                + f" · 반 스텝 {d['pos']}", fg=LEVEL_FG["ok"] if mv else C_SUB)
        else:
            self.motor_val.configure(text="—", fg=C_FAINT)
            self.motor_state.configure(text="", fg=C_SUB)

        # ③ LCD · 카드
        self.draw_lcd(d["lcd"] if d else None, on=bool(d and d.get("lcd_addr")))
        self.lcd_info.configure(text=(f"Pico 가 LCD 에 쓴 내용 · 주소 {d['lcd_addr']}" if d and d.get("lcd_addr") else
                                      "LCD 를 찾지 못함 — Pico 가 쓰려던 내용만 흐리게 보여 줍니다" if d else ""))
        uid = (d or self.data or {}).get("uid") if self.data else ""
        self.uid_val.configure(text=uid or "—", fg=C_TEXT if uid else C_FAINT)
        if uid and self.card_at:
            self.uid_time.configure(text=self.card_at.strftime("%H:%M:%S 에 읽음"), fg=C_FAINT)
        elif d and not d.get("rc_ver"):
            self.uid_time.configure(text="RC522 가 응답하지 않아 카드를 읽을 수 없습니다", fg=LEVEL_FG["fail"])
        elif not uid:
            self.uid_time.configure(text="카드를 리더기 가운데에 대 보세요", fg=C_FAINT)

    def draw_joy(self, jx, jy):
        cv = self.joy_cv
        cv.delete("all")
        cx = cy = 105
        r = 92
        cv.create_oval(cx - r, cy - r, cx + r, cy + r, outline=C_LINE, width=2, fill="#FBFBFC")
        cv.create_line(cx - r, cy, cx + r, cy, fill=C_LINE)
        cv.create_line(cx, cy - r, cx, cy + r, fill=C_LINE)
        dz = r * DEAD / 100
        cv.create_rectangle(cx - dz, cy - r, cx + dz, cy + r, outline="", fill="#F0F2F5")      # X 정지 범위
        cv.create_line(cx - r, cy, cx + r, cy, fill=C_LINE)
        cv.create_line(cx, cy - r, cx, cy + r, fill=C_LINE)
        cv.create_text(cx - r + 4, cy - 10, text="◀ 반시계", anchor="w", fill=C_FAINT, font=self.f["s"])
        cv.create_text(cx + r - 4, cy - 10, text="시계 ▶", anchor="e", fill=C_FAINT, font=self.f["s"])
        if jx is None:
            return
        x = cx + r * max(-100, min(100, jx)) / 100 * 0.92
        y = cy - r * max(-100, min(100, jy)) / 100 * 0.92
        col = LEVEL_FG["ok"] if abs(jx) > DEAD else C_TEXT
        cv.create_line(cx, cy, x, y, fill=col, width=2)
        cv.create_oval(x - 9, y - 9, x + 9, y + 9, fill=col, outline="white", width=2)

    def draw_dial(self, angle, moving):
        cv = self.dial
        cv.delete("all")
        cx = cy = 105
        r = 88
        cv.create_oval(cx - r, cy - r, cx + r, cy + r, outline=C_LINE, width=2, fill="#FBFBFC")
        for k in range(36):
            a = math.radians(k * 10)
            r0 = r - (10 if k % 9 == 0 else 5)
            cv.create_line(cx + r0 * math.sin(a), cy - r0 * math.cos(a), cx + r * math.sin(a), cy - r * math.cos(a),
                           fill=C_SUB if k % 9 == 0 else C_LINE, width=2 if k % 9 == 0 else 1)
        for k, t in enumerate(("0°", "90°", "180°", "270°")):
            a = math.radians(k * 90)
            cv.create_text(cx + (r - 22) * math.sin(a), cy - (r - 22) * math.cos(a), text=t, fill=C_FAINT,
                           font=self.f["s"])
        if angle is None:
            return
        a = math.radians(angle % 360)
        col = LEVEL_FG["ok"] if moving else C_TEXT
        cv.create_line(cx, cy, cx + (r - 40) * math.sin(a), cy - (r - 40) * math.cos(a), fill=col, width=4,
                       capstyle="round")
        cv.create_oval(cx - 7, cy - 7, cx + 7, cy + 7, fill=col, outline="")

    def draw_lcd(self, lines, on=True):
        cv = self.lcd_cv
        cv.delete("all")
        w, h = 330, 96
        cv.create_rectangle(2, 2, w - 2, h - 2, fill="#2E8B3E", outline="#16521F", width=2)       # 초록 기판
        x0, y0, cw, ch = 17, 16, 18.5, 30
        on = on and lines is not None
        cv.create_rectangle(x0 - 6, y0 - 6, x0 + 16 * cw + 6, y0 + 2 * ch + 8, fill=LCD_BG if on else "#8E9A5C",
                            outline="#1E2A08")
        for r in range(2):
            text = (lines[r] if lines and r < len(lines) else "").ljust(16)[:16]
            for k in range(16):
                x, y = x0 + k * cw, y0 + r * (ch + 2)
                cv.create_rectangle(x + 1, y, x + cw - 1, y + ch, fill=LCD_CELL if on else "#86925A", outline="")
                if text[k] != " ":
                    cv.create_text(x + cw / 2, y + ch / 2, text=text[k], fill=LCD_INK if on else "#4E5636",
                                   font=self.f["lcd"])

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
            if self.data and self.data.get("mode") == "pc":
                self.send("STOP", quiet=True)
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
    AssessApp(root, auto_port=port)
    root.mainloop()


if __name__ == "__main__":
    main()
