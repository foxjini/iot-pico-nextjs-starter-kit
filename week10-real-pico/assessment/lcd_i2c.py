# lcd_i2c.py — 16x2 문자 LCD(HD44780) + I2C 변환 모듈(PCF8574) 드라이버 (CircuitPython, 라이브러리 설치 없음)
#
#   PCF8574 핀 → LCD: P0=RS  P1=RW  P2=E  P3=백라이트  P4~P7=D4~D7  (가장 흔한 「1602 I2C」 변환 모듈 배치)
#   주소는 보통 0x27 또는 0x3F — 주지 않으면 I2C 를 훑어 찾습니다.
#
#   쓰는 법
#     import board, busio
#     from lcd_i2c import LCD
#     i2c = busio.I2C(scl=board.GP17, sda=board.GP16, frequency=100_000)
#     lcd = LCD(i2c)            # 주소 자동
#     lcd.print_at(0, 0, "Hello Pico")
#
#   LCD 는 영문 · 숫자 · 기호만 나옵니다 (한글 X).
#
#   글자 뒤집기 (lcd.flip = True) — LCD 를 180° 돌려 놓았을 때(점퍼선이 짧아 I2C 핀을 Pico 쪽으로 둘 때)
#     HD44780 에는 화면을 뒤집는 기능이 없어서, 글자마다 180° 돌린 모양을 사용자 글자(CGRAM 8칸)로 만들어 씁니다.
#     줄 순서와 글자 순서도 거꾸로 써서, 돌려 놓은 LCD 를 바로 보면 똑바로 읽힙니다.
#     0 · 8 · S · I · : 처럼 돌려도 같은 글자, 6↔9 · n↔u · d↔p 처럼 서로 바뀌는 글자는 원래 글자를 그대로 씁니다.
#     한 화면에 그 밖의 글자가 8종류를 넘으면 넘친 글자는 비슷한 글자로 대신합니다 (카드 번호 화면은 보통 8종류 안쪽).
#     lcd.draw(["줄1", "줄2"]) 로 쓰면 flip 에 맞춰 알아서 그립니다.

import time

RS, RW, EN, BL = 0x01, 0x02, 0x04, 0x08
ROW_ADDR = (0x00, 0x40, 0x14, 0x54)

