# -*- coding: utf-8 -*-
"""3차 수행평가 회로 — 회로도 + 배선도 (조이스틱 · 스텝모터 · I2C LCD · RFID-RC522, Pico 2 W)

  부품 사양은 상품 설명서(에듀이노 D-50 · D-53 · D-33 · D-7)에서 확인했다.
  ① 조이스틱 D-50  GND · +5V · VRx · VRy · SW — 가변저항 분압이라 「+5V」 핀에 Pico 3V3 를 넣는다 (5V 면 ADC 최대 3.3V 를 넘음)
  ② 스텝모터 D-53  28BYJ-48 5V + ULN2003 (IN1~IN4, − · + 5~12V) — 모터 전원은 외부 5V 어댑터, GND 공통
  ③ LCD D-33       PCF8574 I2C, VCC 5V · 주소 0x27/0x3F — 모듈 풀업이 SDA·SCL 을 5V 로 올리므로 레벨 변환(BSS138)을 거친다
  ④ RFID D-7       MFRC522, 3.3V 전용(5V 금지) · SPI — 3V3 직결
  핀: GP16 SDA · GP17 SCL · GP10~13 IN1~4 · GP26 VRx · GP27 VRy · GP22 SW · GP20 MISO · GP21 SDA(CS) · GP18 SCK · GP19 MOSI · RC522 RST → 3.3V
  레벨 변환 모듈(CJMCU 4채널, 핀헤더)은 브레드보드 26~31행에 가운데 홈을 걸쳐 **180° 돌려** 꽂는다 — HV 가 왼쪽(5V 레일 · LCD 쪽),
  LV 가 오른쪽(3.3V 레일 쪽). 돌린 순서라 위에서부터 4채널 · 3채널 · GND · HV/LV · 2채널 · 1채널.

배선도는 부품 다리와 점퍼를 데이터로 들고 있다가 브레드보드 넷을 계산해 회로도의 넷과 **같은지 검사한 뒤에만** 저장한다.
브레드보드 · Pico 그림과 넷 계산은 draw_extra_circuits.py 의 것을 그대로 쓴다.

  python3 draw_assessment_circuit.py  →  worksheets/수행평가 회로도 · 수행평가 배선도 · 수행평가 연습 도면 .(pdf|png)
  연습 도면 = 같은 자리에 부품만 (점퍼 · 연결선 · 핀 강조 · 핀 표 없음) — 학습지 뒷면용
"""
import os
import sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch, Circle, PathPatch
from matplotlib.path import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import draw_extra_circuits as base                                 # noqa: E402
from draw_extra_circuits import (Y, XY, COL, RAIL_X, LEFT, RIGHT, node_of, board_base, screw,  # noqa: E402
                                 W_RED, W_BLK, W_5V, OUT_DIR)

W_3V3 = "#c62828"
C = {"SDA": "#2f6fdb", "SCL": "#d9a300", "IN1": "#8d44c9", "IN2": "#2e9e4f", "IN3": "#7a4a21", "IN4": "#5b616e",
     "VRx": "#2e9e4f", "VRy": "#8d44c9", "SW": "#7a4a21",
     "RST": "#5b616e", "MISO": "#d9a300", "MOSI": "#2f6fdb", "SCK": "#2e9e4f", "SS": "#8d44c9"}

# ════════════════════════════════════════════════════════════════════════
#  1. 배선 데이터
# ════════════════════════════════════════════════════════════════════════
LEGS = [("C1", "+", ("L+", 44)), ("C1", "-", ("L-", 44)),       # 470μF (5V 레일, 모터 순간 전류 보충)
        # 레벨 변환 모듈 — 180° 돌려 꽂음: 왼쪽 D열 = HV 쪽, 오른쪽 G열 = LV 쪽
        ("LS", "GND", ("D", 28)), ("LS", "HV", ("D", 29)), ("LS", "HV2", ("D", 30)), ("LS", "HV1", ("D", 31)),
        ("LS", "GNDL", ("G", 28)), ("LS", "LV", ("G", 29)), ("LS", "LV2", ("G", 30)), ("LS", "LV1", ("G", 31))]
LS_ROW0, LS_COLS = 26, ("D", "G")                                 # 모듈 맨 윗줄(4채널)과 두 핀 열
UNUSED_LEGS = [("D", 26), ("D", 27), ("G", 26), ("G", 27)]        # 3 · 4채널 — 꽂혀만 있고 쓰지 않음
OFFBOARD = [
    ("EXT5V", "+", ("L+", 56)), ("EXT5V", "-", ("L-", 56)),
    # LCD (뒷면 I2C 모듈) — SDA · SCL 은 레벨 변환의 HV1 · HV2 행으로
    ("LCD", "VCC", ("L+", 32)), ("LCD", "GND", ("L-", 33)),
    ("LCD", "SDA", ("A", 31)), ("LCD", "SCL", ("A", 30)),
    # 스텝모터 드라이버
    ("ULN", "IN1", ("B", 14)), ("ULN", "IN2", ("B", 15)), ("ULN", "IN3", ("B", 16)), ("ULN", "IN4", ("B", 17)),
    ("ULN", "+", ("L+", 47)), ("ULN", "-", ("L-", 48)),
    # 조이스틱
    ("JOY", "GND", ("R-", 8)), ("JOY", "+5V", ("R+", 9)),
    ("JOY", "VRx", ("J", 10)), ("JOY", "VRy", ("J", 9)), ("JOY", "SW", ("J", 12)),
    # RFID
    ("RC", "3.3V", ("R+", 24)), ("RC", "GND", ("R-", 22)), ("RC", "RST", ("R+", 23)),
    ("RC", "MISO", ("J", 15)), ("RC", "MOSI", ("J", 16)), ("RC", "SCK", ("J", 17)), ("RC", "SDA", ("J", 14)),
]
MODULE_WIRES = []
WIRES = [
    (("I", 5), ("R+", 5), W_3V3),          # Pico 3V3 → 오른쪽 빨강 레일 = 3.3V
    (("I", 18), ("R-", 18), W_BLK),        # Pico GND → 오른쪽 파랑
    (("L-", 60), ("R-", 60), W_BLK),       # 공통 GND 다리
    # 레벨 변환 전원 — 모두 짧은 점퍼
    (("A", 29), ("L+", 29), W_5V),         # HV → 5V
    (("A", 28), ("L-", 28), W_BLK),        # GND(HV 쪽) → GND
    (("J", 29), ("R+", 29), W_3V3),        # LV → 3.3V
    (("J", 28), ("R-", 28), W_BLK),        # GND(LV 쪽) → GND
    # 신호 — Pico GP17 · GP16 행에서 모듈 LV2 · LV1 행으로 (비스듬히, 서로 평행)
    (("I", 19), ("H", 30), C["SCL"]),
    (("J", 20), ("I", 31), C["SDA"]),
]
EXPECTED = [
    {"EXT5V.+", "C1.+", "LCD.VCC", "LS.HV", "ULN.+"},
    {"EXT5V.-", "C1.-", "LCD.GND", "LS.GND", "LS.GNDL", "ULN.-", "JOY.GND", "RC.GND", "Pico.GND"},
    {"Pico.3V3", "LS.LV", "JOY.+5V", "RC.3.3V", "RC.RST"},
    {"Pico.GP16", "LS.LV1"}, {"Pico.GP17", "LS.LV2"}, {"LS.HV1", "LCD.SDA"}, {"LS.HV2", "LCD.SCL"},
    {"Pico.GP10", "ULN.IN1"}, {"Pico.GP11", "ULN.IN2"}, {"Pico.GP12", "ULN.IN3"}, {"Pico.GP13", "ULN.IN4"},
    {"Pico.GP26", "JOY.VRx"}, {"Pico.GP27", "JOY.VRy"}, {"Pico.GP22", "JOY.SW"},
    {"Pico.GP20", "RC.MISO"}, {"Pico.GP19", "RC.MOSI"}, {"Pico.GP18", "RC.SCK"},
    {"Pico.GP21", "RC.SDA"},
]
USED = {"GP10", "GP11", "GP12", "GP13", "GP16", "GP17", "GP18", "GP19", "GP20", "GP21", "GP22", "GP26", "GP27", "3V3"}


