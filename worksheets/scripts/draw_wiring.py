# -*- coding: utf-8 -*-
"""1주차 종합 실습 배선도 (Pico 2 W + 830홀 브레드보드)"""
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
ax.text(-3.5, Y(66.4), "이번 실습 미사용", ha="center", va="center", fontsize=5.2,
        color="#9a948c", zorder=4)

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

for i in range(20):
    r = i + 1
    for cx in (COL["C"], COL["H"]):
        ax.add_patch(Circle((cx, Y(r)), 0.30, fc="#e8c15a", ec="#9c7b1f", lw=0.5, zorder=8))
    ln, rn = LEFT[i], RIGHT[i]
    lu, ru = ln in USED_L, (rn in USED_R or (rn == "GND" and r == 18))
    ax.text(COL["C"] + 0.5, Y(r), ln, ha="left", va="center", fontsize=4.1, zorder=9,
            color=("#ffe066" if lu else "#bcd8cb"), fontweight=("bold" if lu else "normal"))
    ax.text(COL["H"] - 0.5, Y(r), rn, ha="right", va="center", fontsize=4.1, zorder=9,
            color=("#ffe066" if ru else "#bcd8cb"), fontweight=("bold" if ru else "normal"))
ax.text(5.5, Y(10.5), "Raspberry Pi Pico 2 W", ha="center", va="center", rotation=90,
        fontsize=5.4, color="#e6f2ec", fontweight="bold", zorder=9)

# ---------- 부품 ----------
BOX = dict(fc="white", ec="none", alpha=0.88, pad=1.2)

def part_label(row, text, sub=None):
    """부품 이름 — 부품 위쪽 빈 행에, 중앙 채널 왼쪽(비어 있는 A~E열)으로 뻗도록 배치"""
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

# CdS 분압회로 (48~58행)
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
    """짧은 연결용 (완만한 호)"""
    ax.add_patch(FancyArrowPatch(p1, p2, connectionstyle=f"arc3,rad={rad}",
                                 arrowstyle="-", lw=lw, color=color, zorder=13,
                                 shrinkA=0, shrinkB=0))
    _ends(p1, p2, color)

def wire_dip(p1, p2, bulge_row, color, lw=1.8):
    """가로 점퍼 — 아래로 늘어뜨려 글자/부품을 피해 배선"""
    (x1, y1), (x2, y2) = p1, p2
    by = Y(bulge_row)
    verts = [(x1, y1), (x1 + (x2 - x1) * 0.22, by),
             (x1 + (x2 - x1) * 0.78, by), (x2, y2)]
    codes = [Path.MOVETO, Path.CURVE4, Path.CURVE4, Path.CURVE4]
    ax.add_patch(PathPatch(Path(verts, codes), fc="none", ec=color, lw=lw,
                           zorder=13, capstyle="round"))
    _ends(p1, p2, color)

def wire_lane(p1, p2, bulge_x, color, lw=1.8):
    """부품 -> Pico 신호선: 오른쪽 lane(bulge_x)으로 부풀려 배선"""
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
wire_dip(P("G", 25), P("B", 25), 27.3, SIG["GP15"])   # 중앙 채널 건너 왼쪽 뱅크로
wire_lane(P("A", 25), P("A", 20), -0.75, SIG["GP15"])  # 왼쪽 A열 따라 GP15(20행)로

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
ax.text(-5.4, Y(-4.3), "1주차 종합 실습 배선도", ha="left", va="bottom",
        fontsize=15, fontweight="bold", color="#1f3864")
ax.text(-5.4, Y(-2.9), "Raspberry Pi Pico 2 W  ·  830홀 브레드보드  ·  조도 연동 무드등 + 온도 연동 게이지",
        ha="left", va="bottom", fontsize=7.2, color="#555")
ax.text(-5.4, Y(-1.6), "※ 2·3주차 실습도 이 배선을 그대로 사용합니다 (GP 번호 동일). 4주차는 하드웨어 변경이 없습니다.",
        ha="left", va="bottom", fontsize=6.4, color="#8a8580")