# 5x8 글꼴 (ASCII 0x20~0x7E, 글자마다 세로줄 5바이트 · bit0 = 맨 위) — 뒤집은 글자를 만드는 데만 씁니다
FONT = bytes((
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5F, 0x00, 0x00, 0x00, 0x07, 0x00, 0x07, 0x00,   #  ! "
    0x14, 0x7F, 0x14, 0x7F, 0x14, 0x24, 0x2A, 0x7F, 0x2A, 0x12, 0x23, 0x13, 0x08, 0x64, 0x62,   # # $ %
    0x36, 0x49, 0x55, 0x22, 0x50, 0x00, 0x05, 0x03, 0x00, 0x00, 0x00, 0x1C, 0x22, 0x41, 0x00,   # & ' (
    0x00, 0x41, 0x22, 0x1C, 0x00, 0x14, 0x08, 0x3E, 0x08, 0x14, 0x08, 0x08, 0x3E, 0x08, 0x08,   # ) * +
    0x00, 0x50, 0x30, 0x00, 0x00, 0x08, 0x08, 0x08, 0x08, 0x08, 0x00, 0x60, 0x60, 0x00, 0x00,   # , - .
    0x20, 0x10, 0x08, 0x04, 0x02, 0x3E, 0x51, 0x49, 0x45, 0x3E, 0x00, 0x42, 0x7F, 0x40, 0x00,   # / 0 1
    0x42, 0x61, 0x51, 0x49, 0x46, 0x21, 0x41, 0x45, 0x4B, 0x31, 0x18, 0x14, 0x12, 0x7F, 0x10,   # 2 3 4
    0x27, 0x45, 0x45, 0x45, 0x39, 0x3C, 0x4A, 0x49, 0x49, 0x30, 0x01, 0x71, 0x09, 0x05, 0x03,   # 5 6 7
    0x36, 0x49, 0x49, 0x49, 0x36, 0x06, 0x49, 0x49, 0x29, 0x1E, 0x00, 0x36, 0x36, 0x00, 0x00,   # 8 9 :
    0x00, 0x56, 0x36, 0x00, 0x00, 0x08, 0x14, 0x22, 0x41, 0x00, 0x14, 0x14, 0x14, 0x14, 0x14,   # ; < =
    0x00, 0x41, 0x22, 0x14, 0x08, 0x02, 0x01, 0x51, 0x09, 0x06, 0x32, 0x49, 0x79, 0x41, 0x3E,   # > ? @
    0x7E, 0x11, 0x11, 0x11, 0x7E, 0x7F, 0x49, 0x49, 0x49, 0x36, 0x3E, 0x41, 0x41, 0x41, 0x22,   # A B C
    0x7F, 0x41, 0x41, 0x22, 0x1C, 0x7F, 0x49, 0x49, 0x49, 0x41, 0x7F, 0x09, 0x09, 0x09, 0x01,   # D E F
    0x3E, 0x41, 0x49, 0x49, 0x7A, 0x7F, 0x08, 0x08, 0x08, 0x7F, 0x00, 0x41, 0x7F, 0x41, 0x00,   # G H I
    0x20, 0x40, 0x41, 0x3F, 0x01, 0x7F, 0x08, 0x14, 0x22, 0x41, 0x7F, 0x40, 0x40, 0x40, 0x40,   # J K L
    0x7F, 0x02, 0x0C, 0x02, 0x7F, 0x7F, 0x04, 0x08, 0x10, 0x7F, 0x3E, 0x41, 0x41, 0x41, 0x3E,   # M N O
    0x7F, 0x09, 0x09, 0x09, 0x06, 0x3E, 0x41, 0x51, 0x21, 0x5E, 0x7F, 0x09, 0x19, 0x29, 0x46,   # P Q R
    0x46, 0x49, 0x49, 0x49, 0x31, 0x01, 0x01, 0x7F, 0x01, 0x01, 0x3F, 0x40, 0x40, 0x40, 0x3F,   # S T U
    0x1F, 0x20, 0x40, 0x20, 0x1F, 0x3F, 0x40, 0x38, 0x40, 0x3F, 0x63, 0x14, 0x08, 0x14, 0x63,   # V W X
    0x07, 0x08, 0x70, 0x08, 0x07, 0x61, 0x51, 0x49, 0x45, 0x43, 0x00, 0x7F, 0x41, 0x41, 0x00,   # Y Z [
    0x02, 0x04, 0x08, 0x10, 0x20, 0x00, 0x41, 0x41, 0x7F, 0x00, 0x04, 0x02, 0x01, 0x02, 0x04,   # \ ] ^
    0x40, 0x40, 0x40, 0x40, 0x40, 0x00, 0x01, 0x02, 0x04, 0x00, 0x20, 0x54, 0x54, 0x54, 0x78,   # _ ` a
    0x7F, 0x48, 0x44, 0x44, 0x38, 0x38, 0x44, 0x44, 0x44, 0x20, 0x38, 0x44, 0x44, 0x48, 0x7F,   # b c d
    0x38, 0x54, 0x54, 0x54, 0x18, 0x08, 0x7E, 0x09, 0x01, 0x02, 0x0C, 0x52, 0x52, 0x52, 0x3E,   # e f g
    0x7F, 0x08, 0x04, 0x04, 0x78, 0x00, 0x44, 0x7D, 0x40, 0x00, 0x20, 0x40, 0x44, 0x3D, 0x00,   # h i j
    0x7F, 0x10, 0x28, 0x44, 0x00, 0x00, 0x41, 0x7F, 0x40, 0x00, 0x7C, 0x04, 0x18, 0x04, 0x78,   # k l m
    0x7C, 0x08, 0x04, 0x04, 0x78, 0x38, 0x44, 0x44, 0x44, 0x38, 0x7C, 0x14, 0x14, 0x14, 0x08,   # n o p
    0x08, 0x14, 0x14, 0x18, 0x7C, 0x7C, 0x08, 0x04, 0x04, 0x08, 0x48, 0x54, 0x54, 0x54, 0x20,   # q r s
    0x04, 0x3F, 0x44, 0x40, 0x20, 0x3C, 0x40, 0x40, 0x20, 0x7C, 0x1C, 0x20, 0x40, 0x20, 0x1C,   # t u v
    0x3C, 0x40, 0x30, 0x40, 0x3C, 0x44, 0x28, 0x10, 0x28, 0x44, 0x0C, 0x50, 0x50, 0x50, 0x3C,   # w x y
    0x44, 0x64, 0x54, 0x4C, 0x44, 0x00, 0x08, 0x36, 0x41, 0x00, 0x00, 0x00, 0x7F, 0x00, 0x00,   # z { |
    0x00, 0x41, 0x36, 0x08, 0x00, 0x08, 0x08, 0x2A, 0x1C, 0x08,                                 # } ~
))
# 180° 돌려도 LCD 에 이미 있는 글자 — 사용자 글자 칸을 쓰지 않음.
#   위아래 높이를 꽉 채우는 글자(대문자 · 숫자 · 기호)만 씁니다. 소문자는 돌리면 줄 위쪽에 매달려 보여서 사용자 글자로 그립니다.
#   '.' 은 「'」 를 씁니다 (돌리면 아래쪽 점이 됨) — 카드 번호 화면에서 칸을 아끼려고.
FLIP_SAME = {" ": " ", "0": "0", "8": "8", "6": "9", "9": "6", "H": "H", "I": "I", "N": "N", "O": "O",
             "S": "S", "X": "X", "Z": "Z", "-": "-", "=": "=", "+": "+", ":": ":", "*": "*", "#": "#",
             "%": "%", "|": "|", "/": "/", "(": ")", ")": "(", "<": ">", ">": "<", "[": "]", "]": "[",
             ".": "'", ",": "'"}