def check_netlist():
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    used = {h: "LS.(안 씀)" for h in UNUSED_LEGS}
    for part, leg, hole in LEGS + OFFBOARD:
        if hole[0] not in RAIL_X:
            assert hole not in used, f"{hole} 에 {used.get(hole)} 와 {part}.{leg} 가 겹칩니다"
            used[hole] = f"{part}.{leg}"
        union(f"{part}.{leg}", node_of(hole))
    for a, b, _ in WIRES:
        for h in (a, b):
            if h[0] not in RAIL_X:
                assert h not in used, f"점퍼 끝 {h} 가 {used.get(h)} 와 겹칩니다"
                used[h] = "점퍼"
        union(node_of(a), node_of(b))
    for a, b in MODULE_WIRES:
        union(a, b)
    for i in range(20):
        for side, name in (("L", LEFT[i]), ("R", RIGHT[i])):
            pin = "Pico.GND" if name in ("GND", "AGND") else f"Pico.{name}"
            union(pin, ("strip", side, i + 1))
    nets = {}
    for x in list(parent):
        if isinstance(x, str):
            nets.setdefault(find(x), set()).add(x)
    got = {frozenset(s) for s in nets.values() if not (len(s) == 1 and next(iter(s)).startswith("Pico."))}
    exp = {frozenset(s) for s in EXPECTED}
    assert got == exp, f"배선도 ≠ 회로도\n  회로도에만: {exp - got}\n  배선도에만: {got - exp}"
    return len(got)


# ════════════════════════════════════════════════════════════════════════
#  2. 배선도
# ════════════════════════════════════════════════════════════════════════
BOX = dict(fc="white", ec="none", alpha=0.92, pad=1.0)