# ---------- 우측 설명 ----------
TX = 22.5
def head(y, t):
    ax.text(TX, Y(y), t, ha="left", va="center", fontsize=8.6, fontweight="bold", color="#1f3864")
def line(y, t, c="#333", fs=6.4, bold=False):
    ax.text(TX, Y(y), t, ha="left", va="center", fontsize=fs, color=c,
            fontweight=("bold" if bold else "normal"))

head(0.5, "Pico 2 W 배치")
line(2.2, "· 브레드보드 1행부터 20행까지, 중앙 채널에 걸쳐 배치")
line(3.5, "· 핀 간격이 0.7인치라 왼쪽 핀은 C열, 오른쪽 핀은 H열")
line(4.8, "· USB 커넥터가 1행(위쪽)을 향하도록 꽂습니다")
line(6.3, "주의: 1~20행은 몸체에 가려 D·E·F·G열을 못 씁니다.", "#b3261e", 6.4, True)
line(7.5, "점퍼선은 왼쪽 A·B열 / 오른쪽 I·J열에만 꽂으세요.", "#b3261e")

head(9.8, "연결표 (예시 코드 GP 번호 기준)")
tbl = [
    ("RGB LED  R",       "220Ω -> GP17",    SIG["GP17"]),
    ("RGB LED  G",       "220Ω -> GP18",    SIG["GP18"]),
    ("RGB LED  B",       "220Ω -> GP19",    SIG["GP19"]),
    ("RGB LED  공통(-)", "GND 레일",        W_BLK),
    ("DHT11  DATA",      "GP16",            SIG["GP16"]),
    ("DHT11  VCC",       "3V3 레일",        W_RED),
    ("DHT11  GND",       "GND 레일",        W_BLK),
    ("CdS 분압점",       "GP26 (ADC0)",     SIG["GP26"]),
    ("10kΩ 위쪽",        "3V3 레일",        W_RED),
    ("CdS 아래쪽",       "GND 레일",        W_BLK),
    ("SG90  주황(신호)", "GP15",            SIG["GP15"]),
    ("SG90  빨강",       "VBUS (5V)",       W_5V),
    ("SG90  갈색",       "GND 레일",        W_BLK),
]
y = 11.6
for name, dest, col in tbl:
    ax.add_patch(Rectangle((TX, Y(y) - 0.4), 0.5, 0.8, fc=col, ec="none"))
    ax.text(TX + 0.9, Y(y), name, ha="left", va="center", fontsize=6.4, color="#222")
    ax.text(TX + 10.0, Y(y), dest, ha="left", va="center", fontsize=6.4,
            color="#222", fontweight="bold")
    y += 1.5

y += 1.2
head(y, "꼭 확인할 것")
y += 1.9
warn = [
    ("CdS는 GND쪽, 10kΩ은 3V3쪽입니다.", "순서를 바꾸면 무드등이 정반대로 동작합니다."),
    ("SG90 전원은 3V3이 아닌 VBUS(5V)입니다.", "3V3에 연결하면 힘이 부족해 떨립니다."),
    ("RGB LED는 공통 캐소드 기준입니다.", "가장 긴 다리가 공통(-)입니다."),
    ("DHT11·RGB LED 핀 순서는 제품마다 다릅니다.", "부품에 인쇄된 표시를 꼭 확인하세요."),
]
for a, b in warn:
    line(y, "· " + a, "#b3261e", 6.4, True)
    line(y + 1.15, "   " + b, "#666", 6.2)
    y += 2.7

y += 0.6
head(y, "점퍼선 색 규칙")
y += 1.9
for t, c in (("빨강 = 3V3 전원", W_RED), ("주황 = VBUS 5V 전원", W_5V),
             ("검정 = GND", W_BLK), ("그 외 색 = GPIO 신호선", "#8d44c9")):
    ax.add_patch(Rectangle((TX, Y(y) - 0.26), 1.4, 0.52, fc=c, ec="none"))
    ax.text(TX + 2.0, Y(y), t, ha="left", va="center", fontsize=6.4, color="#333")
    y += 1.35

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "1주차_배선도.png")
fig.savefig(OUT, dpi=300, bbox_inches="tight", facecolor="white")
print("saved", OUT)