# 사용자 글자 8칸이 모자랄 때 대신 쓰는 비슷한 글자 (돌려 놓고 보면 원래 글자와 비슷한 것)
FLIP_NEAR = {"A": "V", "V": "A", "E": "3", "3": "E", "7": "L", "L": "7", "2": "Z", "5": "S", "1": "l",
             "4": "h", "h": "4", "M": "W", "W": "M", "C": ")", "D": "O", "B": "8", "P": "d", "K": "X",
             "!": "i", "i": "!", "'": ","}


def flipped_glyph(ch):
    """글자를 180° 돌린 5x8 모양 (CGRAM 8바이트). 글자는 위 7줄 안에 있으므로 7줄 안에서 돌림 (8번째 줄 = 커서 자리)"""
    c = ord(ch) if 32 <= ord(ch) < 127 else ord("?")
    cols = FONT[(c - 32) * 5:(c - 32) * 5 + 5]
    h = 8 if any(b & 0x80 for b in cols) else 7
    rows = bytearray(8)
    for r in range(h):
        old = h - 1 - r
        for x in range(5):
            if (cols[4 - x] >> old) & 1:
                rows[r] |= 1 << (4 - x)
    return bytes(rows)


def find_address(i2c):
    """I2C 에서 LCD 로 보이는 주소를 찾습니다. 없으면 None."""
    while not i2c.try_lock():
        pass
    try:
        found = i2c.scan()
    finally:
        i2c.unlock()
    for a in (0x27, 0x3F):                      # 가장 흔한 두 주소 먼저
        if a in found:
            return a
    for a in found:
        if 0x20 <= a <= 0x27 or 0x38 <= a <= 0x3F:   # PCF8574 / PCF8574A 범위
            return a
    return None


