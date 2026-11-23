# test4_rfid.py — RFID-RC522 만 시험 (code.py 로 저장해서 실행, 같은 폴더에 mfrc522_lite.py 필요)
#   배선: 3.3V → 3V3 (★ 5V 금지),  RST → GP20,  GND → GND,  IRQ → 비움,
#         MISO → GP16,  MOSI → GP19,  SCK → GP18,  SDA → GP17
#   카드나 키태그를 리더기 가운데(원 무늬)에 1~3cm 로 대면 번호가 나옵니다.
import time
import board
import busio
from mfrc522_lite import MFRC522, uid_hex

spi = busio.SPI(board.GP18, MOSI=board.GP19, MISO=board.GP16)
rfid = MFRC522(spi, cs=board.GP17, rst=board.GP20)
v = rfid.version()
print("RC522 버전 레지스터: 0x%02X" % v, "(0x91 · 0x92 = 정품, 그 밖의 값 = 호환 칩일 수 있음)")
if v in (0x00, 0xFF):
    print("[실패] RC522 가 응답하지 않습니다 — 3.3V · GND, SCK=GP18 · MOSI=GP19 · MISO=GP16 · SDA=GP17 확인")
    while True:
        time.sleep(1)
print("카드를 대 보세요")
# 카드는 한 번 읽히면 다음 요청 한 번을 건너뛰고 답합니다(ISO 14443 의 READY 상태).
# 그래서 「1초 안에 다시 보인 같은 카드」 는 계속 대고 있는 것으로 봅니다.
shown, seen = None, 0.0
while True:
    uid = rfid.read_uid()
    now = time.monotonic()
    if uid:
        if uid != shown or now - seen > 1.0:
            print("카드 UID:", uid_hex(uid))
        shown, seen = uid, now
    time.sleep(0.15)