def draw_breadboard(practice=False):
    """practice=True → 연습 도면: 같은 자리에 부품만 두고 점퍼 · 연결선 · 핀 강조 · 핀 표를 뺀다 (학생이 그려 넣음)"""
    fig, ax = plt.subplots(figsize=(11.69, 8.27))
    ax.set_xlim(-46, 62)
    ax.set_ylim(-71, 5.4)
    ax.set_aspect("equal")
    ax.axis("off")
    board_base(ax, highlight=not practice, used_pins=USED, used_right_rows=(18,),
               rail_labels=(("외부 5V", W_5V), ("GND", "#2f6fdb"), ("3.3V (Pico)", W_3V3), ("GND", "#2f6fdb")))

    def ends(*pts, color):
        for p in pts:
            ax.add_patch(Circle(p, 0.2, fc=color, ec="white", lw=0.4, zorder=15))

    def route(pts, color, lw=1.6):
        if practice:                       # 연습 도면에는 선을 그리지 않음
            return
        verts, codes = [pts[0]], [Path.MOVETO]
        for i in range(1, len(pts) - 1):
            (x0, y0), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
            r = 0.5
            d1 = max(abs(x1 - x0), abs(y1 - y0)) or 1
            d2 = max(abs(x2 - x1), abs(y2 - y1)) or 1
            a = (x1 - (x1 - x0) * min(r, d1 / 2) / d1, y1 - (y1 - y0) * min(r, d1 / 2) / d1)
            b = (x1 + (x2 - x1) * min(r, d2 / 2) / d2, y1 + (y2 - y1) * min(r, d2 / 2) / d2)
            verts += [a, (x1, y1), b]
            codes += [Path.LINETO, Path.CURVE3, Path.CURVE3]
        verts.append(pts[-1]); codes.append(Path.LINETO)
        ax.add_patch(PathPatch(Path(verts, codes), fc="none", ec=color, lw=lw, zorder=13, capstyle="round",
                               joinstyle="round"))
        ends(pts[0], pts[-1], color=color)

    def to(part, leg):
        return next(XY(h) for p, l, h in OFFBOARD if (p, l) == (part, leg))

    def pin_label(x, y, text, ha, color="#1f3864", fs=5.0):
        ax.text(x, y, text, ha=ha, va="center", fontsize=fs, color=color, fontweight="bold", zorder=14)

    # 보드 위 점퍼 · 커패시터
    for a, b, col in WIRES:
        (x1, y1), (x2, y2) = XY(a), XY(b)
        route([(x1, y1), ((x1 + x2) / 2, y1 + (0.6 if a == ("L-", 60) else 0)), (x2, y2)] if a == ("L-", 60) else
              [(x1, y1), (x2, y2)], col, lw=1.8)
    for x in (RAIL_X["L+"], RAIL_X["L-"]):
        ax.plot([x, x], [Y(44), Y(45.3)], color="#9a9a9a", lw=1.2, zorder=9)
    ax.add_patch(FancyBboxPatch((RAIL_X["L+"] - 0.4, Y(46.6)), 1.8, 1.3, boxstyle="round,pad=0.05,rounding_size=0.25",
                                fc="#3b4a6b", ec="#1f2b45", lw=0.8, zorder=10))
    ax.text(RAIL_X["L+"], Y(45.95), "+", ha="center", va="center", fontsize=7, color="white", fontweight="bold", zorder=12)
    ax.text(-6.0, Y(46.0), "470μF", ha="right", va="center", fontsize=5.0, color="#1f3864", fontweight="bold", zorder=12)
    if not practice:
        ax.text(COL["H"], Y(61.0), "공통 GND", ha="center", va="center", fontsize=5.4, color="#b3261e", fontweight="bold",
                zorder=14, bbox=BOX)

    # ── LCD 앞면 — 180° 돌려 놓음: I2C 핀이 오른쪽(Pico 쪽). 위에서부터 SCL · SDA · VCC · GND ──
    #    (똑바로 놓으면 핀이 왼쪽 끝이라 10cm 점퍼가 닿지 않음 → 돌려 놓고 code.py 의 LCD_FLIP 으로 글자를 뒤집어 그림)
    lx, ltop, lw_, lh = -43.0, 1.9, 26.0, 11.7                        # 80 × 36mm
    ax.add_patch(FancyBboxPatch((lx, Y(ltop + lh)), lw_, lh, boxstyle="round,pad=0.02,rounding_size=0.3",
                                fc="#2e8b3e", ec="#16521f", lw=1.0, zorder=10))
    ax.add_patch(Rectangle((lx + 2.4, Y(ltop + lh - 1.6)), 20.4, lh - 3.2, fc="#1d1d1f", ec="#000", lw=0.6, zorder=11))
    ax.add_patch(Rectangle((lx + 3.4, Y(ltop + lh - 2.8)), 18.4, lh - 5.6, fc="#b7cc3b", ec="#5d6b1a", lw=0.5, zorder=12))
    for k, t in enumerate(("6A 70 F4 BC", "ASCII: jp..")):
        ax.text(lx + 4.0, Y(ltop + 4.6 + k * 2.4), t, ha="left", va="center", fontsize=6.6, color="#1e2a08",
                family="DejaVu Sans Mono", fontweight="bold", zorder=13)
    for hx in (lx + 0.9, lx + lw_ - 0.9):                             # 나사 구멍
        for hy in (ltop + 0.9, ltop + lh - 0.9):
            ax.add_patch(Circle((hx, Y(hy)), 0.45, fc="white", ec="#16521f", lw=0.6, zorder=12))
    ax.text(lx + 1.6, Y(ltop - 0.9), "LCD 1602 — 앞면 · 180° 돌려 놓음 (I2C 핀이 오른쪽)", ha="left", va="center",
            fontsize=5.4, color="#1f3864", fontweight="bold", zorder=14, bbox=BOX)
    ax.text(lx + 12.6, Y(ltop + lh - 0.75), "code.py LCD_FLIP = True → 글자를 뒤집어 그려 똑바로 읽힘", ha="center",
            va="center", fontsize=4.2, color="white", fontweight="bold", zorder=14)
    lcd_pins = {}
    for k, nm in enumerate(("SCL", "SDA", "VCC", "GND")):
        y = Y(ltop + 3.8 + k * 1.3)
        ax.plot([lx + lw_ - 0.6, lx + lw_ + 0.8], [y, y], color="#c9a227", lw=1.6, zorder=12)
        pin_label(lx + lw_ - 0.9, y, nm, "right", color="white", fs=4.4)
        lcd_pins[nm] = (lx + lw_ + 0.8, y)
    # 네 선 모두 오른쪽으로 나와 아래로 — 위 핀일수록 바깥(오른쪽) 길 · 위쪽 끝이라 서로 겹치지 않음
    for nm, lane, col in (("SCL", -12.0, C["SCL"]), ("SDA", -11.4, C["SDA"]), ("VCC", -10.8, W_5V), ("GND", -10.2, W_BLK)):
        p, q = lcd_pins[nm], to("LCD", nm)
        route([p, (lane, p[1]), (lane, q[1]), q], col)

    # ── 레벨 변환 — CJMCU 4채널(BSS138, 파란 기판)을 브레드보드에 180° 돌려 꽂음 (글씨가 거꾸로) ──
    xl, xr = COL[LS_COLS[0]], COL[LS_COLS[1]]
    ax.add_patch(FancyBboxPatch((xl - 0.75, Y(LS_ROW0 + 5.65)), xr - xl + 1.5, 6.3,
                                boxstyle="round,pad=0.02,rounding_size=0.2", fc="#1d4e89", ec="#0c2a4d", lw=1.0,
                                zorder=16))
    order = (("HV4", "LV4"), ("HV3", "LV3"), ("GND", "GND"), ("HV", "LV"), ("HV2", "LV2"), ("HV1", "LV1"))
    for k, (hv, lv) in enumerate(order):
        y = Y(LS_ROW0 + k)
        for x, nm, ha in ((xl, hv, "left"), (xr, lv, "right")):
            ax.add_patch(Circle((x, y), 0.3, fc="#d8d8d8", ec="#c9a227", lw=1.0, zorder=17))
            ax.text(x + (0.42 if ha == "left" else -0.42), y, nm, ha=ha, va="center",
                    fontsize=3.6, color="white", fontweight="bold", rotation=180, zorder=18)
        if k in (0, 1, 4, 5):                                     # BSS138 칩 (채널마다 하나)
            ax.add_patch(Rectangle(((xl + xr) / 2 - 0.4, y - 0.3), 0.8, 0.6, fc="#16181d", zorder=17))
    ax.text(16.4, Y(LS_ROW0 + 2.5), "← 레벨 변환\n180° 돌려 꽂기\n(HV 왼쪽 · 글씨 거꾸로)", ha="left",
            va="center", fontsize=4.6, color="#1f3864", fontweight="bold", zorder=19, bbox=BOX, linespacing=1.25)

    # ── 스텝모터 드라이버 ULN2003 — 사진과 같은 방향(IN 핀 왼쪽, 전원 핀 아래) ──
    ux, utop, uw, uh = -25.0, 33.0, 11.2, 9.8
    ax.add_patch(FancyBboxPatch((ux, Y(utop + uh)), uw, uh, boxstyle="round,pad=0.02,rounding_size=0.2",
                                fc="#2e8b3e", ec="#16521f", lw=1.0, zorder=10))
    ax.add_patch(Rectangle((ux + 2.8, Y(utop + 7.0)), 2.4, 5.8, fc="#1b1b1b", zorder=11))
    ax.text(ux + 4.0, Y(utop + 4.1), "ULN\n2003", ha="center", va="center", fontsize=3.8, color="white", zorder=12, rotation=90)
    ax.add_patch(Rectangle((ux + 6.4, Y(utop + 6.0)), 2.0, 5.0, fc="#f4f4f2", ec="#999", lw=0.5, zorder=11))
    for k in range(4):
        ax.add_patch(Circle((ux + 9.8, Y(utop + 1.6 + k * 1.3)), 0.42, fc="#e2584f", ec="#999", lw=0.4, zorder=11))
        ax.text(ux + 10.7, Y(utop + 1.6 + k * 1.3), "ABCD"[k], ha="left", va="center", fontsize=3.8, color="white", zorder=12)
    uln = {}
    for k, nm in enumerate(("IN1", "IN2", "IN3", "IN4")):
        y = Y(utop + 1.4 + k * 1.2)
        ax.plot([ux, ux - 0.8], [y, y], color="#c9a227", lw=1.6, zorder=12)
        pin_label(ux + 0.35, y, nm, "left", color="white", fs=4.4)
        uln[nm] = (ux - 0.8, y)
    for k, nm in enumerate(("-", "+")):
        x = ux + 3.6 + k * 1.4
        ax.plot([x, x], [Y(utop + uh), Y(utop + uh + 0.8)], color="#c9a227", lw=1.6, zorder=12)
        pin_label(x, Y(utop + uh - 0.6), nm, "center", color="white", fs=5.4)
        uln[nm] = (x, Y(utop + uh + 0.8))
    ax.add_patch(Rectangle((ux + 6.0, Y(utop + uh - 0.2)), 1.6, 0.9, fc="#16181d", zorder=12))
    ax.text(ux + 6.8, Y(utop + uh + 1.3), "On/Off 점퍼\n꽂기", ha="center", va="top", fontsize=4.2, color="#1f3864",
            fontweight="bold", zorder=14, linespacing=1.2)
    ax.text(ux + 6.0, Y(utop - 1.4), "스텝모터 드라이버 ULN2003", ha="right", va="center", fontsize=5.2,
            color="#1f3864", fontweight="bold", zorder=14, bbox=BOX)
    for k, nm in enumerate(("IN1", "IN2", "IN3", "IN4")):
        lane = -26.6 - k * 0.7
        p, q = uln[nm], to("ULN", nm)
        route([p, (lane, p[1]), (lane, q[1]), q], C[nm])
    p = uln["+"]; route([p, (p[0], Y(47.0)), to("ULN", "+")], W_5V)
    p = uln["-"]; route([p, (p[0], Y(48.0)), to("ULN", "-")], W_BLK)
    # 모터 28BYJ-48 + 흰 커넥터 선
    mx, my = -38.0, 46.0
    ax.add_patch(Circle((mx, Y(my)), 4.2, fc="#c9ced6", ec="#7b838f", lw=1.0, zorder=10))
    ax.add_patch(Circle((mx, Y(my)), 1.2, fc="#9aa3ad", ec="#7b838f", zorder=11))
    ax.add_patch(Rectangle((mx - 5.8, Y(my) - 0.6), 11.6, 1.2, fc="#c9ced6", ec="#7b838f", lw=0.6, zorder=9))
    ax.text(mx, Y(my + 5.6), "스텝모터 28BYJ-48 (5V)", ha="center", va="center", fontsize=5.2, color="#1f3864",
            fontweight="bold", zorder=14, bbox=BOX)
    for k, col in enumerate(("#2f6fdb", "#e05a9a", "#e0a100", "#d9a300", "#d92b2b")):
        xk, top_k = mx - 1.6 + k * 0.8, utop - 2.6 - k * 0.0
        cx_ = ux + 6.6 + k * 0.4
        ax.plot([xk, xk, cx_, cx_], [Y(my - 4.0), Y(29.6 - k * 0.35), Y(29.6 - k * 0.35), Y(utop + 1.0)],
                color=col, lw=1.0, zorder=14, solid_joinstyle="round")
    ax.text(ux + 7.4, Y(utop + 0.4), "흰 커넥터", ha="center", va="bottom", fontsize=4.2, color="#1f3864",
            fontweight="bold", zorder=15, bbox=BOX)

    # ── 외부 5V 어댑터 ──
    ax.add_patch(FancyBboxPatch((-22.5, Y(59.5)), 9.0, 5.0, boxstyle="round,pad=0.05,rounding_size=0.4",
                                fc="#f7f7f7", ec="#7b838f", lw=1.0, zorder=10))
    ax.text(-18.0, Y(57.0), "외부 5V 어댑터\n(5V 2A)", ha="center", va="center", fontsize=5.4, color="#1f2328",
            fontweight="bold", zorder=12, linespacing=1.3)
    if practice:                           # 어댑터 출력 단자만 (선은 학생이)
        for yy, sign in ((55.8, "+"), (58.2, "-")):
            ax.plot([-13.5, -12.3], [Y(yy), Y(yy)], color="#7b838f", lw=2.0, zorder=11, solid_capstyle="round")
            ax.add_patch(Circle((-12.3, Y(yy)), 0.25, fc="white", ec="#555", lw=0.6, zorder=12))
            ax.text(-11.7, Y(yy), sign, ha="left", va="center", fontsize=6.0, fontweight="bold", color="#1f2328")
    route([(-13.5, Y(55.8)), (-8.0, Y(55.8)), (-8.0, Y(56)), to("EXT5V", "+")], W_5V, lw=2.0)
    route([(-13.5, Y(58.2)), (-7.2, Y(58.2)), (-7.2, Y(56.6)), to("EXT5V", "-")], W_BLK, lw=2.0)

    # ── 조이스틱 — 핀이 왼쪽 (GND · +5V · VRx · VRy · SW) ──
    jx, jtop, jw, jh = 24.0, 4.5, 13.0, 8.6
    ax.add_patch(FancyBboxPatch((jx, Y(jtop + jh)), jw, jh, boxstyle="round,pad=0.02,rounding_size=0.3",
                                fc="#1d1d1f", ec="#000", lw=1.0, zorder=10))
    ax.add_patch(Circle((jx + 8.0, Y(jtop + jh / 2)), 3.7, fc="#2b2b2b", ec="#555", lw=1.0, zorder=11))
    ax.add_patch(Circle((jx + 8.0, Y(jtop + jh / 2)), 2.4, fc="#111", zorder=12))
    ax.text(jx + jw / 2, Y(jtop - 1.0), "조이스틱 모듈", ha="center", va="center", fontsize=5.2, color="#1f3864",
            fontweight="bold", zorder=14, bbox=BOX)
    joy = {}
    for k, nm in enumerate(("GND", "+5V", "VRx", "VRy", "SW")):
        y = Y(jtop + 1.6 + k * 1.35)
        ax.plot([jx, jx - 1.0], [y, y], color="#c9a227", lw=1.6, zorder=12)
        pin_label(jx + 0.4, y, nm, "left", color="white", fs=4.6)
        joy[nm] = (jx - 1.0, y)
    jc = {"GND": W_BLK, "+5V": W_3V3, "VRx": C["VRx"], "VRy": C["VRy"], "SW": C["SW"]}
    for k, nm in enumerate(("GND", "+5V", "VRx", "VRy", "SW")):
        p, q = joy[nm], to("JOY", nm)
        lane = 21.6 - k * 0.8
        route([p, (lane, p[1]), (lane, q[1]), q], jc[nm])
    ax.text(jx + jw + 1.0, Y(jtop + jh / 2), "★ +5V 핀에는\n3.3V 레일!", ha="left", va="center", fontsize=5.0,
            color=W_3V3, fontweight="bold", zorder=14, bbox=BOX)

    # ── RFID-RC522 — 180° 돌려 놓음: 핀이 왼쪽(Pico 쪽), 위에서부터 SDA · SCK · MOSI · MISO · IRQ · GND · RST · 3.3V ──
    #    (사진 방향이면 핀이 오른쪽 끝이라 10cm 점퍼가 짧음)
    rx, rtop, rw, rh = 30.0, 24.0, 18.0, 12.0
    ax.add_patch(FancyBboxPatch((rx, Y(rtop + rh)), rw, rh, boxstyle="round,pad=0.02,rounding_size=0.3",
                                fc="#1f5f7a", ec="#0f3a4a", lw=1.0, zorder=10))
    for r in (1.2, 2.4, 3.6):                                          # 안테나 (돌려 놓아 오른쪽)
        ax.add_patch(Circle((rx + rw - 6.5, Y(rtop + rh / 2)), r, fc="none", ec="#9fc4d3", lw=0.8, zorder=11))
    ax.text(rx + rw - 6.5, Y(rtop + 1.2), "RFID-RC522", ha="center", va="center", fontsize=5.0, color="white",
            fontweight="bold", rotation=180, zorder=12)
    ax.add_patch(Rectangle((rx + rw - 14.7, Y(rtop + 7.2)), 2.2, 2.2, fc="#16181d", zorder=11))
    ax.text(rx + rw / 2, Y(rtop + rh + 1.2), "RFID 리더기 — 180° 돌려 놓음 (핀이 왼쪽 · SDA 맨 위) · 3.3V 전용 · RST 도 3.3V",
            ha="center", va="center", fontsize=5.0, color="#1f3864", fontweight="bold", zorder=14, bbox=BOX)
    rc = {}
    names = ("SDA", "SCK", "MOSI", "MISO", "IRQ", "GND", "RST", "3.3V")
    for k, nm in enumerate(names):
        y = Y(rtop + 1.4 + k * 1.3)
        ax.plot([rx, rx - 1.0], [y, y], color="#c9a227", lw=1.6, zorder=12)
        ax.text(rx + 0.4, y, nm, ha="left", va="center", fontsize=4.2, color="white", fontweight="bold",
                rotation=180, zorder=14)                               # 기판 글씨도 거꾸로
        rc[nm] = (rx - 1.0, y)
    ax.text(rx - 1.3, rc["IRQ"][1], "비움", ha="right", va="center", fontsize=4.4, color="#5b616e", zorder=14)
    rcol = {"3.3V": W_3V3, "RST": W_3V3, "GND": W_BLK, "MISO": C["MISO"], "MOSI": C["MOSI"], "SCK": C["SCK"], "SDA": C["SS"]}
    # 위 핀일수록 모듈 가까운 길 — 전원 3개는 서로 겹치지 않음 (SCK · MOSI · MISO 는 Pico 핀 순서가 반대라 조금 엇갈림)
    lanes = {"SDA": 27.6, "SCK": 26.8, "MOSI": 26.0, "MISO": 25.2, "GND": 24.4, "RST": 23.6, "3.3V": 22.8}
    for nm in names:
        if nm == "IRQ":
            continue
        p, q = rc[nm], to("RC", nm)
        route([p, (lanes[nm], p[1]), (lanes[nm], q[1]), q], rcol[nm])

    # ── 제목 · 주의 ──
    ax.text(-45.0, 3.6, "수행평가 배선 연습" if practice else "수행평가 배선도", ha="left", va="center", fontsize=13,
            fontweight="bold", color="#1f3864")
    ax.text(-45.0, 1.4, "조이스틱 → 스텝모터 · RFID 카드 번호 → LCD  (Pico 2 W)", ha="left", va="center", fontsize=6.4,
            color="#555")
    notes = [
        ("★ 조이스틱 「+5V」 핀은 3.3V 레일에 — 5V 를 넣으면 Pico ADC(최대 3.3V)를 넘습니다.", W_3V3),
        ("★ RC522 는 3.3V 전용 — 5V 에 꽂으면 망가질 수 있습니다.", W_3V3),
        ("★ 스텝모터 · LCD 는 외부 5V(어댑터). GND 는 Pico · 어댑터 · 모든 모듈 공통.", "#b3261e"),
        ("★ LCD 의 SDA · SCL 은 레벨 변환을 거쳐서(5V 풀업 → Pico 보호). 모듈은 HV 가 왼쪽이 되게 180° 돌려 꽂기.", "#b3261e"),
        ("★ 레벨 변환 핀 두 줄 사이가 브레드보드 4칸이면 D 대신 E 열에 — 같은 행이면 연결은 같습니다.", "#b3261e"),
        ("★ 전원 순서: 켤 때 USB 먼저 → 어댑터, 끌 때 · 선 바꿀 때 어댑터 먼저.", "#b3261e"),
    ]
    for i, (t, col) in enumerate(notes):
        ax.text(19.0, Y(42.0 + i * 1.9), t, ha="left", va="center", fontsize=5.6, color=col, fontweight="bold")
    if practice:
        ax.text(62.0, 3.6, "학번 ________   이름 ______________", ha="right", va="center", fontsize=8.5, color="#1f2328")
        ax.text(19.0, Y(53.6), "선 색 약속", ha="left", va="center", fontsize=7, fontweight="bold", color="#1f3864")
        for i, (col, t) in enumerate(((W_5V, "외부 5V"), (W_3V3, "3.3V"), (W_BLK, "GND"),
                                      ("#2f6fdb", "신호 (서로 다른 색)"))):
            x0 = 19.0 + i * 9.6
            ax.plot([x0, x0 + 2.4], [Y(55.4), Y(55.4)], color=col, lw=2.6, solid_capstyle="round")
            ax.text(x0 + 3.0, Y(55.4), t, ha="left", va="center", fontsize=5.6)
        ax.text(19.0, Y(57.6), "다 그린 뒤 확인", ha="left", va="center", fontsize=7, fontweight="bold", color="#1f3864")
        checks = ("□ Pico 3V3 → 오른쪽 + 레일, GND → - 레일, 왼쪽 - 와 오른쪽 - 레일 잇기",
                  "□ 어댑터 + → 왼쪽 + 레일(5V), - → 왼쪽 - 레일",
                  "□ 레벨 변환: HV · LV 전원과 GND 두 곳, LV1 · LV2 → Pico, HV1 · HV2 → LCD",
                  "□ 조이스틱 5개 · ULN2003 6개 · RC522 7개(IRQ 비움) — 핀 번호는 앞면 회로도")
        for i, t in enumerate(checks):
            ax.text(19.0, Y(59.4 + i * 1.7), t, ha="left", va="center", fontsize=5.6)
        return fig
    rows = [("GP16 · GP17", "LCD SDA · SCL (레벨 변환)"), ("GP10~GP13", "ULN2003 IN1~IN4"), ("GP26 · GP27 · GP22", "조이스틱 VRx · VRy · SW"),
            ("GP18 · GP19 · GP20 · GP21", "RC522 SCK · MOSI · MISO · SDA (RST → 3.3V)")]
    ax.text(19.0, Y(53.6), "핀", ha="left", va="center", fontsize=7, fontweight="bold", color="#1f3864")
    for i, (a, b) in enumerate(rows):
        ax.text(19.0, Y(55.6 + i * 1.8), a, ha="left", va="center", fontsize=5.8, fontweight="bold")
        ax.text(36.0, Y(55.6 + i * 1.8), b, ha="left", va="center", fontsize=5.8)
    return fig


