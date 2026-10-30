# -*- coding: utf-8 -*-
"""추가 회로 3종 — 회로도 + 배선도 (HC-SR04 · PC817 릴레이 DC 모터 · PWM LED)

  ① HC-SR04 초음파: VCC 외부 5V · TRIG GP10 · ECHO → 1kΩ/2kΩ 분압 → GP11 (5V × 2/3 = 3.33V)
  ② DC 모터 on/off: GP20 → 330Ω → PC817 → 1kΩ → S8050 → 5V 릴레이 코일(1N4007 병렬)
                      릴레이 COM = 외부 5V, NO → 모터(+), 모터(-) → GND (모터 양단 1N4007)
     PC817 출력(CTR 최소 50% → 약 3mA)만으로는 코일(약 70mA)을 못 켜므로 NPN 트랜지스터로 증폭한다.
  ③ PWM LED: GP22 → 220Ω → LED → GND (GP22 = PWM 슬라이스 3A — 서보 GP15(7B) · RGB(0B·1A·1B)와 안 겹침)

배선도는 부품 다리와 점퍼를 데이터로 들고 있다가, 브레드보드 줄 · 레일로 이어진 「넷」을 계산해
회로도의 넷과 **정확히 같은지 검사**한 뒤에만 그림을 저장한다 (다르면 AssertionError).

  python3 draw_extra_circuits.py  →  worksheets/추가 회로도.(pdf|png), worksheets/추가 배선도.(pdf|png)
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch, Circle, Polygon, FancyArrowPatch, PathPatch
from matplotlib.path import Path

plt.rcParams["font.family"] = "NanumGothic"
plt.rcParams["axes.unicode_minus"] = False
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

W_RED, W_BLK, W_5V = "#d92b2b", "#222222", "#ff8000"
SIG = {"GP10": "#2e9e4f", "GP11": "#8d44c9", "GP20": "#2f6fdb", "GP22": "#d9a300"}

# ════════════════════════════════════════════════════════════════════════
#  1. 배선 데이터 — 이것 하나로 그림도 그리고 연결도 검사한다
# ════════════════════════════════════════════════════════════════════════
COL = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 7, "G": 8, "H": 9, "I": 10, "J": 11}
RAIL_X = {"L+": -4, "L-": -3, "R+": 14, "R-": 15}
RAIL_ROWS = {2 + 6 * g + k for g in range(10) for k in range(5)}
NROWS = 63
LEFT = ["GP0", "GP1", "GND", "GP2", "GP3", "GP4", "GP5", "GND", "GP6", "GP7",
        "GP8", "GP9", "GND", "GP10", "GP11", "GP12", "GP13", "GND", "GP14", "GP15"]
RIGHT = ["VBUS", "VSYS", "GND", "3V3_EN", "3V3", "ADC_VREF", "GP28", "AGND", "GP27",
         "GP26", "RUN", "GP22", "GND", "GP21", "GP20", "GP19", "GP18", "GND", "GP17", "GP16"]

# 부품 다리: (부품, 다리 이름, 구멍).  구멍 = ("C", 30) 또는 ("L-", 47) 같은 레일
LEGS = [
    # ── ② PC817 (중앙 채널에 걸침: ①② 오른쪽 = 3.3V 쪽, ③④ 왼쪽 = 5V 쪽) ──
    ("U1", "1(A)", ("F", 42)), ("U1", "2(K)", ("F", 43)),
    ("U1", "4(C)", ("E", 42)), ("U1", "3(E)", ("E", 43)),
    ("R330", "a", ("H", 38)), ("R330", "b", ("H", 42)),
    ("RB1k", "a", ("C", 43)), ("RB1k", "b", ("C", 47)),
    ("R10k", "a", ("A", 47)), ("R10k", "b", ("L-", 47)),
    ("Q1", "E", ("D", 46)), ("Q1", "B", ("D", 47)), ("Q1", "C", ("D", 48)),
    ("K1", "코일+", ("E", 49)), ("K1", "코일-", ("E", 51)), ("K1", "COM", ("E", 53)),
    ("K1", "NO", ("E", 55)), ("K1", "NC", ("E", 57)),
    ("D1", "K", ("C", 49)), ("D1", "A", ("C", 51)),          # 코일 역기전력 다이오드 (띠 = +5V 쪽)
    ("D2", "K", ("C", 55)), ("D2", "A", ("C", 59)),          # 모터 역기전력 다이오드
    # ── ① 분압 저항 ──
    ("R1k", "a", ("C", 30)), ("R1k", "b", ("C", 34)),
    ("R2k", "a", ("D", 34)), ("R2k", "b", ("D", 38)),
    # ── ③ LED ──
    ("R220", "a", ("G", 24)), ("R220", "b", ("G", 28)),
    ("LED", "A(긴 다리)", ("H", 28)), ("LED", "K", ("H", 29)),
    # ── 전원 ──
    ("C1", "+", ("L+", 27)), ("C1", "-", ("L-", 27)),
]
# 보드 밖 부품에서 들어오는 선 (부품, 다리, 꽂는 구멍) — HC-SR04 는 암-수 점퍼 4개, 모터는 선 2가닥
OFFBOARD = [
    ("HC", "VCC", ("L+", 23)), ("HC", "TRIG", ("B", 14)), ("HC", "ECHO", ("A", 30)), ("HC", "GND", ("L-", 26)),
    ("M1", "+", ("B", 55)), ("M1", "-", ("B", 59)),
    ("EXT5V", "+", ("L+", 2)), ("EXT5V", "-", ("L-", 2)),
]
# 점퍼: (구멍, 구멍, 색)
WIRES = [
    (("I", 18), ("R-", 18), W_BLK),        # Pico GND → 오른쪽 파랑
    (("L-", 60), ("R-", 60), W_BLK),       # 공통 GND 브리지
    # ① 분압
    (("B", 38), ("L-", 38), W_BLK),
    (("A", 34), ("B", 15), SIG["GP11"]),   # 분압점 → GP11
    # ② PC817 입력 (3.3V 쪽)
    (("J", 15), ("J", 38), SIG["GP20"]),   # GP20 → 330Ω
    (("J", 43), ("R-", 44), W_BLK),        # PC817 ② → GND
    # ② 5V 쪽
    (("A", 42), ("L+", 42), W_5V),         # PC817 ④ → +5V
    (("B", 46), ("L-", 46), W_BLK),        # S8050 E → GND
    (("B", 48), ("B", 51), "#7a4a21"),     # S8050 C → 코일-
    (("A", 49), ("L+", 50), W_5V),         # 코일+ → +5V
    (("A", 53), ("L+", 53), W_5V),         # COM → +5V
    (("A", 59), ("L-", 59), W_BLK),        # 모터- → GND
    # ③ LED
    (("J", 12), ("J", 24), SIG["GP22"]),   # GP22 → 220Ω
    (("J", 29), ("R-", 29), W_BLK),        # LED 캐소드 → GND
]

# 회로도의 넷 (이 목록과 배선도에서 계산한 넷이 같아야 그림을 저장한다)
EXPECTED = [
    {"EXT5V.+", "C1.+", "HC.VCC", "U1.4(C)", "K1.코일+", "K1.COM", "D1.K"},
    {"EXT5V.-", "C1.-", "HC.GND", "R2k.b", "R10k.b", "Q1.E", "M1.-", "D2.A", "U1.2(K)", "LED.K", "Pico.GND"},
    {"HC.TRIG", "Pico.GP10"},
    {"HC.ECHO", "R1k.a"},
    {"R1k.b", "R2k.a", "Pico.GP11"},
    {"Pico.GP20", "R330.a"},
    {"R330.b", "U1.1(A)"},
    {"U1.3(E)", "RB1k.a"},
    {"RB1k.b", "R10k.a", "Q1.B"},
    {"Q1.C", "K1.코일-", "D1.A"},
    {"K1.NO", "M1.+", "D2.K"},
    {"K1.NC"},
    {"Pico.GP22", "R220.a"},
    {"R220.b", "LED.A(긴 다리)"},
]


def node_of(hole):
    """구멍이 속한 전기적 묶음: 레일이면 레일 하나, 아니면 그 행의 왼쪽(A~E) 또는 오른쪽(F~J) 5칸"""
    c, r = hole
    if c in RAIL_X:
        assert r in RAIL_ROWS, f"레일 {c} {r}행에는 구멍이 없습니다"
        return ("rail", c)
    assert 1 <= r <= NROWS, hole
    if r <= 20:
        assert c not in "DEFG", f"{hole} 는 Pico 몸체에 가려진 자리입니다"
    return ("strip", "L" if c in "ABCDE" else "R", r)


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

    used = {}
    for part, leg, hole in LEGS + OFFBOARD:
        if hole[0] not in RAIL_X:          # 한 구멍에 두 개를 꽂을 수는 없다
            assert hole not in used, f"{hole} 에 {used.get(hole)} 와 {part}.{leg} 가 겹칩니다"
            used[hole] = f"{part}.{leg}"
        union(f"{part}.{leg}", node_of(hole))
    for a, b, _ in WIRES:
        for h in (a, b):
            if h[0] not in RAIL_X:
                assert h not in used, f"점퍼 끝 {h} 가 {used.get(h)} 와 겹칩니다"
                used[h] = "점퍼"
        union(node_of(a), node_of(b))
    # Pico 핀: 1~20행, 왼쪽 C열 · 오른쪽 H열. GND 핀은 칩 안에서 모두 하나
    for i in range(20):
        for side, name in (("L", LEFT[i]), ("R", RIGHT[i])):
            pin = "Pico.GND" if name in ("GND", "AGND") else f"Pico.{name}"
            union(pin, ("strip", side, i + 1))
    nets = {}
    for x in list(parent):
        if isinstance(x, str):
            nets.setdefault(find(x), set()).add(x)
    got = [s for s in nets.values() if not (len(s) == 1 and next(iter(s)).startswith("Pico."))]
    got_set = {frozenset(s) for s in got}
    exp_set = {frozenset(s) for s in EXPECTED}
    missing, extra = exp_set - got_set, got_set - exp_set
    assert not missing and not extra, f"배선도 ≠ 회로도\n  회로도에만: {missing}\n  배선도에만: {extra}"
    return len(got)


# ════════════════════════════════════════════════════════════════════════
#  2. 배선도 그리기
# ════════════════════════════════════════════════════════════════════════
def Y(r):
    return -float(r)


def XY(hole):
    c, r = hole
    return (RAIL_X[c] if c in RAIL_X else COL[c], Y(r))


def draw_breadboard():
    fig, ax = plt.subplots(figsize=(8.27, 11.69))
    ax.set_xlim(-26.0, 31.0)
    ax.set_ylim(-76, 5.5)
    ax.axis("off")
    BOX = dict(fc="white", ec="none", alpha=0.9, pad=1.2)

    ax.add_patch(FancyBboxPatch((-5.4, Y(64.0)), 21.9, 64.0, boxstyle="round,pad=0.25,rounding_size=0.6",
                                fc="#f4f2ee", ec="#c9c4bc", lw=1.4, zorder=1))
    ax.add_patch(Rectangle((4.55, Y(63.7)), 1.9, 63.4, fc="#e0dbd3", ec="none", zorder=2))

    def hole(x, r, s=0.34):
        ax.add_patch(Rectangle((x - s / 2, Y(r) - s / 2), s, s, fc="white", ec="#8d8880", lw=0.5, zorder=3))

    for r in range(1, NROWS + 1):
        for c in COL:
            hole(COL[c], r)
    for r in RAIL_ROWS:
        for x in RAIL_X.values():
            hole(x, r)
    for x, c in ((RAIL_X["L+"], W_RED), (RAIL_X["R+"], W_RED)):
        ax.plot([x - 0.8] * 2, [Y(1.5), Y(61.5)], color=c, lw=1.5, zorder=2)
    for x in (RAIL_X["L-"], RAIL_X["R-"]):
        ax.plot([x + 0.8] * 2, [Y(1.5), Y(61.5)], color="#2f6fdb", lw=1.5, zorder=2)
    for k, s in (("L+", "+"), ("L-", "-"), ("R+", "+"), ("R-", "-")):
        for rr in (0.5, 62.7):
            ax.text(RAIL_X[k], Y(rr), s, ha="center", va="center", fontsize=8, fontweight="bold",
                    color=W_RED if s == "+" else "#2f6fdb", zorder=4)
    for c in COL:
        for rr in (-0.5, 64.4):
            ax.text(COL[c], Y(rr), c, ha="center", va="center", fontsize=5, color="#6b6660", zorder=4)
    for r in range(1, NROWS + 1, 5):
        ax.text(COL["A"] - 1.1, Y(r), str(r), ha="right", va="center", fontsize=5, color="#6b6660", zorder=4)
    for x, t, col in ((RAIL_X["L+"] - 0.3, "외부 5V", W_5V), (RAIL_X["L-"] + 0.7, "GND", "#2f6fdb"),
                      (RAIL_X["R+"] - 0.3, "(안 씀)", "#999"), (RAIL_X["R-"] + 0.7, "GND", "#2f6fdb")):
        ax.text(x, Y(66.2), t, ha="center", va="center", fontsize=6, color=col, fontweight="bold",
                rotation=90, zorder=4)
    ax.text(-3.5, Y(68.8), "외부 5V 어댑터\n(스마트폰 충전기 5V 2A)", ha="center", va="center", fontsize=5.4,
            color=W_5V, fontweight="bold", linespacing=1.4)

    # Pico 2 W
    ax.add_patch(FancyBboxPatch((1.37, Y(20.55)), 8.26, 20.1, boxstyle="round,pad=0.06,rounding_size=0.35",
                                fc="#1f6b4e", ec="#123f2c", lw=1.0, zorder=6))
    ax.add_patch(FancyBboxPatch((4.35, Y(0.1)), 2.3, 1.05, boxstyle="round,pad=0.04,rounding_size=0.15",
                                fc="#c8ccd0", ec="#8f959b", lw=0.8, zorder=7))
    ax.text(5.5, Y(-1.3), "USB", ha="center", va="center", fontsize=5.5, color="#666")
    used = {"GP10", "GP11", "GP20", "GP22"}
    for i in range(20):
        for cx in (COL["C"], COL["H"]):
            ax.add_patch(Circle((cx, Y(i + 1)), 0.30, fc="#e8c15a", ec="#9c7b1f", lw=0.5, zorder=8))
        ln, rn = LEFT[i], RIGHT[i]
        ax.text(COL["C"] + 0.5, Y(i + 1), ln, ha="left", va="center", fontsize=4.1, zorder=9,
                color="#ffe066" if ln in used else "#bcd8cb", fontweight="bold" if ln in used else "normal")
        hl = rn in used or (rn == "GND" and i + 1 == 18)
        ax.text(COL["H"] - 0.5, Y(i + 1), rn, ha="right", va="center", fontsize=4.1, zorder=9,
                color="#ffe066" if hl else "#bcd8cb", fontweight="bold" if hl else "normal")
    ax.text(5.5, Y(10.5), "Raspberry Pi Pico 2 W", ha="center", va="center", rotation=90, fontsize=5.4,
            color="#e6f2ec", fontweight="bold", zorder=9)

    def ends(p1, p2, color):
        for p in (p1, p2):
            ax.add_patch(Circle(p, 0.2, fc=color, ec="white", lw=0.4, zorder=15))

    def wire(a, b, color, rad=0.15, lw=1.7):
        p1, p2 = XY(a) if isinstance(a, tuple) and isinstance(a[0], str) else a, \
                 XY(b) if isinstance(b, tuple) and isinstance(b[0], str) else b
        ax.add_patch(FancyArrowPatch(p1, p2, connectionstyle=f"arc3,rad={rad}", arrowstyle="-", lw=lw,
                                     color=color, zorder=13, shrinkA=0, shrinkB=0))
        ends(p1, p2, color)

    def lane(a, b, bx, color, lw=1.8):
        (x1, y1), (x2, y2) = XY(a), XY(b)
        verts = [(x1, y1), (bx, y1 + (y2 - y1) * 0.18), (bx, y1 + (y2 - y1) * 0.82), (x2, y2)]
        ax.add_patch(PathPatch(Path(verts, [Path.MOVETO] + [Path.CURVE4] * 3), fc="none", ec=color, lw=lw,
                               zorder=13, capstyle="round"))
        ends((x1, y1), (x2, y2), color)

    def leg_dot(hole, color="#9a9a9a"):
        ax.add_patch(Circle(XY(hole), 0.19, fc=color, ec="none", zorder=11))

    def resistor(a, b, bands, label, lab_side="left"):
        (x1, y1), (x2, y2) = XY(a), XY(b)
        ax.plot([x1, x2], [y1, y2], color="#9a9a9a", lw=1.1, zorder=9)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        vertical = abs(x1 - x2) < 0.01
        L = (abs(y2 - y1) if vertical else abs(x2 - x1)) * 0.55
        w, h = (0.76, L) if vertical else (L, 0.6)
        ax.add_patch(FancyBboxPatch((mx - w / 2, my - h / 2), w, h, boxstyle="round,pad=0.02,rounding_size=0.12",
                                    fc="#e8dcc0", ec="#a89771", lw=0.7, zorder=10))
        for k, bc in enumerate(bands):
            if vertical:
                ax.add_patch(Rectangle((mx - w / 2, my - h / 2 + h * (0.18 + 0.2 * k)), w, h * 0.09,
                                       fc=bc, ec="none", zorder=11))
            else:
                ax.add_patch(Rectangle((mx - w / 2 + w * (0.18 + 0.2 * k), my - h / 2), w * 0.09, h,
                                       fc=bc, ec="none", zorder=11))
        leg_dot(a); leg_dot(b)
        if label:
            if lab_side == "left":
                ax.text(mx - 0.6, my, label, ha="right", va="center", fontsize=5.4, color="#1f3864",
                        fontweight="bold", zorder=14, bbox=BOX)
            else:
                ax.text(mx + 0.6, my, label, ha="left", va="center", fontsize=5.4, color="#1f3864",
                        fontweight="bold", zorder=14, bbox=BOX)

    def diode(k, a, label, side="right"):
        (xk, yk), (xa, ya) = XY(k), XY(a)
        ax.plot([xk, xa], [yk, ya], color="#9a9a9a", lw=1.1, zorder=9)
        my = (yk + ya) / 2
        ax.add_patch(FancyBboxPatch((xk - 0.32, my - 0.6), 0.64, 1.2, boxstyle="round,pad=0.02,rounding_size=0.1",
                                    fc="#222", ec="#000", lw=0.6, zorder=10))
        band_y = my + 0.6 - 0.22 if yk > ya else my - 0.6 + 0.04
        ax.add_patch(Rectangle((xk - 0.32, band_y), 0.64, 0.18, fc="#d8d8d8", ec="none", zorder=11))
        leg_dot(k); leg_dot(a)
        ax.text(xk + (0.6 if side == "right" else -0.6), my, label, ha="left" if side == "right" else "right",
                va="center", fontsize=5.0, color="#1f3864", fontweight="bold", zorder=14, bbox=BOX)

    # ── ① 분압 저항 (갈·검·빨 = 1kΩ, 빨·검·빨 = 2kΩ) ──
    resistor(("C", 30), ("C", 34), ("#8a5a2b", "#000000", "#d92b2b"), "1kΩ")
    resistor(("D", 34), ("D", 38), ("#d92b2b", "#000000", "#d92b2b"), "2kΩ", "right")
    # ── ② PC817 (DIP-4, ① 표시 점이 오른쪽 위) ──
    ax.add_patch(FancyBboxPatch((COL["E"] - 0.3, Y(43.6)), COL["F"] - COL["E"] + 0.6, 2.2,
                                boxstyle="round,pad=0.02,rounding_size=0.15", fc="#2b2b2b", ec="#000", lw=0.7, zorder=10))
    ax.add_patch(Circle((COL["F"] - 0.75, Y(41.95)), 0.16, fc="#bbbbbb", ec="none", zorder=11))
    ax.text((COL["E"] + COL["F"]) / 2, Y(42.95), "PC817", ha="center", va="center", fontsize=5.2,
            color="white", fontweight="bold", zorder=12)
    for leg in LEGS:
        if leg[0] == "U1":
            leg_dot(leg[2], "#cfcfcf")
            c, r = leg[2]
            ax.text(XY(leg[2])[0] + (0.5 if c == "F" else -0.5), Y(r), leg[1].split("(")[0], fontsize=4.4,
                    ha="left" if c == "F" else "right", va="center", color="#b3261e", fontweight="bold", zorder=14)
    resistor(("H", 38), ("H", 42), ("#ff8000", "#ff8000", "#8a5a2b"), "330Ω", "right")
    resistor(("C", 43), ("C", 47), ("#8a5a2b", "#000000", "#d92b2b"), "1kΩ")
    resistor(("A", 47), ("L-", 47), ("#8a5a2b", "#000000", "#ff8000"), "")
    ax.text(-1.5, Y(48.2), "10kΩ", ha="center", va="top", fontsize=5.0, color="#1f3864", fontweight="bold",
            zorder=14, bbox=BOX)
    # S8050 (TO-92, 평평한 면이 오른쪽: 위에서부터 E · B · C)
    ax.add_patch(Polygon([(COL["D"] - 0.15, Y(45.5)), (COL["D"] + 0.75, Y(45.5)), (COL["D"] + 0.75, Y(48.5)),
                          (COL["D"] - 0.15, Y(48.5))], closed=True, fc="#2b2b2b", ec="#000", lw=0.6, zorder=10))
    for nm, r in (("E", 46), ("B", 47), ("C", 48)):
        leg_dot(("D", r), "#cfcfcf")
        ax.text(COL["D"] + 0.32, Y(r), nm, ha="center", va="center", fontsize=4.4, color="white",
                fontweight="bold", zorder=12)
    ax.text(COL["D"] + 1.2, Y(47), "S8050\n(평평한 면)", ha="left", va="center", fontsize=4.8,
            color="#1f3864", fontweight="bold", zorder=14, bbox=BOX, linespacing=1.2)
    # 5V 릴레이 (핀 5개를 E열 50~58행에 그림 — 실제 핀 위치는 제품 바닥 인쇄 확인)
    ax.add_patch(FancyBboxPatch((COL["D"] - 0.55, Y(57.7)), 2.0, 9.4, boxstyle="round,pad=0.05,rounding_size=0.25",
                                fc="#2f6fdb", ec="#1d4f99", lw=0.9, alpha=0.9, zorder=10))
    ax.text(COL["D"] + 0.2, Y(53.0), "5V 릴레이", ha="center", va="center", fontsize=5.4, color="white",
            fontweight="bold", rotation=90, zorder=12)
    for part, leg, h in LEGS:
        if part == "K1":
            leg_dot(h, "#cfcfcf")
            ax.text(COL["E"] + 0.55, Y(h[1]), leg, ha="left", va="center", fontsize=4.8, color="#1f3864",
                    fontweight="bold", zorder=14, bbox=BOX)
    diode(("C", 49), ("C", 51), "D1", "left")
    diode(("C", 55), ("C", 59), "D2", "left")
    # ── ③ LED + 220Ω (빨·빨·갈) ──
    resistor(("G", 24), ("G", 28), ("#d92b2b", "#d92b2b", "#8a5a2b"), "220Ω")
    ax.add_patch(Circle((COL["H"] + 0.5, Y(28.5)), 0.7, fc="#ffe9a8", ec="#c9a227", lw=0.9, zorder=10))
    leg_dot(("H", 28)); leg_dot(("H", 29))
    ax.text(COL["G"] - 0.6, Y(30.6), "LED (긴 다리 = 28행)", ha="center", va="top", fontsize=4.8, color="#1f3864",
            fontweight="bold", zorder=14, bbox=BOX, linespacing=1.2)
    # 커패시터 (기존과 같은 470μF)
    for x in (RAIL_X["L+"], RAIL_X["L-"]):
        ax.plot([x, x], [Y(27), Y(28.3)], color="#9a9a9a", lw=1.2, zorder=9)
        leg_dot((("L+" if x == RAIL_X["L+"] else "L-"), 27))
    ax.add_patch(FancyBboxPatch((RAIL_X["L+"] - 0.4, Y(29.6)), 1.8, 1.3, boxstyle="round,pad=0.05,rounding_size=0.25",
                                fc="#3b4a6b", ec="#1f2b45", lw=0.8, zorder=10))
    ax.text(RAIL_X["L+"], Y(28.95), "+", ha="center", va="center", fontsize=8, color="white", fontweight="bold", zorder=12)
    ax.text(-3.5, Y(30.6), "470μF", ha="center", va="top", fontsize=5.0, color="#1f3864", fontweight="bold", zorder=12, bbox=BOX)

    # ── 점퍼 ──
    lanes = {(("J", 15), ("J", 38)): 13.2, (("J", 12), ("J", 24)): 12.3}
    for a, b, color in WIRES:
        if (a, b) in lanes:
            lane(a, b, lanes[(a, b)], color)
        elif a == ("A", 34):                       # 분압점 → GP11 (B15)
            lane(a, b, -1.6, color)
        elif a == ("B", 48):
            lane(a, b, 1.6, color)
        elif a == ("L-", 60):
            wire(a, b, color, rad=0.03, lw=2.0)
        else:
            wire(a, b, color, rad=0.12)
    ax.text(COL["H"], Y(61.0), "공통 GND", ha="center", va="center", fontsize=5.6,
            color="#b3261e", fontweight="bold", zorder=14, bbox=BOX)

    # ── 보드 밖: HC-SR04 (암-수 점퍼 4개) ──
    hx, hy = -19.0, 18.0
    ax.add_patch(FancyBboxPatch((hx - 4.4, Y(hy + 3.2)), 8.8, 6.4, boxstyle="round,pad=0.05,rounding_size=0.3",
                                fc="#2f6fdb", ec="#1d4f99", lw=1.0, zorder=10))
    for dx in (-2.1, 2.1):
        ax.add_patch(Circle((hx + dx, Y(hy - 0.3)), 1.6, fc="#c9ced6", ec="#8e9aab", lw=1.0, zorder=11))
        ax.add_patch(Circle((hx + dx, Y(hy - 0.3)), 1.0, fc="#9aa3ad", ec="none", zorder=12))
    ax.text(hx, Y(hy + 2.1), "HC-SR04", ha="center", va="center", fontsize=7, color="white", fontweight="bold", zorder=12)
    hc_pins = {"VCC": -3.0, "TRIG": -1.0, "ECHO": 1.0, "GND": 3.0}
    for nm, dx in hc_pins.items():
        p = (hx + dx, Y(hy + 3.9))
        ax.plot([hx + dx, hx + dx], [Y(hy + 3.2), p[1]], color="#bbb", lw=1.5, zorder=9)
        ax.text(hx + dx, Y(hy + 4.6), nm, ha="center", va="center", fontsize=4.6, color="#1f3864",
                fontweight="bold", zorder=14)
    hc_color = {"VCC": W_5V, "TRIG": SIG["GP10"], "ECHO": "#7a4a21", "GND": W_BLK}
    for part, leg, h in OFFBOARD:
        if part == "HC":
            p = (hx + hc_pins[leg], Y(hy + 5.2))
            q = XY(h)
            verts = [p, (p[0], p[1] - 4), (q[0] - 6, q[1]), q]
            ax.add_patch(PathPatch(Path(verts, [Path.MOVETO] + [Path.CURVE4] * 3), fc="none", ec=hc_color[leg],
                                   lw=1.8, zorder=13, capstyle="round"))
            ends(p, q, hc_color[leg])
    ax.text(hx, Y(hy + 7.2), "암-수 점퍼 4개", ha="center", va="center", fontsize=5.6, color="#1f3864",
            fontweight="bold", zorder=14, bbox=BOX)

    # ── 보드 밖: DC 모터 (선 2가닥) ──
    mx, my = -17.0, 56.0
    ax.add_patch(FancyBboxPatch((mx - 3.2, Y(my + 2.2)), 5.0, 4.4, boxstyle="round,pad=0.05,rounding_size=0.6",
                                fc="#b8bec7", ec="#7b838f", lw=1.0, zorder=10))
    ax.add_patch(Rectangle((mx + 1.8, Y(my + 0.4)), 1.4, 0.8, fc="#d9dde3", ec="#7b838f", lw=0.8, zorder=10))
    ax.text(mx - 0.7, Y(my), "DC 모터", ha="center", va="center", fontsize=6.4, color="#1f2328", fontweight="bold", zorder=12)
    for part, leg, h in OFFBOARD:
        if part == "M1":
            p = (mx - 2.0 + (0 if leg == "+" else 2.6), Y(my - 2.2))
            q = XY(h)
            col = W_RED if leg == "+" else W_BLK
            verts = [p, (p[0], p[1] + 3), (q[0] - 5, q[1]), q]
            ax.add_patch(PathPatch(Path(verts, [Path.MOVETO] + [Path.CURVE4] * 3), fc="none", ec=col, lw=1.8,
                                   zorder=13, capstyle="round"))
            ends(p, q, col)
            ax.text(p[0], p[1] + 0.9, leg, ha="center", va="bottom", fontsize=7, color=col, fontweight="bold", zorder=14)

    ax.text(-23.0, Y(-4.3), "추가 배선도", ha="left", va="bottom", fontsize=15, fontweight="bold", color="#1f3864")
    ax.text(-23.0, Y(-2.9), "HC-SR04 초음파 · PC817 릴레이로 DC 모터 on/off · PWM LED 밝기",
            ha="left", va="bottom", fontsize=7.2, color="#555")
    ax.text(-23.0, Y(71.5), "※ 릴레이 핀 위치는 제품마다 다릅니다. 바닥 인쇄로 코일 · COM · NO · NC 를 확인하고 같은 연결이 되게 꽂으세요.",
            ha="left", va="center", fontsize=5.6, color="#b3261e")
    ax.text(-23.0, Y(72.8), "※ 다이오드 띠 · LED 긴 다리 · 470μF 긴 다리(+) 방향을 지키세요. 레일이 가운데서 끊긴 보드면 4줄 모두 이으세요.",
            ha="left", va="center", fontsize=5.6, color="#b3261e")
    return fig


# ════════════════════════════════════════════════════════════════════════
#  3. 회로도 그리기 (표준 기호)
# ════════════════════════════════════════════════════════════════════════
def draw_schematic():
    fig, ax = plt.subplots(figsize=(11.69, 8.27))
    ax.set_xlim(-1.5, 43.5)
    ax.set_ylim(-10.5, 18.5)
    ax.set_aspect("equal")
    ax.axis("off")
    LW, INK = 1.3, "#1f2328"

    def line(*pts, **kw):
        xs, ys = zip(*pts)
        ax.plot(xs, ys, color=kw.get("color", INK), lw=kw.get("lw", LW), ls=kw.get("ls", "-"),
                solid_capstyle="round", zorder=kw.get("z", 5))

    def dot(x, y):
        ax.add_patch(Circle((x, y), 0.13, fc=INK, ec="none", zorder=7))

    def text(x, y, s, **kw):
        ax.text(x, y, s, ha=kw.get("ha", "center"), va=kw.get("va", "center"), fontsize=kw.get("fs", 8),
                color=kw.get("color", INK), fontweight=kw.get("fw", "normal"), zorder=8)

    def vcc(x, y, label="+5V"):
        line((x, y), (x, y + 0.5))
        line((x - 0.45, y + 0.5), (x + 0.45, y + 0.5), lw=1.8)
        text(x, y + 0.95, label, fs=7.5, fw="bold", color="#b35900")

    def gnd(x, y):
        line((x, y), (x, y - 0.45))
        for i, w in enumerate((0.5, 0.33, 0.16)):
            line((x - w, y - 0.45 - i * 0.17), (x + w, y - 0.45 - i * 0.17), lw=1.4)

    def pin(x, y, name, side="left"):
        """Pico 핀 꼬리표 (오각형 깃발)"""
        w, h = 1.9, 0.62
        if side == "left":
            pts = [(x, y), (x - 0.35, y + h / 2), (x - w, y + h / 2), (x - w, y - h / 2), (x - 0.35, y - h / 2)]
            tx = x - w / 2 - 0.15
        else:
            pts = [(x, y), (x + 0.35, y + h / 2), (x + w, y + h / 2), (x + w, y - h / 2), (x + 0.35, y - h / 2)]
            tx = x + w / 2 + 0.15
        ax.add_patch(Polygon(pts, closed=True, fc="#1f6b4e", ec="#123f2c", lw=0.8, zorder=6))
        text(tx, y, name, fs=7, fw="bold", color="white")

    def res(x1, y1, x2, y2, label, lab_off=(0, 0.6)):
        n, vertical = 6, abs(x1 - x2) < 1e-6
        L = abs(y2 - y1) if vertical else abs(x2 - x1)
        body = min(1.6, L * 0.6)
        if vertical:
            sgn = 1 if y2 > y1 else -1
            ya, yb = (y1 + y2) / 2 - sgn * body / 2, (y1 + y2) / 2 + sgn * body / 2
            line((x1, y1), (x1, ya)); line((x1, yb), (x1, y2))
            pts = [(x1, ya)] + [(x1 + (0.3 if i % 2 == 0 else -0.3), ya + (yb - ya) * (i + 0.5) / n) for i in range(n)] + [(x1, yb)]
            line(*pts)
            text(x1 + 0.45 + lab_off[0], (y1 + y2) / 2 + lab_off[1] - 0.6, label, ha="left", fs=7.5, fw="bold")
        else:
            sgn = 1 if x2 > x1 else -1
            xa, xb = (x1 + x2) / 2 - sgn * body / 2, (x1 + x2) / 2 + sgn * body / 2
            line((x1, y1), (xa, y1)); line((xb, y1), (x2, y2))
            pts = [(xa, y1)] + [(xa + (xb - xa) * (i + 0.5) / n, y1 + (0.3 if i % 2 == 0 else -0.3)) for i in range(n)] + [(xb, y1)]
            line(*pts)
            text((x1 + x2) / 2 + lab_off[0], y1 + lab_off[1], label, fs=7.5, fw="bold")

    def diode_v(x, y_k, y_a, label, led=False, lab_side="right"):
        """세로 다이오드 — 캐소드(막대)가 y_k 쪽"""
        mid = (y_k + y_a) / 2
        s = 1 if y_k > y_a else -1
        tip, base = mid + s * 0.35, mid - s * 0.35
        line((x, y_a), (x, base)); line((x, tip), (x, y_k))
        ax.add_patch(Polygon([(x - 0.4, base), (x + 0.4, base), (x, tip)], closed=True,
                             fc="#ffe9a8" if led else "white", ec=INK, lw=LW, zorder=6))
        line((x - 0.4, tip), (x + 0.4, tip), lw=1.6)
        if led:
            for d in (0, 0.38):
                ax.add_patch(FancyArrowPatch((x + 0.5, mid + 0.1 - d), (x + 1.1, mid + 0.55 - d), arrowstyle="-|>",
                                             mutation_scale=6, color=INK, lw=0.9, zorder=6))
        text(x + (0.6 + (0.7 if led else 0) if lab_side == "right" else -0.6), mid, label,
             ha="left" if lab_side == "right" else "right", fs=7.5, fw="bold")

    def npn(x, y, label):
        """베이스가 왼쪽 (x, y). 컬렉터 위 (x+0.9, y+1.1), 이미터 아래 (x+0.9, y-1.1)"""
        ax.add_patch(Circle((x + 0.75, y), 0.85, fc="white", ec=INK, lw=LW, zorder=5))
        line((x, y), (x + 0.45, y))
        line((x + 0.45, y - 0.5), (x + 0.45, y + 0.5), lw=2.0)
        line((x + 0.45, y + 0.22), (x + 0.95, y + 0.65), (x + 0.95, y + 1.1))
        line((x + 0.45, y - 0.22), (x + 0.95, y - 0.65), (x + 0.95, y - 1.1))
        ax.add_patch(FancyArrowPatch((x + 0.6, y - 0.36), (x + 0.92, y - 0.62), arrowstyle="-|>",
                                     mutation_scale=7, color=INK, lw=0.9, zorder=6))
        text(x + 1.85, y, label, ha="left", fs=7.5, fw="bold")
        return (x + 0.95, y + 1.1), (x + 0.95, y - 1.1)

    # ── 제목 ──
    text(-1.0, 17.6, "추가 회로도", ha="left", fs=17, fw="bold", color="#1f3864")
    text(-1.0, 16.4, "Raspberry Pi Pico 2 W  ·  ① HC-SR04 초음파   ② PC817 + 릴레이 → DC 모터 on/off   ③ PWM LED 밝기",
         ha="left", fs=8.5, color="#555")

    def block(x, y, w, h, title):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.1,rounding_size=0.4",
                                    fc="none", ec="#c9ced6", lw=1.0, ls=(0, (4, 3)), zorder=1))
        text(x + 0.3, y + h - 0.45, title, ha="left", fs=9, fw="bold", color="#1f3864")

    # ═══ ① HC-SR04 ═══
    block(-1.0, 1.5, 11.0, 13.6, "① HC-SR04 초음파 거리")
    ax.add_patch(FancyBboxPatch((0.2, 5.2), 2.6, 5.6, boxstyle="round,pad=0.05,rounding_size=0.2",
                                fc="#e7f0fb", ec="#2f6fdb", lw=1.2, zorder=5))
    text(1.5, 10.2, "HC-SR04", fs=8, fw="bold", color="#1d4f99")
    hp = {"VCC": 9.2, "TRIG": 8.0, "ECHO": 6.8, "GND": 5.6}
    for nm, yy in hp.items():
        text(2.65, yy, nm, ha="right", fs=6.8)
        line((2.8, yy), (3.4, yy))
    line((3.4, 9.2), (4.4, 9.2), (4.4, 11.6)); vcc(4.4, 11.6)
    line((3.4, 8.0), (7.6, 8.0)); pin(7.6, 8.0, "GP10", "right")
    res(3.4, 6.8, 6.4, 6.8, "R1 1kΩ")
    dot(6.4, 6.8)
    line((6.4, 6.8), (7.6, 6.8)); pin(7.6, 6.8, "GP11", "right")
    res(6.4, 6.8, 6.4, 3.6, "R2 2kΩ")
    gnd(6.4, 3.6)
    line((3.4, 5.6), (4.0, 5.6), (4.0, 3.6)); gnd(4.0, 3.6)
    text(4.5, 2.25, "GP11 전압 = 5V × 2k / (1k + 2k) ≈ 3.3V", fs=7, color="#5b616e")

    # ═══ ② 릴레이 + DC 모터 ═══
    block(10.6, 1.5, 23.6, 13.6, "② PC817 + 트랜지스터 + 5V 릴레이 → DC 모터 on/off")
    pin(13.2, 9.0, "GP20", "left")
    res(13.2, 9.0, 15.8, 9.0, "R3 330Ω")
    # PC817
    ax.add_patch(Rectangle((15.8, 6.6), 4.2, 3.4, fc="#f6f7f9", ec=INK, lw=LW, zorder=4))
    text(17.9, 10.35, "PC817", fs=8, fw="bold")
    line((15.8, 9.0), (16.6, 9.0), (16.6, 8.75))
    line((15.8, 7.6), (16.6, 7.6), (16.6, 7.85))
    ax.add_patch(Polygon([(16.25, 8.75), (16.95, 8.75), (16.6, 8.15)], closed=True, fc="white", ec=INK, lw=1.1, zorder=6))
    line((16.25, 8.15), (16.95, 8.15), lw=1.5); line((16.6, 8.15), (16.6, 7.85))
    for d in (0, 0.35):
        ax.add_patch(FancyArrowPatch((17.15, 8.65 - d), (17.75, 8.45 - d), arrowstyle="-|>", mutation_scale=6,
                                     color=INK, lw=0.9, zorder=6))
    line((18.2, 7.95), (18.2, 8.85), lw=2.0)
    line((18.2, 8.6), (18.75, 9.0), (20.0, 9.0))
    line((18.2, 8.2), (18.75, 7.6), (20.0, 7.6))
    ax.add_patch(FancyArrowPatch((18.5, 7.95), (18.72, 7.66), arrowstyle="-|>", mutation_scale=6, color=INK, lw=0.9, zorder=6))
    for (xx, yy, n) in ((15.55, 9.25, "1"), (15.55, 7.85, "2"), (20.25, 9.25, "4"), (20.25, 7.85, "3")):
        text(xx, yy, n, fs=6, color="#b3261e", fw="bold")
    line((15.8, 7.6), (14.6, 7.6), (14.6, 5.0)); gnd(14.6, 5.0)
    line((20.0, 9.0), (20.6, 9.0), (20.6, 11.8)); vcc(20.6, 11.8)
    res(20.0, 7.6, 22.6, 7.6, "R4 1kΩ")
    dot(22.6, 7.6)
    res(22.6, 7.6, 22.6, 4.6, "R5 10kΩ", lab_off=(-3.1, 0))
    gnd(22.6, 4.6)
    c_pt, e_pt = npn(22.6, 7.6, "Q1 S8050")
    line(e_pt, (e_pt[0], 4.6)); gnd(e_pt[0], 4.6)
    # 릴레이 코일 + 다이오드
    kx = c_pt[0]
    line(c_pt, (kx, 9.4))
    ax.add_patch(Rectangle((kx - 0.45, 9.4), 0.9, 1.8, fc="white", ec=INK, lw=LW, zorder=5))
    line((kx - 0.45, 9.4), (kx + 0.45, 11.2), lw=0.8)
    line((kx, 11.2), (kx, 12.4)); vcc(kx, 12.4)
    text(kx - 0.65, 10.3, "K1\n코일", ha="right", fs=7, fw="bold")
    dot(kx, 8.9); dot(kx, 11.7)
    line((kx, 8.9), (kx + 1.4, 8.9)); line((kx, 11.7), (kx + 1.4, 11.7))
    diode_v(kx + 1.4, 11.7, 8.9, "D1\n1N4007")
    # 접점 (COM → NO / NC)
    sx = 29.6
    line((sx - 1.0, 12.4), (sx - 1.0, 11.4)); vcc(sx - 1.0, 12.4)
    text(sx - 1.15, 11.0, "COM", ha="right", fs=6.5)
    ax.add_patch(Circle((sx - 1.0, 11.2), 0.12, fc="white", ec=INK, lw=1.0, zorder=6))
    line((sx - 1.0, 11.2), (sx + 0.5, 10.1))
    ax.add_patch(Circle((sx + 0.6, 10.0), 0.12, fc="white", ec=INK, lw=1.0, zorder=6))
    ax.add_patch(Circle((sx + 0.6, 11.6), 0.12, fc="white", ec=INK, lw=1.0, zorder=6))
    text(sx + 0.85, 11.6, "NC (비움)", ha="left", fs=6.5, color="#8a909c")
    text(sx + 0.85, 10.0, "NO", ha="left", fs=6.5)
    line((kx + 0.45, 10.3), (sx - 0.2, 10.6), ls=(0, (3, 2)), lw=0.9, color="#8a909c")
    # 모터 + 다이오드
    line((sx + 0.6, 9.9), (sx + 0.6, 8.6))
    dot(sx + 0.6, 8.6)
    ax.add_patch(Circle((sx + 0.6, 7.4), 0.9, fc="white", ec=INK, lw=LW, zorder=5))
    text(sx + 0.6, 7.4, "M", fs=10, fw="bold")
    line((sx + 0.6, 8.6), (sx + 0.6, 8.3)); line((sx + 0.6, 6.5), (sx + 0.6, 5.6))
    dot(sx + 0.6, 5.6)
    gnd(sx + 0.6, 5.0); line((sx + 0.6, 5.6), (sx + 0.6, 5.0))
    line((sx + 0.6, 8.6), (sx + 2.0, 8.6)); line((sx + 0.6, 5.6), (sx + 2.0, 5.6))
    diode_v(sx + 2.0, 8.6, 5.6, "D2\n1N4007")
    text(sx - 0.6, 7.4, "DC\n모터", ha="right", fs=7, fw="bold")
    text(22.4, 2.25, "PC817 출력(약 3mA)만으로는 코일(약 70mA)을 못 켜므로 Q1 이 증폭 · D1·D2 는 꺼질 때 튀는 전압 흡수",
         fs=7, color="#5b616e")

    # ═══ ③ PWM LED ═══
    block(34.8, 1.5, 8.2, 13.6, "③ PWM LED 밝기")
    pin(37.4, 10.0, "GP22", "left")
    res(37.4, 10.0, 40.4, 10.0, "R6 220Ω")
    line((40.4, 10.0), (40.4, 9.0))
    diode_v(40.4, 6.4, 9.0, "LED", led=True, lab_side="left")
    line((40.4, 6.4), (40.4, 5.0)); gnd(40.4, 5.0)
    text(38.9, 2.25, "약 6mA · duty 로 밝기 조절", fs=7, color="#5b616e")

    # ═══ 아래: 핀 · 부품표 ═══
    text(-1.0, 0.4, "핀", ha="left", fs=9, fw="bold", color="#1f3864")
    rows = [("GP10", "HC-SR04 TRIG"), ("GP11", "HC-SR04 ECHO (분압 후)"), ("GP20", "PC817 입력 (릴레이)"),
            ("GP22", "LED PWM"), ("외부 5V", "HC-SR04 · PC817 출력 · 코일 · 모터"), ("GND", "모두 공통")]
    for i, (a, b) in enumerate(rows):
        text(-1.0, -0.7 - i * 0.95, a, ha="left", fs=7.5, fw="bold")
        text(1.9, -0.7 - i * 0.95, b, ha="left", fs=7.5)
    text(13.0, 0.4, "부품", ha="left", fs=9, fw="bold", color="#1f3864")
    parts = [("R1", "1kΩ (갈·검·빨)"), ("R2", "2kΩ (빨·검·빨)"), ("R3", "330Ω (주·주·갈)"), ("R4", "1kΩ (갈·검·빨)"),
             ("R5", "10kΩ (갈·검·주)"), ("R6", "220Ω (빨·빨·갈)"), ("U1", "PC817 포토커플러"), ("Q1", "S8050 또는 2N2222 (E·B·C)"),
             ("K1", "5V 릴레이 (SRD-05VDC 등)"), ("D1 · D2", "1N4007 (띠 = 캐소드)"), ("LED", "5mm LED (긴 다리 = +)"), ("M", "DC 모터 (5V)")]
    for i, (a, b) in enumerate(parts):
        cx = 13.0 + (i // 6) * 12.5
        cy = -0.7 - (i % 6) * 0.95
        text(cx, cy, a, ha="left", fs=7.5, fw="bold")
        text(cx + 2.4, cy, b, ha="left", fs=7.5)
    return fig


if __name__ == "__main__":
    n = check_netlist()
    print(f"넷 {n}개 — 배선도와 회로도가 같습니다")
    for name, fig in (("추가 회로도", draw_schematic()), ("추가 배선도", draw_breadboard())):
        for ext in ("png", "pdf"):
            out = os.path.join(OUT_DIR, f"{name}.{ext}")
            fig.savefig(out, dpi=300, bbox_inches="tight", facecolor="white")
            print("saved", os.path.normpath(out))
