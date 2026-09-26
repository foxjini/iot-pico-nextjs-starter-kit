# -*- coding: utf-8 -*-
"""최종 배선도 (Pico 2 W + 830홀 브레드보드)

1·2·3·8·9·11·12주차 내내 하드웨어가 바뀌지 않으므로, 기본 회로는
draw_wiring.py(1주차 배선도)와 동일하게 두고 아래 두 가지를 더했다.

  ① 팀 프로젝트용으로 비어 있는 브레드보드 영역 표시
  ② 남은 핀 / 금지 핀 / 전원 규칙 / 5V 신호 경고

CdS 분압의 방향은 바꾸지 않는다. 코드가 light_percent = 100 - raw%
이므로 '어두울 때 raw가 커야' 하고, 그러려면 10kΩ이 3V3 쪽,
CdS가 GND 쪽이어야 한다. (반대로 꽂으면 무드등이 정반대로 동작)
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch, Circle, FancyArrowPatch, PathPatch
from matplotlib.path import Path

plt.rcParams["font.family"] = "NanumGothic"
plt.rcParams["axes.unicode_minus"] = False

COL = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 7, "G": 8, "H": 9, "I": 10, "J": 11}
RAIL_L_RED, RAIL_L_BLU = -4, -3
RAIL_R_RED, RAIL_R_BLU = 14, 15
NROWS = 63


def Y(r):
    return -float(r)


def P(c, r):
    return (COL[c], Y(r))


C_BOARD, C_EDGE, C_CH, C_HOLE = "#f4f2ee", "#c9c4bc", "#e0dbd3", "#8d8880"
C_PICO, C_PICO_E = "#1f6b4e", "#123f2c"
W_RED, W_BLK, W_5V = "#d92b2b", "#222222", "#ff8000"
C_FREE = "#cfe6d8"          # 팀 확장용 빈 영역 표시
SIG = {"GP16": "#d9a300", "GP17": "#d63384", "GP18": "#2e9e4f",
       "GP19": "#2f6fdb", "GP26": "#8d44c9", "GP15": "#ff8000"}

fig, ax = plt.subplots(figsize=(8.27, 11.69))
ax.set_xlim(-8.5, 48.5)
ax.set_ylim(-68, 5.5)
ax.axis("off")

# ---------- 브레드보드 ----------
ax.add_patch(FancyBboxPatch((-5.4, Y(64.0)), 21.9, 64.0,
                            boxstyle="round,pad=0.25,rounding_size=0.6",
                            fc=C_BOARD, ec=C_EDGE, lw=1.4, zorder=1))
ax.add_patch(Rectangle((4.55, Y(63.7)), 1.9, 63.4, fc=C_CH, ec="none", zorder=2))

# ★ 팀 확장용 빈 영역 (왼쪽 뱅크 A~E, 28~63행) — 홀보다 아래 레이어로 깔아 홀이 보이게
ax.add_patch(FancyBboxPatch((COL["A"] - 0.75, Y(63.6)), 5.5, 35.9,
                            boxstyle="round,pad=0.08,rounding_size=0.3",
                            fc=C_FREE, ec="#6aa98a", lw=0.9, ls=(0, (4, 2)),
                            alpha=0.55, zorder=2.5))
ax.text(COL["A"] + 0.5, Y(45.5), "우리 팀 부품 자리 — 비어 있음", ha="center", va="center",
        rotation=90, fontsize=7.0, color="#2f7a55", fontweight="bold", zorder=2.6)


def hole(x, r, s=0.34):
    ax.add_patch(Rectangle((x - s / 2, Y(r) - s / 2), s, s,
                           fc="white", ec=C_HOLE, lw=0.5, zorder=3))


for r in range(1, NROWS + 1):
    for c in COL:
        hole(COL[c], r)

rail_rows = [2 + 6 * g + k for g in range(10) for k in range(5)]
for r in rail_rows:
    for x in (RAIL_L_RED, RAIL_L_BLU, RAIL_R_RED, RAIL_R_BLU):
        hole(x, r)

for x, c in ((RAIL_L_RED, W_RED), (RAIL_R_RED, W_RED)):
    ax.plot([x - 0.8] * 2, [Y(1.5), Y(61.5)], color=c, lw=1.5, zorder=2)
for x, c in ((RAIL_L_BLU, "#2f6fdb"), (RAIL_R_BLU, "#2f6fdb")):
    ax.plot([x + 0.8] * 2, [Y(1.5), Y(61.5)], color=c, lw=1.5, zorder=2)
for x, s, c in ((RAIL_L_RED, "+", W_RED), (RAIL_L_BLU, "-", "#2f6fdb"),
                (RAIL_R_RED, "+", W_RED), (RAIL_R_BLU, "-", "#2f6fdb")):
    for rr in (0.5, 62.7):
        ax.text(x, Y(rr), s, ha="center", va="center", fontsize=8,
                color=c, fontweight="bold", zorder=4)

for c in COL:
    for rr in (-0.5, 64.4):
        ax.text(COL[c], Y(rr), c, ha="center", va="center", fontsize=5, color="#6b6660", zorder=4)
for r in range(1, NROWS + 1, 5):
    ax.text(COL["A"] - 1.1, Y(r), str(r), ha="right", va="center", fontsize=5, color="#6b6660", zorder=4)

ax.text(RAIL_R_RED - 0.3, Y(66.2), "3V3", ha="center", va="center", fontsize=6,
        color=W_RED, fontweight="bold", zorder=4, rotation=90)
ax.text(RAIL_R_BLU + 0.7, Y(66.2), "GND", ha="center", va="center", fontsize=6,
        color="#2f6fdb", fontweight="bold", zorder=4, rotation=90)
ax.text(-3.5, Y(66.8), "왼쪽 레일 — 비어 있음\n(팀 센서 전원용)", ha="center", va="center",
        fontsize=5.2, color="#2f7a55", fontweight="bold", zorder=4, linespacing=1.4)

# ---------- Pico 2 W ----------
bx0, bx1 = 1.37, 9.63
ax.add_patch(FancyBboxPatch((bx0, Y(20.55)), bx1 - bx0, 20.1,
                            boxstyle="round,pad=0.06,rounding_size=0.35",
                            fc=C_PICO, ec=C_PICO_E, lw=1.0, zorder=6))
ax.add_patch(FancyBboxPatch((4.35, Y(0.1)), 2.3, 1.05,
                            boxstyle="round,pad=0.04,rounding_size=0.15",
                            fc="#c8ccd0", ec="#8f959b", lw=0.8, zorder=7))
ax.text(5.5, Y(-1.3), "USB", ha="center", va="center", fontsize=5.5, color="#666")

LEFT = ["GP0", "GP1", "GND", "GP2", "GP3", "GP4", "GP5", "GND", "GP6", "GP7",
        "GP8", "GP9", "GND", "GP10", "GP11", "GP12", "GP13", "GND", "GP14", "GP15"]
RIGHT = ["VBUS", "VSYS", "GND", "3V3_EN", "3V3", "ADC_VREF", "GP28", "AGND", "GP27",
         "GP26", "RUN", "GP22", "GND", "GP21", "GP20", "GP19", "GP18", "GND", "GP17", "GP16"]
USED_L, USED_R = {"GP15"}, {"VBUS", "3V3", "GP26", "GP19", "GP18", "GP17", "GP16"}
# ★ 팀이 새로 쓸 수 있는 아날로그 핀 — 두 개뿐이라 눈에 띄게 표시한다
FREE_ADC = {"GP27", "GP28"}

for i in range(20):
    r = i + 1
    for cx in (COL["C"], COL["H"]):
        ax.add_patch(Circle((cx, Y(r)), 0.30, fc="#e8c15a", ec="#9c7b1f", lw=0.5, zorder=8))
    ln, rn = LEFT[i], RIGHT[i]
    lu, ru = ln in USED_L, (rn in USED_R or (rn == "GND" and r == 18))
    ax.text(COL["C"] + 0.5, Y(r), ln, ha="left", va="center", fontsize=4.1, zorder=9,
            color=("#ffe066" if lu else "#bcd8cb"), fontweight=("bold" if lu else "normal"))
    rcolor = "#ffe066" if ru else ("#8ef0b8" if rn in FREE_ADC else "#bcd8cb")
    ax.text(COL["H"] - 0.5, Y(r), rn, ha="right", va="center", fontsize=4.1, zorder=9,
            color=rcolor, fontweight=("bold" if (ru or rn in FREE_ADC) else "normal"))
ax.text(5.5, Y(10.5), "Raspberry Pi Pico 2 W", ha="center", va="center", rotation=90,
        fontsize=5.4, color="#e6f2ec", fontweight="bold", zorder=9)

# ---------- 부품 ----------
BOX = dict(fc="white", ec="none", alpha=0.88, pad=1.2)


def part_label(row, text, sub=None):
    ax.text(COL["F"] - 0.75, Y(row), text, ha="right", va="center", fontsize=6.8,
            color="#1f3864", fontweight="bold", zorder=12, bbox=BOX)
    if sub:
        ax.text(COL["F"] - 0.75, Y(row + 1.0), sub, ha="right", va="center", fontsize=5.2,
                color="#777", zorder=12, bbox=BOX)


def pinpad(c, r, name, tc="#222"):
    ax.add_patch(Circle(P(c, r), 0.24, fc="#f0d060", ec="#8a6d16", lw=0.5, zorder=11))
    ax.text(COL[c] - 0.75, Y(r), name, ha="right", va="center", fontsize=5.0,
            color="#222", zorder=12, bbox=BOX)


def body(c, r0, r1, w, fc, ec="#333"):
    ax.add_patch(FancyBboxPatch((COL[c] - 0.55, Y(r1) - 0.55), w, abs(Y(r1) - Y(r0)) + 1.1,
                                boxstyle="round,pad=0.05,rounding_size=0.2",
                                fc=fc, ec=ec, lw=0.8, zorder=10))


def resistor(c, r1, r2, label, bands=("#8a5a2b", "#000000", "#d92b2b")):
    x = COL[c]
    ax.plot([x, x], [Y(r1), Y(r2)], color="#9a9a9a", lw=1.1, zorder=9)
    ym, h = (Y(r1) + Y(r2)) / 2, abs(Y(r2) - Y(r1)) * 0.52
    ax.add_patch(FancyBboxPatch((x - 0.38, ym - h / 2), 0.76, h,
                                boxstyle="round,pad=0.02,rounding_size=0.12",
                                fc="#e8dcc0", ec="#a89771", lw=0.7, zorder=10))
    for k, bc in enumerate(bands):
        ax.add_patch(Rectangle((x - 0.38, ym - h / 2 + h * (0.2 + 0.2 * k)), 0.76, h * 0.09,
                               fc=bc, ec="none", zorder=11))
    if label:
        ax.text(x + 0.55, ym, label, ha="left", va="center", fontsize=5.2,
                color="#444", zorder=12, bbox=BOX)
    for rr in (r1, r2):
        ax.add_patch(Circle((x, Y(rr)), 0.19, fc="#9a9a9a", ec="none", zorder=11))


# SG90 서보 (23~25행)
body("F", 23, 25, 1.4, "#8a6a45")
for r, nm in ((23, "갈색 GND"), (24, "빨강 5V"), (25, "주황 신호")):
    pinpad("F", r, nm)
part_label(21.5, "SG90 서보모터")

# RGB LED (30~33행)
body("F", 30, 33, 1.4, "#5b6470")
for r, nm in ((30, "R"), (31, "공통(-)"), (32, "G"), (33, "B")):
    pinpad("F", r, nm)
part_label(28.2, "RGB LED", "공통 캐소드")
resistor("H", 30, 36, "")
resistor("I", 32, 37, "")
resistor("G", 33, 38, "")
ax.text(COL["F"] - 0.75, Y(35.5), "220Ω × 3", ha="right", va="center", fontsize=6.0,
        color="#1f3864", fontweight="bold", zorder=12, bbox=BOX)
ax.text(COL["F"] - 0.75, Y(36.5), "(R·G·B 각 1개)", ha="right", va="center", fontsize=5.2,
        color="#777", zorder=12, bbox=BOX)

# DHT11 (42~44행)
body("F", 42, 44, 1.4, "#3b7bbf")
for r, nm in ((42, "VCC"), (43, "DATA"), (44, "GND")):
    pinpad("F", r, nm)
part_label(40.2, "DHT11", "3핀 모듈")

# CdS 분압회로 (48~58행) — 10kΩ이 위(3V3), CdS가 아래(GND)
resistor("F", 48, 53, "", bands=("#8a5a2b", "#000000", "#d9a300"))
x = COL["H"]
ax.plot([x, x], [Y(53), Y(58)], color="#9a9a9a", lw=1.1, zorder=9)
ax.add_patch(Circle((x, Y(55.5)), 1.05, fc="#f6e7b8", ec="#8a6d16", lw=0.9, zorder=10))
ax.plot([x - 0.55, x - 0.2, x + 0.2, x + 0.55],
        [Y(55.5) + 0.28, Y(55.5) - 0.32, Y(55.5) + 0.32, Y(55.5) - 0.28],
        color="#6b5410", lw=1.0, zorder=11)
for rr in (53, 58):
    ax.add_patch(Circle((x, Y(rr)), 0.19, fc="#9a9a9a", ec="none", zorder=11))
ax.text(COL["F"] - 0.9, Y(50.5), "10kΩ", ha="right", va="center", fontsize=6.0,
        color="#1f3864", fontweight="bold", zorder=12, bbox=BOX)
ax.text(COL["F"] - 0.9, Y(51.7), "(3V3 쪽)", ha="right", va="center", fontsize=5.2,
        color="#b3261e", zorder=12, bbox=BOX)
ax.text(COL["H"] + 1.35, Y(55.5), "CdS 조도센서", ha="left", va="center", fontsize=6.0,
        color="#1f3864", fontweight="bold", zorder=12, bbox=BOX)
ax.text(COL["H"] + 1.35, Y(56.7), "(GND 쪽)", ha="left", va="center", fontsize=5.2,
        color="#b3261e", zorder=12, bbox=BOX)

# ---------- 점퍼선 ----------
def _ends(p1, p2, color):
    for p in (p1, p2):
        ax.add_patch(Circle(p, 0.2, fc=color, ec="white", lw=0.4, zorder=15))


def wire(p1, p2, color, rad=0.15, lw=1.7):
    ax.add_patch(FancyArrowPatch(p1, p2, connectionstyle=f"arc3,rad={rad}",
                                 arrowstyle="-", lw=lw, color=color, zorder=13,
                                 shrinkA=0, shrinkB=0))
    _ends(p1, p2, color)


def wire_dip(p1, p2, bulge_row, color, lw=1.8):
    (x1, y1), (x2, y2) = p1, p2
    by = Y(bulge_row)
    verts = [(x1, y1), (x1 + (x2 - x1) * 0.22, by),
             (x1 + (x2 - x1) * 0.78, by), (x2, y2)]
    codes = [Path.MOVETO, Path.CURVE4, Path.CURVE4, Path.CURVE4]
    ax.add_patch(PathPatch(Path(verts, codes), fc="none", ec=color, lw=lw,
                           zorder=13, capstyle="round"))
    _ends(p1, p2, color)


def wire_lane(p1, p2, bulge_x, color, lw=1.8):
    (x1, y1), (x2, y2) = p1, p2
    verts = [(x1, y1),
             (bulge_x, y1 + (y2 - y1) * 0.22),
             (bulge_x, y1 + (y2 - y1) * 0.78),
             (x2, y2)]
    codes = [Path.MOVETO, Path.CURVE4, Path.CURVE4, Path.CURVE4]
    ax.add_patch(PathPatch(Path(verts, codes), fc="none", ec=color, lw=lw,
                           zorder=13, capstyle="round"))
    _ends(p1, p2, color)


# 전원 공급 (Pico -> 우측 레일)
wire(P("I", 5), (RAIL_R_RED, Y(5)), W_RED, rad=0.12)
wire(P("I", 18), (RAIL_R_BLU, Y(18)), W_BLK, rad=0.12)

# SG90
wire(P("J", 23), (RAIL_R_BLU, Y(23)), W_BLK, rad=0.12)
wire_lane(P("J", 24), P("I", 1), 12.6, W_5V)          # VBUS 5V
wire_dip(P("G", 25), P("B", 25), 27.3, SIG["GP15"])
wire_lane(P("A", 25), P("A", 20), -0.75, SIG["GP15"])

# RGB LED
wire(P("J", 31), (RAIL_R_BLU, Y(31)), W_BLK, rad=0.12)
wire_lane(P("J", 36), P("I", 19), 11.9, SIG["GP17"])
wire_lane(P("J", 37), P("I", 17), 12.6, SIG["GP18"])
wire_lane(P("J", 38), P("I", 16), 13.3, SIG["GP19"])

# DHT11
wire(P("J", 42), (RAIL_R_RED, Y(42)), W_RED, rad=0.12)
wire_lane(P("J", 43), P("I", 20), 16.0, SIG["GP16"])
wire(P("J", 44), (RAIL_R_BLU, Y(44)), W_BLK, rad=0.12)

# CdS 분압
wire(P("J", 48), (RAIL_R_RED, Y(48)), W_RED, rad=0.12)
wire_lane(P("J", 53), P("I", 10), 17.2, SIG["GP26"])
wire(P("J", 58), (RAIL_R_BLU, Y(58)), W_BLK, rad=0.12)

# ---------- 제목 ----------
ax.text(-5.4, Y(-4.3), "최종 배선도", ha="left", va="bottom",
        fontsize=15, fontweight="bold", color="#1f3864")
ax.text(-5.4, Y(-2.9), "Raspberry Pi Pico 2 W  ·  830홀 브레드보드  ·  조도 연동 무드등 + 온도 연동 게이지",
        ha="left", va="bottom", fontsize=7.2, color="#555")
ax.text(-5.4, Y(-1.6), "※ 1·2·3·8·9·11·12주차 내내 이 배선 그대로입니다. 팀 센서는 왼쪽 빈 자리에 추가하세요.",
        ha="left", va="bottom", fontsize=6.4, color="#8a8580")

# ---------- 우측 설명 ----------
TX = 22.5


def head(y, t):
    ax.text(TX, Y(y), t, ha="left", va="center", fontsize=8.6, fontweight="bold", color="#1f3864")


def line(y, t, c="#333", fs=6.4, bold=False, x=TX):
    ax.text(x, Y(y), t, ha="left", va="center", fontsize=fs, color=c,
            fontweight=("bold" if bold else "normal"))


head(0.5, "Pico 2 W 배치")
line(2.2, "· 브레드보드 1행부터 20행까지, 중앙 채널에 걸쳐 배치")
line(3.5, "· 핀 간격이 0.7인치라 왼쪽 핀은 C열, 오른쪽 핀은 H열")
line(4.8, "· USB 커넥터가 1행(위쪽)을 향하도록 꽂습니다")
line(6.3, "주의: 1~20행은 몸체에 가려 D·E·F·G열을 못 씁니다.", "#b3261e", 6.4, True)
line(7.5, "점퍼선은 왼쪽 A·B열 / 오른쪽 I·J열에만 꽂으세요.", "#b3261e")

head(9.8, "연결표 (코드의 GP 번호 기준)")
tbl = [
    ("RGB LED  R", "220Ω -> GP17", SIG["GP17"]),
    ("RGB LED  G", "220Ω -> GP18", SIG["GP18"]),
    ("RGB LED  B", "220Ω -> GP19", SIG["GP19"]),
    ("RGB LED  공통(-)", "GND 레일", W_BLK),
    ("DHT11  DATA", "GP16", SIG["GP16"]),
    ("DHT11  VCC", "3V3 레일", W_RED),
    ("DHT11  GND", "GND 레일", W_BLK),
    ("CdS 분압점", "GP26 (ADC0)", SIG["GP26"]),
    ("10kΩ 위쪽", "3V3 레일", W_RED),
    ("CdS 아래쪽", "GND 레일", W_BLK),
    ("SG90  주황(신호)", "GP15", SIG["GP15"]),
    ("SG90  빨강", "VBUS (5V)", W_5V),
    ("SG90  갈색", "GND 레일", W_BLK),
]
y = 11.6
for name, dest, col in tbl:
    ax.add_patch(Rectangle((TX, Y(y) - 0.4), 0.5, 0.8, fc=col, ec="none"))
    ax.text(TX + 0.9, Y(y), name, ha="left", va="center", fontsize=6.4, color="#222")
    ax.text(TX + 10.0, Y(y), dest, ha="left", va="center", fontsize=6.4,
            color="#222", fontweight="bold")
    y += 1.5

head(31.0, "꼭 확인할 것")
y = 32.8
warn = [
    ("CdS는 GND쪽, 10kΩ은 3V3쪽입니다.", "순서를 바꾸면 무드등이 정반대로 동작합니다."),
    ("SG90 전원은 3V3이 아닌 VBUS(5V)입니다.", "3V3에 연결하면 힘이 부족해 떨립니다."),
    ("RGB LED는 공통 캐소드 기준입니다.", "가장 긴 다리가 공통(-)입니다."),
    ("DHT11·RGB LED 핀 순서는 제품마다 다릅니다.", "부품에 인쇄된 표시를 꼭 확인하세요."),
]
for a, b in warn:
    line(y, "· " + a, "#b3261e", 6.4, True)
    line(y + 1.1, "   " + b, "#666", 6.2)
    y += 2.5

head(43.4, "점퍼선 색 규칙")
for i, (t, c) in enumerate((("빨강 = 3V3 전원", W_RED), ("검정 = GND", W_BLK),
                            ("주황 = VBUS 5V 전원", W_5V), ("그 외 색 = GPIO 신호선", "#8d44c9"))):
    cx = TX + (i % 2) * 13.0
    cy = 45.2 + (i // 2) * 1.35
    ax.add_patch(Rectangle((cx, Y(cy) - 0.26), 1.2, 0.52, fc=c, ec="none"))
    ax.text(cx + 1.8, Y(cy), t, ha="left", va="center", fontsize=6.4, color="#333")

# ---------- 팀 프로젝트 확장 ----------
ax.add_patch(FancyBboxPatch((TX - 0.6, Y(67.1)), 26.0, 18.3,
                            boxstyle="round,pad=0.2,rounding_size=0.4",
                            fc="#f2f9f5", ec="#6aa98a", lw=1.0, zorder=0.5))
head(49.6, "팀 프로젝트 — 센서를 더 붙일 때")

line(51.4, "쓸 수 있는 핀", "#1f3864", 7.0, True)
pins = [
    ("아날로그 (전압이 연속으로 변하는 센서)", "GP27, GP28 — 두 개뿐", "#b3261e"),
    ("디지털 (켜짐/꺼짐, 펄스, 통신)", "GP0~GP14, GP20~GP22", "#222"),
    ("절대 쓰면 안 되는 핀", "GP23·GP24·GP25·GP29", "#b3261e"),
]
y = 52.9
for a, b, c in pins:
    line(y, "· " + a, "#333", 6.2)
    line(y, b, c, 6.2, True, x=TX + 15.5)
    y += 1.35
line(56.9, "   GP23·24·25·29는 무선 칩 전용 — 쓰면 Wi-Fi가 죽습니다.", "#666", 6.0)

line(58.6, "전원", "#1f3864", 7.0, True)
line(60.0, "· 3.3V 센서 → 오른쪽 빨강 레일 (3V3)", "#333", 6.2)
line(61.2, "· 5V 센서 → VBUS(40번 핀)를 왼쪽 빨강 레일로 끌어 쓰기", "#333", 6.2)
line(62.4, "· 3V3는 다 합쳐 약 300mA까지. 서보·펌프·모터는 별도 전원", "#b3261e", 6.2, True)
line(63.6, "· GND는 전부 하나로 — 왼쪽 레일을 쓰면 양쪽 파랑 레일을 점퍼로 잇기", "#b3261e", 6.2, True)

line(65.0, "※ 센서가 Pico로 내보내는 신호가 5V면 분압 저항이 필요합니다.",
     "#b3261e", 6.4, True)
line(66.1, "   HC-SR04의 ECHO가 대표적 — 1kΩ+2kΩ으로 3.3V까지 낮춰서 받으세요.",
     "#666", 6.0)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
for ext in ("png", "pdf"):
    out = os.path.join(OUT_DIR, f"최종_배선도.{ext}")
    fig.savefig(out, dpi=300, bbox_inches="tight", facecolor="white")
    print("saved", os.path.normpath(out))
