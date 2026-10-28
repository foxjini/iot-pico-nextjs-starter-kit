# -*- coding: utf-8 -*-
"""수정 배선도 — 학생 배부용 (회로 배선만, 설명 패널 없음)

최종 배선도(draw_final_wiring.py)에서 바뀐 두 가지
  ① SG90 을 브레드보드 위 핀 3개로 그리지 않고, 실물처럼 보드 밖에 둔다.
     서보 자체 케이블(갈색·빨강·주황) 끝의 암 커넥터에 수-수 점퍼 3개만 꽂아
     갈색 → 왼쪽 파랑(외부 GND), 빨강 → 왼쪽 빨강(외부 5V), 주황 → GP15.
     (보드 위에 핀을 그리면 서보를 꽂을 수 있다고 착각하거나 점퍼를 6개 쓰게 된다)
  ② RGB 모듈 핀 순서를 실제 부품대로 위에서부터 R · G · B · GND, LED 는 왼쪽을 향함.

나머지(Pico 위치, DHT11, CdS 분압, 레일, 커패시터, 공통 GND)는 최종 배선도와 같다.
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
ax.set_xlim(-26.0, 31.0)
ax.set_ylim(-76, 5.5)
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
ax.text(RAIL_L_RED - 0.3, Y(66.2), "외부 5V", ha="center", va="center", fontsize=6,
        color=W_5V, fontweight="bold", zorder=4, rotation=90)
ax.text(RAIL_L_BLU + 0.7, Y(66.2), "GND", ha="center", va="center", fontsize=6,
        color="#2f6fdb", fontweight="bold", zorder=4, rotation=90)
ax.text(-3.5, Y(68.6), "별도 5V 어댑터\n(노트북 USB 아님)", ha="center", va="center",
        fontsize=5.4, color=W_5V, fontweight="bold", zorder=4, linespacing=1.4)

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
USED_L, USED_R = {"GP15"}, {"3V3", "GP26", "GP19", "GP18", "GP17", "GP16"}
# ★ 팀이 새로 쓸 수 있는 아날로그 핀 — 두 개뿐이라 눈에 띄게 표시한다
FREE_ADC = set()

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



# RGB LED 모듈 (30~33행) — 실제 부품: 위에서부터 R · G · B · GND, LED 는 왼쪽을 향함
#   핀은 F열에 꽂히고, 기판과 LED 는 핀에서 왼쪽으로 뻗는다(채널 위로 떠 있음)
RGB_ROWS = {"R": 30, "G": 31, "B": 32, "GND": 33}
px = COL["F"]
ax.add_patch(FancyBboxPatch((px - 5.6, Y(33.75)), 6.1, 4.5,
                            boxstyle="round,pad=0.05,rounding_size=0.3",
                            fc="#2b2f36", ec="#111", lw=0.8, zorder=10))
ax.add_patch(Circle((px - 4.0, Y(31.5)), 1.35, fc="#f4f6f8", ec="#9aa3ad", lw=0.8, zorder=11))
ax.add_patch(Circle((px - 4.0, Y(31.5)), 0.85, fc="#ffffff", ec="none", alpha=0.9, zorder=11.5))
for nm, r in RGB_ROWS.items():
    ax.add_patch(Circle(P("F", r), 0.24, fc="#f0d060", ec="#8a6d16", lw=0.5, zorder=12))
    ax.text(px - 0.6, Y(r), nm, ha="right", va="center", fontsize=4.8,
            color="white", fontweight="bold", zorder=12)
ax.text(px - 2.6, Y(29.0), "RGB LED 모듈", ha="center", va="center", fontsize=6.8,
        color="#1f3864", fontweight="bold", zorder=12, bbox=BOX)
ax.text(px - 2.6, Y(35.0), "위에서부터 R · G · B · GND", ha="center", va="center",
        fontsize=5.6, color="#b3261e", fontweight="bold", zorder=12, bbox=BOX)

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

# ★ 공통 GND 브리지 — 외부 전원의 GND와 Pico GND를 하나로 (없으면 서보가 제멋대로 돈다)
wire((RAIL_L_BLU, Y(60)), (RAIL_R_BLU, Y(60)), W_BLK, rad=0.03, lw=2.0)
ax.text((RAIL_L_BLU + RAIL_R_BLU) / 2, Y(58.9),
        "공통 GND",
        ha="center", va="center", fontsize=5.6, color="#b3261e", fontweight="bold",
        zorder=14, bbox=dict(fc="white", ec="none", alpha=0.9, pad=1.4))

# ★ 커패시터 — 외부 5V 레일 사이. 서보 기동 순간의 전류를 대신 내준다
CAP_T, CAP_B = 27.2, 29.6
for xx in (RAIL_L_RED, RAIL_L_BLU):
    ax.plot([xx, xx], [Y(CAP_T), Y(CAP_B - 1.3)], color="#9a9a9a", lw=1.2, zorder=9)
    ax.add_patch(Circle((xx, Y(CAP_T)), 0.19, fc="#9a9a9a", ec="none", zorder=11))
ax.add_patch(FancyBboxPatch((RAIL_L_RED - 0.40, Y(CAP_B)), (RAIL_L_BLU - RAIL_L_RED) + 0.80, 1.3,
                            boxstyle="round,pad=0.05,rounding_size=0.25",
                            fc="#3b4a6b", ec="#1f2b45", lw=0.8, zorder=10))
ax.text(RAIL_L_RED, Y(CAP_B - 0.65), "+", ha="center", va="center", fontsize=8,
        color="white", fontweight="bold", zorder=12)
ax.text(-3.5, Y(32.4), "470~1000μF", ha="center", va="center", fontsize=5.2,
        color="#1f3864", fontweight="bold", zorder=12, bbox=BOX)
ax.text(-3.5, Y(33.4), "긴 다리 = +", ha="center", va="center", fontsize=4.8,
        color="#b3261e", zorder=12, bbox=BOX)

# SG90 — 보드 밖. 서보 케이블 끝 암 커넥터에 수-수 점퍼 3개
SX, SY = -18.5, 12.0          # 서보 몸통 중심
CX, CY = -12.2, 23.0          # 커넥터 위쪽 끝 (행 단위)
# 몸통(파랑 반투명) + 고정 날개 + 출력축 + 혼
ax.add_patch(FancyBboxPatch((SX - 2.6, Y(SY + 4.6)), 5.2, 9.2,
                            boxstyle="round,pad=0.05,rounding_size=0.35",
                            fc="#3d7fd9", ec="#1d4f99", lw=1.0, alpha=0.92, zorder=10))
ax.add_patch(FancyBboxPatch((SX - 3.4, Y(SY - 3.3)), 6.8, 1.1,
                            boxstyle="round,pad=0.03,rounding_size=0.2",
                            fc="#3d7fd9", ec="#1d4f99", lw=0.8, alpha=0.92, zorder=10))
ax.add_patch(FancyBboxPatch((SX - 3.4, Y(SY + 3.3)), 6.8, 1.1,
                            boxstyle="round,pad=0.03,rounding_size=0.2",
                            fc="#3d7fd9", ec="#1d4f99", lw=0.8, alpha=0.92, zorder=10))
for dy in (-3.3 + 0.55, 3.3 + 0.55):
    for dx in (-2.95, 2.95):
        ax.add_patch(Circle((SX + dx, Y(SY + dy) + 0.0), 0.22, fc="white", ec="#1d4f99", lw=0.5, zorder=11))
ax.add_patch(Circle((SX, Y(SY - 2.0)), 1.15, fc="#e9eef5", ec="#8e9aab", lw=0.8, zorder=11))
ax.add_patch(FancyBboxPatch((SX - 0.45, Y(SY - 2.0) - 0.2), 0.9, 5.6,
                            boxstyle="round,pad=0.02,rounding_size=0.4",
                            fc="white", ec="#9aa3ad", lw=0.8, zorder=12))
ax.add_patch(Circle((SX, Y(SY - 2.0)), 0.35, fc="#cfd6df", ec="#8e9aab", lw=0.6, zorder=13))
ax.text(SX, Y(SY + 1.6), "SG90", ha="center", va="center", fontsize=8.5,
        color="white", fontweight="bold", zorder=12)
ax.text(SX, Y(SY + 2.7), "서보모터", ha="center", va="center", fontsize=5.2,
        color="#e8f0fb", zorder=12)
# 서보 자체 케이블 (꼬인 3가닥) → 암 커넥터
CABLE = (("#7a4a21", -0.35), ("#d92b2b", 0.0), ("#ff8000", 0.35))
for col, off in CABLE:
    verts = [(SX + 2.6, Y(SY + 3.2) + off), (SX + 6.5, Y(SY + 3.6) + off),
             (CX - 3.0, Y(CY - 3.0)), (CX + off, Y(CY - 0.7))]
    ax.add_patch(PathPatch(Path(verts, [Path.MOVETO, Path.CURVE4, Path.CURVE4, Path.CURVE4]),
                           fc="none", ec=col, lw=1.6, zorder=11, capstyle="round"))
# 암 커넥터 (검정 하우징, 위에서부터 갈색·빨강·주황 → 행 23·24·25 높이)
ax.add_patch(FancyBboxPatch((CX - 0.7, Y(CY + 2.6)), 1.4, 3.3,
                            boxstyle="round,pad=0.03,rounding_size=0.15",
                            fc="#1c1c1c", ec="#000", lw=0.8, zorder=12))
SPIN = {"갈색": CY, "빨강": CY + 1, "주황": CY + 2}
for nm, r in SPIN.items():
    ax.add_patch(Circle((CX, Y(r)), 0.22, fc="#9a9a9a", ec="none", zorder=13))
    ax.text(CX - 1.0, Y(r), nm, ha="right", va="center", fontsize=5.4,
            color={"갈색": "#7a4a21", "빨강": "#d92b2b", "주황": "#d96a00"}[nm],
            fontweight="bold", zorder=13, bbox=BOX)
ax.text(CX, Y(CY + 4.0), "수-수 점퍼 3개", ha="center", va="center", fontsize=5.6,
        color="#1f3864", fontweight="bold", zorder=13, bbox=BOX)
# 점퍼 3개: 갈색 → 왼쪽 파랑(외부 GND), 빨강 → 왼쪽 빨강(외부 5V), 주황 → GP15 (B20)
wire((CX, Y(SPIN["갈색"])), (RAIL_L_BLU, Y(23)), W_BLK, rad=-0.15)
wire((CX, Y(SPIN["빨강"])), (RAIL_L_RED, Y(24)), W_5V, rad=0.15)
# 신호 점퍼는 외부 5V(주황)와 헷갈리지 않게 청록으로 그린다
wire_dip((CX, Y(SPIN["주황"])), P("B", 20), 27.0, "#0f9d9a")

# RGB LED
wire_lane(P("J", 30), P("I", 19), 11.9, SIG["GP17"])      # R -> GP17
wire_lane(P("J", 31), P("I", 17), 12.6, SIG["GP18"])      # G -> GP18
wire_lane(P("J", 32), P("I", 16), 13.3, SIG["GP19"])      # B -> GP19
wire(P("J", 33), (RAIL_R_BLU, Y(33)), W_BLK, rad=0.12)   # GND

# DHT11
wire(P("J", 42), (RAIL_R_RED, Y(42)), W_RED, rad=0.12)
wire_lane(P("J", 43), P("I", 20), 16.0, SIG["GP16"])
wire(P("J", 44), (RAIL_R_BLU, Y(44)), W_BLK, rad=0.12)

# CdS 분압
wire(P("J", 48), (RAIL_R_RED, Y(48)), W_RED, rad=0.12)
wire_lane(P("J", 53), P("I", 10), 17.2, SIG["GP26"])
wire(P("J", 58), (RAIL_R_BLU, Y(58)), W_BLK, rad=0.12)

# ---------- 제목 ----------
ax.text(-23.0, Y(-4.3), "수정 배선도", ha="left", va="bottom",
        fontsize=15, fontweight="bold", color="#1f3864")
ax.text(-23.0, Y(-2.9), "Raspberry Pi Pico 2 W  ·  830홀 브레드보드  ·  SG90 은 보드 밖에서 점퍼 3개",
        ha="left", va="bottom", fontsize=7.2, color="#555")

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
for ext in ("png", "pdf"):
    out = os.path.join(OUT_DIR, f"수정 배선도.{ext}")
    fig.savefig(out, dpi=300, bbox_inches="tight", facecolor="white")
    print("saved", os.path.normpath(out))
