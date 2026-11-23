# test1_joystick.py — 조이스틱만 시험 (code.py 로 저장해서 실행)
#   배선: GND → GND, +5V 핀 → 3V3 (★ 5V 아님!), VRx → GP26, VRy → GP27, SW → GP22
#   +5V 핀에 5V 를 넣으면 출력이 5V 까지 올라가 Pico ADC(최대 3.3V)를 넘습니다.
#   시리얼 모니터: 가만히 두면 X · Y 가 0% 근처, 끝까지 밀면 ±100% 근처, 누르면 SW = 눌림
import time
import board
import analogio
import digitalio

vrx = analogio.AnalogIn(board.GP26)
vry = analogio.AnalogIn(board.GP27)
sw = digitalio.DigitalInOut(board.GP22)
sw.switch_to_input(pull=digitalio.Pull.UP)      # 누르면 GND 에 붙어 LOW

print("조이스틱을 건드리지 말고 1초 기다리세요 — 가운데 값을 잽니다")
time.sleep(0.5)
cx = sum(vrx.value for _ in range(32)) // 32
cy = sum(vry.value for _ in range(32)) // 32
print("가운데 X=%d Y=%d (0~65535, 보통 30000~35000)" % (cx, cy))
if not 20000 < cx < 45000 or not 20000 < cy < 45000:
    print("[주의] 가운데 값이 이상합니다 — +5V 핀이 3V3 에 연결됐는지, VRx·VRy 가 GP26·GP27 인지 확인")


def percent(v, c):
    span = c if v < c else 65535 - c
    return round((v - c) * 100 / span) if span else 0


while True:
    x, y = vrx.value, vry.value
    print("X %5d (%+4d%%)   Y %5d (%+4d%%)   SW %s" % (x, percent(x, cx), y, percent(y, cy), "눌림" if not sw.value else "-"))
    time.sleep(0.2)