# ════════════════════════════════════════════════════════════════════════
#  3. 회로도 (블록 · 핀 · 전원 기호)
# ════════════════════════════════════════════════════════════════════════
def draw_schematic():
    fig, ax = plt.subplots(figsize=(11.69, 8.27))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 70.7)
    ax.set_aspect("equal")
    ax.axis("off")
    INK, LW = "#16181d", 1.3

    def line(*pts, color=INK, lw=LW, ls="-"):
        xs, ys = zip(*pts)
        ax.plot(xs, ys, color=color, lw=lw, ls=ls, solid_capstyle="round", zorder=3)

    def text(x, y, s, **kw):
        kw.setdefault("ha", "center"); kw.setdefault("va", "center"); kw.setdefault("fontsize", 6.6)
        kw.setdefault("color", INK)
        ax.text(x, y, s, zorder=6, **kw)

    def box(x0, y0, x1, y1, title, fc="#fafbfc"):
        ax.add_patch(FancyBboxPatch((x0, y0), x1 - x0, y1 - y0, boxstyle="round,pad=0.05,rounding_size=0.5",
                                    fc=fc, ec=INK, lw=1.2, zorder=2))
        text((x0 + x1) / 2, y1 + 1.0, title, fontsize=7.2, fontweight="bold", color="#1f3864")

    def dot(x, y):
        ax.add_patch(Circle((x, y), 0.32, fc=INK, zorder=5))

    def v5(x, y, label="+5V (외부)"):
        line((x - 1.0, y), (x + 1.0, y), color=W_5V, lw=1.8); line((x, y), (x, y - 0.8), color=W_5V)
        text(x, y + 0.9, label, fontsize=6.0, color="#b35a00", fontweight="bold")

    def v33(x, y):
        line((x - 1.0, y), (x + 1.0, y), color=W_3V3, lw=1.8); line((x, y), (x, y - 0.8), color=W_3V3)
        text(x, y + 0.9, "3.3V", fontsize=6.0, color=W_3V3, fontweight="bold")

    def gnd(x, y):
        line((x, y), (x, y - 0.8))
        for k, w in enumerate((1.2, 0.8, 0.4)):
            line((x - w, y - 0.8 - k * 0.45), (x + w, y - 0.8 - k * 0.45), lw=1.2)

    def pin(x, y, name, side, color=INK):
        ax.add_patch(Circle((x, y), 0.3, fc="white", ec=INK, lw=1.0, zorder=5))
        text(x + (0.7 if side == "r" else -0.7), y, name, ha="left" if side == "r" else "right", fontsize=6.0,
             fontweight="bold", color=color)

    text(2, 68.6, "수행평가 회로도 — 조이스틱 · 스텝모터 · I2C LCD · RFID (Pico 2 W)", ha="left", fontsize=11,
         fontweight="bold", color="#1f3864")
    text(2, 66.4, "전원: 외부 5V(어댑터) = 스텝모터 · LCD · 레벨 변환 HV   │   Pico 3V3 = 조이스틱 · RC522 · 레벨 변환 LV   │   GND 모두 공통",
         ha="left", fontsize=6.6, color="#5b616e")

    # ── Pico 2 W ──
    px0, px1, py0, py1 = 44, 56, 14.5, 60
    ax.add_patch(FancyBboxPatch((px0, py0), px1 - px0, py1 - py0, boxstyle="round,pad=0.1,rounding_size=0.8",
                                fc="#e8f2ec", ec="#1f6b4e", lw=1.6, zorder=2))
    text(50, 21.5, "Raspberry Pi\nPico 2 W", fontsize=8.4, fontweight="bold", color="#1f6b4e", linespacing=1.4)
    L = {"GP16": 56, "GP17": 53, "GP10": 44, "GP11": 41, "GP12": 38, "GP13": 35, "GND ": 17}
    R = {"3V3": 57, "GP26": 52, "GP27": 49, "GP22": 46, "GP21": 36, "GP18": 33, "GP19": 30, "GP20": 27, "GND": 17}
    for n, y in L.items():
        pin(px0, y, n.strip(), "r")
    for n, y in R.items():
        pin(px1, y, n, "l")
    line((px0 - 0.3, 17), (px0 - 2.0, 17)); gnd(px0 - 2.0, 17)
    line((px1 + 0.3, 17), (px1 + 2.0, 17)); gnd(px1 + 2.0, 17)

    # ── ① I2C LCD + 레벨 변환 (왼쪽 위) ──
    box(22, 46.8, 32, 60, "레벨 변환 CJMCU 4채널(BSS138)")
    for n, y in (("LV1", 56), ("LV2", 53), ("LV", 50.5)):
        pin(32, y, n, "l")
    for n, y in (("HV1", 56), ("HV2", 53), ("HV", 50.5)):
        pin(22, y, n, "r")
    for y in (56, 53):
        line((32.3, y), (px0 - 0.3, y), color=C["SDA"] if y == 56 else C["SCL"])
    text(38, 56.8, "SDA", fontsize=5.6, color=C["SDA"]); text(38, 53.8, "SCL", fontsize=5.6, color=C["SCL"])
    line((32.3, 50.5), (35, 50.5), color=W_3V3)
    text(35.4, 50.5, "3.3V", ha="left", fontsize=6.0, color=W_3V3, fontweight="bold")
    pin(32, 48, "GND", "l"); line((32.3, 48), (34, 48)); gnd(34, 48)
    pin(22, 48, "GND", "r"); line((21.7, 48), (20.6, 48)); gnd(20.6, 48)
    # 레벨 변환 안 (한 채널 원리)
    ax.add_patch(Rectangle((24.0, 49.2), 6.0, 0.01, fc="none"))
    text(27, 58.6, "N-MOSFET + 풀업\n양쪽 10kΩ", fontsize=5.0, color="#8a909c", linespacing=1.2)
    text(27, 45.4, "브레드보드에는 180° 돌려 꽂음 (HV 왼쪽 · 26~31행)", fontsize=5.0, color="#5b616e")
    box(4, 46.6 + 0.6, 15, 60, "LCD 1602 (I2C, PCF8574)")
    for n, y in (("SDA", 56), ("SCL", 53), ("VCC", 50.5)):
        pin(15, y, n, "l")
    line((15.3, 56), (21.7, 56), color=C["SDA"]); line((15.3, 53), (21.7, 53), color=C["SCL"])
    line((15.3, 50.5), (21.7, 50.5), color=W_5V); dot(18.5, 50.5); line((18.5, 50.5), (18.5, 51.5), color=W_5V)
    text(18.5, 52.0, "+5V(외부)", fontsize=5.2, color="#b35a00", fontweight="bold")
    pin(15, 48, "GND", "l"); line((15.3, 48), (17.0, 48)); gnd(17.0, 48)
    text(9.5, 45.6, "주소 0x27 · 0x3F", fontsize=5.6, color="#8a909c")
    text(7.4, 53.0, "180° 돌려 놓고\nLCD_FLIP 으로\n글자 뒤집기", fontsize=5.2, color="#b3261e", linespacing=1.3)

    # ── ② 스텝모터 (왼쪽 아래) ──
    box(22, 30, 32, 43.0, "ULN2003 드라이버")
    for n, y in (("IN1", 41.5), ("IN2", 39.0), ("IN3", 36.5), ("IN4", 34.0)):
        pin(32, y, n, "l")
    for (n, gy), y in zip((("GP10", 44), ("GP11", 41), ("GP12", 38), ("GP13", 35)), (41.5, 39.0, 36.5, 34.0)):
        line((32.3, y), (38, y), (38, gy), (px0 - 0.3, gy), color=C[{"GP10": "IN1", "GP11": "IN2", "GP12": "IN3", "GP13": "IN4"}[n]])
    pin(25, 30, "", "r"); pin(29, 30, "", "r")
    text(25, 31.3, "+", fontsize=7, fontweight="bold"); text(29, 31.3, "-", fontsize=7, fontweight="bold")
    line((25, 29.7), (25, 27.5)); v5(25, 27.5 + 0.0) if False else None
    text(25, 26.6, "+5V(외부)", fontsize=5.8, color="#b35a00", fontweight="bold")
    gnd(29, 29.7)
    # 모터 (4상 코일)
    ax.add_patch(Circle((10, 37.5), 4.0, fc="white", ec=INK, lw=1.3, zorder=3))
    text(10, 37.5, "M", fontsize=12, fontweight="bold")
    text(10, 32.4, "28BYJ-48 (5V)", fontsize=6.0, fontweight="bold")
    for k, y in enumerate((40.5, 38.5, 36.5, 34.5)):
        line((14.0, y), (21.7, y), color=("#2f6fdb", "#e05a9a", "#d9a300", "#e0a100")[k], lw=1.0)
    line((10, 41.5), (10, 43.5), color=W_RED, lw=1.0); text(10, 44.3, "공통(빨강)", fontsize=5.0, color=W_RED)
    text(18, 42.3, "A B C D", fontsize=5.2, color="#5b616e")
    text(12, 28.4, "반 스텝 4096 = 1바퀴 · 약 200~240mA", fontsize=5.6, color="#5b616e")

    # ── ③ 조이스틱 (오른쪽 위) ──
    box(70, 44, 90, 60, "조이스틱 모듈")
    for n, y in (("VRx", 56), ("VRy", 52.5), ("SW", 47.5)):
        pin(70, y, n, "r")
    for n, gy, y in (("VRx", 52, 56), ("VRy", 49, 52.5), ("SW", 46, 47.5)):
        line((px1 + 0.3, gy), (63, gy), (63, y), (69.7, y), color=C[n])
    # 가변저항 2개 + 스위치
    for k, y in enumerate((56, 52.5)):
        x = 82 + k * 4.5
        line((x, 58.6), (x, 57.6)); ax.add_patch(Rectangle((x - 0.5, 53.6), 1.0, 4.0, fc="white", ec=INK, lw=1.0, zorder=4))
        line((x, 53.6), (x, 52.6 - k * 0.0))
        line((x + 1.6, 55.6), (x + 0.6, 55.6), color=INK, lw=1.0)
        ax.annotate("", xy=(x + 0.55, 55.6), xytext=(x + 1.8, 55.6), arrowprops=dict(arrowstyle="-|>", lw=0.8, color=INK))
        text(x, 59.4, "X" if k == 0 else "Y", fontsize=5.6, fontweight="bold")
    line((82, 58.6), (86.5, 58.6)); line((82, 52.6), (86.5, 52.6))
    line((83.8, 55.6), (78, 55.6), (78, 56), (70.3, 56), color=C["VRx"], lw=1.0)
    line((88.3, 55.6), (88.8, 55.6), (88.8, 51.5), (76, 51.5), (76, 52.5), (70.3, 52.5), color=C["VRy"], lw=1.0)
    line((84, 58.6), (84, 61.0), color=W_3V3); v33(84, 61.8)
    text(85.6, 62.7, "← 「+5V」 핀", ha="left", fontsize=5.4, color=W_3V3, fontweight="bold")
    line((84, 52.6), (84, 50.6)); gnd(84, 50.6)
    line((72.5, 47.5), (76, 47.5)); line((76, 47.5), (77.8, 48.6), lw=1.2); line((78, 47.5), (79.5, 47.5)); gnd(79.5, 47.5)
    text(77, 45.4, "누르면 LOW · Pico 내부 풀업", fontsize=5.0, color="#5b616e")

    # ── ④ RC522 (오른쪽 아래) ──
    box(70, 18, 90, 41, "RFID-RC522 (MFRC522 · SPI)")
    pin(70, 38.5, "RST", "r"); line((69.7, 38.5), (66.5, 38.5), color=W_3V3)
    text(66.2, 38.5, "3.3V", ha="right", fontsize=6.0, color=W_3V3, fontweight="bold")
    rcpins = (("SDA(CS)", 36, 35.5), ("SCK", 33, 32.5), ("MOSI", 30, 29.5), ("MISO", 27, 26.5))
    rcc = {"RST": C["RST"], "SDA(CS)": C["SS"], "SCK": C["SCK"], "MOSI": C["MOSI"], "MISO": C["MISO"]}
    for k, (n, gy, y) in enumerate(rcpins):
        pin(70, y, n, "r")
        lane = 60 + k * 1.2
        line((px1 + 0.3, gy), (lane, gy), (lane, y), (69.7, y), color=rcc[n])
    pin(80, 18, "", "r"); pin(86, 18, "", "r")
    text(80, 19.3, "3.3V", fontsize=6.0, fontweight="bold"); text(86, 19.3, "GND", fontsize=6.0, fontweight="bold")
    line((80, 17.7), (80, 15.8), color=W_3V3); text(80, 14.9, "3.3V (5V 금지!)", fontsize=6.0, color=W_3V3, fontweight="bold")
    gnd(86, 17.7)
    text(80, 23.5, "IRQ 비움 · 13~26mA", fontsize=5.6, color="#5b616e")
    text(80, 21.6, "모듈은 180° 돌려 놓음 (핀이 왼쪽 · SDA 맨 위)", fontsize=5.2, color="#b3261e")
    # 3V3 핀 → 레일
    line((px1 + 0.3, 57), (60, 57), (60, 62.4), color=W_3V3); v33(60, 63.2)
    text(64.0, 63.6, "← Pico 3V3 출력 (조이스틱 · RC522 · LV)", ha="left", fontsize=5.6, color=W_3V3)

    # ── 아래: 연동 확인 ──
    rows = [("부품", "전압 · 전류", "인터페이스 · 결론"),
            ("조이스틱 D-50", "가변저항 분압 · 수 mA 이하", "ADC(GP26 · 27) + 디지털(GP22). +5V 핀에 3.3V → 출력 0~3.3V"),
            ("28BYJ-48 + ULN2003 D-53", "5V · 약 200~240mA", "IN 4개(3.3V 로 구동 OK). 별도 5V 전원 필요 — Pico 3V3 불가, USB 공유는 리셋 위험"),
            ("LCD 1602 I2C D-33", "5V · 약 20~30mA(백라이트)", "I2C 0x27/0x3F. 5V 풀업 → 레벨 변환 거쳐 GP16 · GP17"),
            ("RC522 D-7", "3.3V 전용 · 13~26mA(최대 30)", "SPI0 1MHz. 3V3 직결(RST 도 3.3V), 5V 금지")]
    for i, (a, b, c) in enumerate(rows):
        y = 10.6 - i * 2.0
        fw = "bold" if i == 0 else "normal"
        text(2, y, a, ha="left", fontsize=6.0, fontweight="bold"); text(22, y, b, ha="left", fontsize=6.0, fontweight=fw)
        text(44, y, c, ha="left", fontsize=6.0, fontweight=fw)
    line((2, 11.6), (98, 11.6), color="#c9ced6", lw=0.8)
    return fig