class LCD:
    def __init__(self, i2c, address=None, cols=16, rows=2):
        self.i2c = i2c
        self.address = address if address is not None else find_address(i2c)
        if self.address is None:
            raise OSError("LCD 를 찾지 못했습니다 (I2C 주소 없음)")
        self.cols, self.rows = cols, rows
        self.bl = BL
        self.flip = False
        self._slots = [None] * 8                # 사용자 글자 칸 0~7 에 지금 들어 있는 글자
        time.sleep(0.05)                        # 전원이 켜진 뒤 LCD 가 준비될 때까지
        for _ in range(3):                      # 8비트 모드로 세 번 → 어떤 상태에서든 초기화
            self._nibble(0x30)
            time.sleep(0.005)
        self._nibble(0x20)                      # 4비트 모드로
        time.sleep(0.001)
        self.command(0x28)                      # 4비트 · 2줄 · 5x8 글자
        self.command(0x0C)                      # 화면 켜기 · 커서 끄기
        self.clear()
        self.command(0x06)                      # 글자를 쓰면 오른쪽으로

    # ── 저수준 ──
    def _write(self, data):
        while not self.i2c.try_lock():
            pass
        try:
            self.i2c.writeto(self.address, bytes(data))
        finally:
            self.i2c.unlock()

    def _nibble(self, value, mode=0):
        # 위 4비트만 보냅니다. E 를 올렸다 내리면 LCD 가 읽습니다.
        d = (value & 0xF0) | self.bl | mode
        self._write((d, d | EN, d))

    def _send(self, value, mode):
        hi = (value & 0xF0) | self.bl | mode
        lo = ((value << 4) & 0xF0) | self.bl | mode
        self._write((hi, hi | EN, hi, lo, lo | EN, lo))

    # ── 사용 ──
    def command(self, value):
        self._send(value, 0)
        if value in (0x01, 0x02):               # 지우기 · 처음으로 는 오래 걸림
            time.sleep(0.002)

    def clear(self):
        self.command(0x01)

    def move_to(self, col, row):
        self.command(0x80 | (ROW_ADDR[row] + col))

    def write(self, text):
        for ch in text:
            c = ord(ch)
            self._send(c if 32 <= c < 127 else ord("?"), RS)

    def print_at(self, col, row, text, pad=True):
        """(col, row) 부터 text 를 씁니다. pad=True 면 줄 끝까지 빈칸으로 덮어 이전 글자를 지웁니다."""
        text = str(text)[: self.cols - col]
        if pad:
            text = text + " " * (self.cols - col - len(text))
        self.move_to(col, row)
        self.write(text)

    def _raw(self, codes):
        for c in codes:
            self._send(c, RS)

    def _define(self, slot, glyph):
        self.command(0x40 | (slot << 3))        # CGRAM 주소
        for b in glyph:
            self._send(b, RS)

    def draw(self, lines):
        """두 줄을 화면에 씁니다. flip 이면 180° 돌려 놓은 LCD 에서 똑바로 읽히게 거꾸로 그립니다."""
        rows = [("%-*s" % (self.cols, lines[i] if i < len(lines) else ""))[: self.cols] for i in range(2)]
        if not self.flip:
            for i in range(2):
                self.print_at(0, i, rows[i])
            return
        need = []                               # 사용자 글자가 필요한 글자 (1줄 먼저 — 카드 번호가 더 중요)
        for ch in rows[0] + rows[1]:
            if ch not in FLIP_SAME and ch not in need:
                need.append(ch)
        keep = [c for c in need if c in self._slots]
        for ch in need:                         # 이미 칸에 있는 글자는 그대로 두고, 빈 칸 · 안 쓰는 칸에 새 글자
            if ch in self._slots:
                continue
            free = [i for i, c in enumerate(self._slots) if c is None or (c not in keep and c not in need)]
            if not free:
                break
            self._slots[free[0]] = ch
            keep.append(ch)
            self._define(free[0], flipped_glyph(ch))

        def code(ch):
            if ch in FLIP_SAME:
                return ord(FLIP_SAME[ch])
            if ch in self._slots:
                return self._slots.index(ch)
            return ord(FLIP_NEAR.get(ch, "?"))     # 8칸이 모자라면 비슷한 글자로

        for phys, logical in ((0, rows[1]), (1, rows[0])):     # 화면 위 = 원래 2줄을 거꾸로
            self.move_to(0, phys)
            self._raw(code(ch) for ch in reversed(logical))

    def backlight(self, on=True):
        self.bl = BL if on else 0
        self._write((self.bl,))
