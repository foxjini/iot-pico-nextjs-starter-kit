# mfrc522_lite.py — RFID-RC522(MFRC522) 카드 번호(UID) 읽기 전용 드라이버 (CircuitPython, 라이브러리 설치 없음)
#
#   RC522 는 3.3V 전용입니다. 5V 에 연결하면 망가질 수 있습니다.
#   SPI 모드 0, 최대 10MHz — 브레드보드 점퍼에서는 1MHz 로 충분하고 안정적입니다.
#
#   쓰는 법
#     import board, busio
#     from mfrc522_lite import MFRC522
#     spi = busio.SPI(board.GP18, MOSI=board.GP19, MISO=board.GP20)
#     rfid = MFRC522(spi, cs=board.GP21)   # RST 핀을 3.3V 에 이으면 rst 생략 (init 에서 소프트 리셋)
#     print(hex(rfid.version()))        # 0x91 · 0x92 = 정품, 0x00 · 0xFF = 연결 안 됨
#     uid = rfid.read_uid()             # 카드가 없으면 None, 있으면 4바이트 bytes
#
#   읽는 것은 UID 1단계(4바이트)입니다 — 함께 들어 있는 흰색 카드 · 키태그(MIFARE Classic 1K)가 여기에 해당합니다.

import time
import digitalio

# 레지스터
COMMAND, COM_IEN, COM_IRQ, ERROR, FIFO_DATA, FIFO_LEVEL = 0x01, 0x02, 0x04, 0x06, 0x09, 0x0A
CONTROL, BIT_FRAMING, MODE, TX_CONTROL, TX_ASK = 0x0C, 0x0D, 0x11, 0x14, 0x15
T_MODE, T_PRESCALER, T_RELOAD_H, T_RELOAD_L, VERSION = 0x2A, 0x2B, 0x2C, 0x2D, 0x37
# 명령
IDLE, TRANSCEIVE, SOFT_RESET = 0x00, 0x0C, 0x0F
REQA, ANTICOLL_CL1 = 0x26, 0x93


class MFRC522:
    def __init__(self, spi, cs, rst=None, baudrate=1_000_000):
        self.spi = spi
        self.baudrate = baudrate
        self.cs = digitalio.DigitalInOut(cs)
        self.cs.switch_to_output(value=True)
        self.rst = None
        if rst is not None:
            self.rst = digitalio.DigitalInOut(rst)
            self.rst.switch_to_output(value=False)      # 잠깐 LOW → 하드웨어 리셋
            time.sleep(0.01)
            self.rst.value = True
            time.sleep(0.05)
        self._buf = bytearray(2)
        self.init()

    # ── SPI 한 바이트 읽기 · 쓰기 ──
    def _lock(self):
        while not self.spi.try_lock():
            pass
        self.spi.configure(baudrate=self.baudrate, polarity=0, phase=0)

    def write(self, reg, value):
        self._lock()
        try:
            self.cs.value = False
            self.spi.write(bytes(((reg << 1) & 0x7E, value & 0xFF)))
            self.cs.value = True
        finally:
            self.spi.unlock()

    def read(self, reg):
        self._lock()
        try:
            self.cs.value = False
            self.spi.write_readinto(bytes((((reg << 1) & 0x7E) | 0x80, 0)), self._buf)
            self.cs.value = True
        finally:
            self.spi.unlock()
        return self._buf[1]

    def set_bits(self, reg, mask):
        self.write(reg, self.read(reg) | mask)

    def clear_bits(self, reg, mask):
        self.write(reg, self.read(reg) & ~mask)

    # ── 준비 ──
    def version(self):
        return self.read(VERSION)

    def init(self):
        self.write(COMMAND, SOFT_RESET)
        time.sleep(0.05)
        self.write(T_MODE, 0x8D)                 # 타이머: 자동 시작, 분주 상위
        self.write(T_PRESCALER, 0x3E)            # → 약 2kHz
        self.write(T_RELOAD_L, 30)               # 30 틱 ≈ 15ms 안에 답이 없으면 「카드 없음」
        self.write(T_RELOAD_H, 0)
        self.write(TX_ASK, 0x40)                 # 100% ASK 변조
        self.write(MODE, 0x3D)                   # CRC 초기값 0x6363
        if (self.read(TX_CONTROL) & 0x03) != 0x03:
            self.set_bits(TX_CONTROL, 0x03)      # 안테나 켜기

    # ── 카드와 주고받기 ──
    def _transceive(self, data, last_bits=0):
        """data 를 보내고 (받은 바이트, 받은 비트 수) 를 돌려줍니다. 실패하면 (None, 0)."""
        self.write(COM_IEN, 0x77 | 0x80)
        self.clear_bits(COM_IRQ, 0x80)           # 인터럽트 표시 모두 지우기
        self.set_bits(FIFO_LEVEL, 0x80)          # FIFO 비우기
        self.write(COMMAND, IDLE)
        for b in data:
            self.write(FIFO_DATA, b)
        self.write(BIT_FRAMING, last_bits & 0x07)
        self.write(COMMAND, TRANSCEIVE)
        self.set_bits(BIT_FRAMING, 0x80)         # 보내기 시작
        n = 0
        for _ in range(400):                     # 타이머(약 15ms)가 끝날 때까지 기다림
            n = self.read(COM_IRQ)
            if n & 0x30 or n & 0x01:             # 받기 끝 · 쉼 · 시간 초과
                break
        self.clear_bits(BIT_FRAMING, 0x80)
        if not (n & 0x30) or (n & 0x01):         # 시간 초과 = 카드 없음
            return None, 0
        if self.read(ERROR) & 0x1B:              # 버퍼 넘침 · 충돌 · 패리티 · 프로토콜 오류
            return None, 0
        count = self.read(FIFO_LEVEL)
        last = self.read(CONTROL) & 0x07
        bits = (count - 1) * 8 + last if last else count * 8
        return bytes(self.read(FIFO_DATA) for _ in range(count)), bits

    def request(self):
        """카드가 안테나 위에 있으면 True."""
        back, bits = self._transceive((REQA,), last_bits=7)
        return back is not None and bits == 16

    def anticoll(self):
        """UID 4바이트를 읽습니다. BCC(검사 바이트)가 맞지 않으면 None."""
        back, _ = self._transceive((ANTICOLL_CL1, 0x20))
        if back is None or len(back) != 5:
            return None
        if back[0] ^ back[1] ^ back[2] ^ back[3] != back[4]:
            return None
        return back[:4]

    def read_uid(self):
        """카드가 있으면 UID(bytes 4개), 없으면 None."""
        if not self.request():
            return None
        return self.anticoll()


def uid_hex(uid, sep=" "):
    """b'\\xde\\xad\\xbe\\xef' → 'DE AD BE EF'"""
    return sep.join("%02X" % b for b in uid)