def schematic_for_sheet():
    """학습지 앞면용 회로도 — 제목과 아래 부품 표(학습지 본문과 겹침)를 빼고 글자를 1.25배로 (작게 인쇄돼도 읽히게)"""
    fig = draw_schematic()
    ax = fig.axes[0]
    for t in list(ax.texts):
        y = t.get_position()[1]
        if y > 65.2 or y < 12.6:
            t.remove()
        elif t.get_color() != "#1f3864" and y < 62.5:  # 상자 제목 · 맨 위 전원 표시는 그대로 (커지면 서로 겹침)
            t.set_fontsize(t.get_fontsize() * 1.25)
    for ln in list(ax.lines):                          # 표 위 구분선
        if max(ln.get_ydata()) < 12.6:
            ln.remove()
    ax.set_ylim(12.6, 65.2)
    return fig


if __name__ == "__main__":
    n = check_netlist()
    print(f"넷 {n}개 — 배선도와 회로도가 같습니다")
    for name, fig in (("수행평가 회로도", draw_schematic()), ("수행평가 배선도", draw_breadboard()),
                      ("수행평가 연습 도면", draw_breadboard(practice=True))):
        for ext in ("png", "pdf"):
            out = os.path.join(OUT_DIR, f"{name}.{ext}")
            fig.savefig(out, dpi=250, bbox_inches="tight", facecolor="white")
            print("saved", os.path.normpath(out))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "수행평가_회로도_학습지용.png")
    schematic_for_sheet().savefig(out, dpi=300, bbox_inches="tight", facecolor="white")
    print("saved", os.path.normpath(out))
