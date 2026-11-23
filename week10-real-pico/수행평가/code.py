# code.py — 3차 수행평가: 조이스틱으로 스텝모터 돌리기 + RFID 카드 번호를 LCD 에 표시 (Pico 2 W · CircuitPython 10)
#
#   CIRCUITPY 루트에 이 파일과 lcd_i2c.py · mfrc522_lite.py 를 함께 넣습니다 (lib 설치 필요 없음).
#   배선은 worksheets/수행평가 배선도.pdf.  먼저 test1~test4 로 부품을 하나씩 확인한 뒤 이 파일을 쓰세요.
#
#   동작
#     · 조이스틱 X 를 오른쪽으로 → 모터 시계 방향, 왼쪽으로 → 반시계. 많이 기울일수록 빠름. 놓으면 멈추고 코일을 끔
#     · 조이스틱 버튼(누르기) → 지금 위치를 0° 로
#     · RFID 카드 · 키태그를 대면 LCD 1줄 「Card UID:」, 2줄에 번호(16진수)
#     · 시리얼 모니터: 조이스틱 % · 모터 각도 · 카드 번호.  내장 LED 깜빡임 = 동작 중
#
#   핀
#     조이스틱  VRx GP26 · VRy GP27 · SW GP22 · +5V 핀 ← 3V3(★)
#     스텝모터  ULN2003 IN1~IN4 = GP10 · GP11 · GP12 · GP13 · + ← 외부 5V
#     LCD      I2C0 SDA GP4 · SCL GP5 (레벨 변환 거쳐서) · VCC ← 외부 5V
#     RFID     SPI0 SCK GP18 · MOSI GP19 · MISO GP16 · SDA(CS) GP17 · RST GP20 · 3.3V ← 3V3(★ 5V 금지)

import time
import board
import busio
import analogio
import digitalio

from lcd_i2c import LCD
from mfrc522_lite import MFRC522, uid_hex

# ── 설정 ──
DEADZONE = 7            # 가운데 ±7% 는 「가만히」 로 봄 (조이스틱마다 가운데 값이 조금씩 다름)
FAST_NS = 1_300_000     # 끝까지 기울였을 때 반 스텝 간격 1.3ms (≈ 11 rpm, 28BYJ-48 의 거의 최고 속도)
SLOW_NS = 8_000_000     # 조금 기울였을 때 8ms
STEPS_PER_REV = 4096    # 반 스텝 기준 한 바퀴
RFID_EVERY_NS = 250_000_000
PRINT_EVERY_NS = 500_000_000
HALF = ((1, 0, 0, 0), (1, 1, 0, 0), (0, 1, 0, 0), (0, 1, 1, 0),
        (0, 0, 1, 0), (0, 0, 1, 1), (0, 0, 0, 1), (1, 0, 0, 1))

# ── 장치 준비 (하나가 안 돼도 나머지는 동작하게) ──
led = digitalio.DigitalInOut(board.LED)
led.switch_to_output(value=False)

vrx = analogio.AnalogIn(board.GP26)
vry = analogio.AnalogIn(board.GP27)
sw = digitalio.DigitalInOut(board.GP22)
sw.switch_to_input(pull=digitalio.Pull.UP)

coils = []
for p in (board.GP10, board.GP11, board.GP12, board.GP13):
    c = digitalio.DigitalInOut(p)
    c.switch_to_output(value=False)
    coils.append(c)

lcd = None
try:
    lcd = LCD(busio.I2C(scl=board.GP5, sda=board.GP4, frequency=100_000))
    lcd.print_at(0, 0, "Tap RFID card")
    lcd.print_at(0, 1, "Joystick: motor")
    print("[준비] LCD 주소", hex(lcd.address))
except Exception as e:      # noqa: BLE001 — 어떤 이유든 LCD 없이 계속
    print("[준비] LCD 를 못 찾음 — SDA=GP4 · SCL=GP5 · 레벨 변환(LV=3V3, HV=5V) · LCD VCC=5V · GND 공통 확인:", e)

rfid = None
try:
    rfid = MFRC522(busio.SPI(board.GP18, MOSI=board.GP19, MISO=board.GP16), cs=board.GP17, rst=board.GP20)
    v = rfid.version()
    if v in (0x00, 0xFF):
        raise OSError("버전 레지스터 0x%02X" % v)
    print("[준비] RC522 버전 0x%02X" % v)
