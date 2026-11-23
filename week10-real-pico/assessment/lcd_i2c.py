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

import time

RS, RW, EN, BL = 0x01, 0x02, 0x04, 0x08
ROW_ADDR = (0x00, 0x40, 0x14, 0x54)


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

    def backlight(self, on=True):
        self.bl = BL if on else 0
        self._write((self.bl,))