except Exception as e:      # noqa: BLE001
    rfid = None
    print("[준비] RC522 응답 없음 — 3.3V(5V 금지) · GND · SCK=GP18 · MOSI=GP19 · MISO=GP16 · SDA=GP17 · RST=GP20 확인:", e)

time.sleep(0.3)
cx = sum(vrx.value for _ in range(32)) // 32           # 켜질 때 조이스틱을 건드리지 않은 값 = 가운데
cy = sum(vry.value for _ in range(32)) // 32
print("[준비] 조이스틱 가운데 X=%d Y=%d" % (cx, cy))
if not 20000 < cx < 45000:
    print("[주의] 조이스틱 가운데 값이 이상합니다 — +5V 핀을 3V3 에 꽂았는지, VRx=GP26 인지 확인")


def percent(v, c):
    span = c if v < c else 65535 - c
    return max(-100, min(100, round((v - c) * 100 / span))) if span else 0


def set_coils(pattern):
    for c, v in zip(coils, pattern):
        c.value = v


def release():
    set_coils((0, 0, 0, 0))


phase = 0               # 반 스텝 순서 0~7
position = 0            # 기준점에서 몇 반 스텝 왔는지 (+ = 시계)
moving = False
next_step = next_rfid = next_print = next_blink = time.monotonic_ns()
shown_uid, seen_at = None, 0
sw_was = True
print("시작 — 조이스틱을 좌우로 기울여 보세요. 카드를 대 보세요.")

try:
    while True:
        now = time.monotonic_ns()
        px, py = percent(vrx.value, cx), percent(vry.value, cy)

        # 버튼: 누르는 순간 위치를 0 으로
        pressed = not sw.value
        if pressed and sw_was:
            position = 0
            print("[버튼] 지금 위치를 0° 로")
        sw_was = not pressed

        # 스텝모터: 기울기 → 방향 · 간격
        if abs(px) > DEADZONE:
            if not moving:
                next_step = now
                moving = True
            if now >= next_step:
                direction = 1 if px > 0 else -1
                phase = (phase + direction) % 8
                set_coils(HALF[phase])
                position += direction
                k = (abs(px) - DEADZONE) / (100 - DEADZONE)        # 0 ~ 1
                interval = int(SLOW_NS - (SLOW_NS - FAST_NS) * k)
                next_step += interval
                if next_step < now:                                 # 늦었으면 따라잡지 말고 지금부터
                    next_step = now + interval
        elif moving:
            moving = False
            release()                                               # 멈추면 코일 끄기 — 발열 · 전류 줄임

        # RFID → LCD
        if rfid and now >= next_rfid:
            next_rfid = now + RFID_EVERY_NS * (3 if moving else 1)    # 모터가 돌 때는 덜 자주 (읽는 동안 모터가 잠깐 멈추므로)
            try:
                uid = rfid.read_uid()
            except Exception as e:      # noqa: BLE001
                uid = None
                print("[RFID] 읽기 오류:", e)
            if uid:
                # 카드는 한 번 읽히면 다음 요청을 한 번 건너뜀 → 1초 안에 다시 보인 같은 카드는 「계속 대고 있음」
                if uid != shown_uid or now - seen_at > 1_000_000_000:
                    text = uid_hex(uid)
                    print("[RFID] 카드 UID:", text)
                    if lcd:
                        lcd.print_at(0, 0, "Card UID:")
                        lcd.print_at(0, 1, text)
                shown_uid, seen_at = uid, now

        # 시리얼 · 동작 표시
        if now >= next_print:
            next_print = now + PRINT_EVERY_NS
            angle = position * 360 / STEPS_PER_REV
            print("[조이스틱] X %+4d%% Y %+4d%% · [모터] %s %7.1f°" % (
                px, py, ("시계" if px > 0 else "반시계") if moving else "정지", angle))
        if now >= next_blink:
            next_blink = now + 500_000_000
            led.value = not led.value
        time.sleep(0.0002)
except KeyboardInterrupt:
    print("멈춥니다.")
finally:
    release()
    led.value = False
    if lcd:
        try:
            lcd.print_at(0, 0, "Stopped")
            lcd.print_at(0, 1, "")
        except Exception:       # noqa: BLE001
            pass
