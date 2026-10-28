# code.py — 실물 하드웨어 단독 점검 (백엔드와 연동하기 전에)
#
#   worksheets/최종_배선도.pdf 대로 조립한 Pico 2 W(또는 Pico W)가
#   센서 · 액추에이터와 함께 제대로 도는지 **Pico 혼자서** 확인합니다.
#   Wi-Fi · WebSocket 을 쓰지 않으므로 settings.toml(공유기 비밀번호)이 필요 없습니다.
#
#   쓰는 법
#     ① CIRCUITPY 루트에 code.py 로 저장합니다 (main.py 대신 이것이 실행됩니다)
#     ② VS Code 시리얼 모니터로 Pico 포트를 엽니다
#     ③ 점검이 끝나면 code.py 를 지우거나 code.py.bak 으로 바꿉니다
#        ← 안 지우면 main.py 가 영영 실행되지 않습니다 (가장 흔한 함정)
#
#   핀 · 라이브러리 · 읽는 방식은 main_week10_reference.py 와 같습니다.
#   lib/ 에 adafruit_dht 와 adafruit_motor 가 있어야 합니다 (1주차부터 쓰던 것).

import time
import board
import analogio
import pwmio
import microcontroller
import adafruit_dht
from adafruit_motor import servo

# ── 기준값 — 실습실에 맞게 고쳐 쓰세요 ──
TEMP_REF, TEMP_TOL = 24, 4      # 24 ℃ 기준, 20~28 ℃ 면 정상 (DHT11 오차 ±2 ℃ 의 두 배)
HUMI_REF, HUMI_TOL = 50, 15     # 50 % 기준, 35~65 % 면 정상 (DHT11 오차 ±5 % 의 세 배)

# 조도: CdS(GND 쪽) + 10kΩ(3V3 쪽) 분압. 교실 LED 조명(300~500 lux)에서
#   CdS 가 약 1~2kΩ → GP26 전압 0.3~0.55V → raw 약 6000~11000 → 약 83~91 %.
#   처음 실행 때 찍히는 조도 값을 보고 LIGHT_REF 를 우리 교실 값으로 고쳐 적으세요.
LIGHT_REF, LIGHT_TOL = 85, 15   # 70 % 아래면 경고

# 서보 동작 순서와, 그 각도에 「도착하면」 켤 LED 색
SERVO_STEPS = [90, 180, 90, 0, 90]
COLOR_AT = {
    0: ("빨강", (255, 0, 0)),
    90: ("초록", (0, 255, 0)),
    180: ("파랑", (0, 0, 255)),
}
STEP_DELAY = 0.015   # 1° 움직일 때마다 쉬는 시간 — 천천히 돌려야 순간 전류가 작습니다
HOLD = 1.0           # 도착한 각도에서 머무는 시간

# ── 센서 초기화 (최종 배선도 핀) ──
cds = analogio.AnalogIn(board.GP26)     # CdS 분압 → ADC0
dht = adafruit_dht.DHT11(board.GP16)    # DHT11 DATA

# ── 액추에이터 초기화 ──
red = pwmio.PWMOut(board.GP17, frequency=1000, duty_cycle=0)
green = pwmio.PWMOut(board.GP18, frequency=1000, duty_cycle=0)
blue = pwmio.PWMOut(board.GP19, frequency=1000, duty_cycle=0)

servo_pwm = pwmio.PWMOut(board.GP15, duty_cycle=2 ** 15, frequency=50)
my_servo = servo.Servo(servo_pwm, min_pulse=500, max_pulse=2500)


def set_color(r, g, b):
    red.duty_cycle = int(r / 255 * 65535)
    green.duty_cycle = int(g / 255 * 65535)
    blue.duty_cycle = int(b / 255 * 65535)


def read_dht():
    """온도·습도. 3번 시도해도 안 되면 (None, None) — 0 으로 때우지 않습니다.
    DHT11 은 규격상 2초 간격이 필요해서 실패하면 2초 쉬고 다시 읽습니다."""
    for attempt in range(3):
        try:
            t = dht.temperature
            h = dht.humidity
            if t is not None and h is not None:
                return t, h
        except Exception as e:   # DHT11 은 가끔 RuntimeError 를 냅니다
            print("  (DHT11 읽기 재시도 {}/3: {})".format(attempt + 1, e))
        time.sleep(2)
    return None, None


def read_light():
    """조도 % 와 raw 값. 읽기에 실패하면 (None, None)."""
    try:
        raw = cds.value
        return round(100 - (raw / 65535 * 100), 1), raw
    except Exception as e:
        print("  (조도 읽기 실패: {})".format(e))
        return None, None


def judge(value, ref, tol):
    if value is None:
        return "[실패]"
    return "[OK]" if abs(value - ref) <= tol else "[경고]"


def check_sensors():
    t, h = read_dht()
    light, raw = read_light()

    # 온도
    if t is None:
        print("[센서] 온도    ---          [실패] DHT11 응답 없음 — DATA=GP16 · VCC=3V3 · GND 확인")
    else:
        mark = judge(t, TEMP_REF, TEMP_TOL)
        hint = ""
        if mark == "[경고]":
            hint = " 기준({}℃)보다 {}".format(TEMP_REF, "높습니다" if t > TEMP_REF else "낮습니다")
        print("[센서] 온도    {:5.1f} ℃     (기준 {} ±{})  {}{}".format(t, TEMP_REF, TEMP_TOL, mark, hint))

    # 습도
    if h is None:
        print("[센서] 습도    ---          [실패] DHT11 응답 없음 — 위와 같은 배선 확인")
    else:
        mark = judge(h, HUMI_REF, HUMI_TOL)
        hint = ""
        if mark == "[경고]":
            hint = " 기준({}%)보다 {}".format(HUMI_REF, "높습니다" if h > HUMI_REF else "낮습니다")
        print("[센서] 습도    {:5.1f} %     (기준 {} ±{}) {}{}".format(h, HUMI_REF, HUMI_TOL, mark, hint))

    # 조도 — 값이 이상하면 숫자보다 「어디가 빠졌는지」를 먼저 알려 줍니다
    if light is None:
        print("[센서] 조도    ---          [실패] GP26 읽기 실패")
    elif raw >= 64000:
        print("[센서] 조도    {:5.1f} %  raw={:5d}  [실패] CdS 가 빠졌거나 CdS 의 GND 쪽이 끊겼습니다".format(light, raw))
    elif raw <= 1000:
        print("[센서] 조도    {:5.1f} %  raw={:5d}  [실패] 10kΩ 가 빠졌거나 CdS 와 자리가 바뀌었습니다".format(light, raw))
    elif light < LIGHT_REF - LIGHT_TOL:
        print("[센서] 조도    {:5.1f} %  raw={:5d}  (기준 {} -{}) [경고] 너무 어둡습니다 — 조명·CdS 위치 확인".format(
            light, raw, LIGHT_REF, LIGHT_TOL))
    else:
        print("[센서] 조도    {:5.1f} %  raw={:5d}  (기준 {} -{}) [OK] 손으로 가리면 값이 내려가야 정상".format(
            light, raw, LIGHT_REF, LIGHT_TOL))

    # 칩 온도 — 부품 없이 읽히는 참고값
    try:
        print("[센서] 칩 온도 {:5.1f} ℃     (참고)".format(microcontroller.cpu.temperature))
    except Exception as e:
        print("[센서] 칩 온도 ---          (읽기 실패: {})".format(e))


def move_to(target, current):
    """current → target 으로 1°씩 이동. 「도착한 뒤에」 LED 색을 바꿉니다.
    이동하는 동안에는 직전 색이 그대로 켜져 있습니다."""
    step = 1 if target > current else -1
    for angle in range(current, target, step):
        my_servo.angle = angle
        time.sleep(STEP_DELAY)
    my_servo.angle = target

    name, rgb = COLOR_AT[target]
    set_color(*rgb)
    print("[서보] {:3d}° 도착 -> LED {}".format(target, name))
    time.sleep(HOLD)
    return target


def check_actuators():
    print("[서보] 순서 " + " -> ".join("{}°".format(a) for a in SERVO_STEPS))
    angle = 90
    for target in SERVO_STEPS:
        angle = move_to(target, angle)


# ── 시작 ──
print()
print("Pico 하드웨어 단독 점검을 시작합니다 (멈추려면 Ctrl+C)")
print("서보 전원은 외부 5V 어댑터, 왼쪽 파랑 <-> 오른쪽 파랑 공통 GND 를 먼저 확인하세요.")
my_servo.angle = 90          # 90° 에서 시작
set_color(*COLOR_AT[90][1])  # 초록
time.sleep(1)

round_no = 0
try:
    while True:
        round_no += 1
        print()
        print("==== 점검 {}회차 ====".format(round_no))
        check_sensors()
        check_actuators()
except KeyboardInterrupt:
    print("점검을 멈춥니다.")
finally:
    set_color(0, 0, 0)       # LED 끄기
    my_servo.angle = 90      # 서보는 가운데로
    print("LED 끔 · 서보 90° 로 돌려 둠. 점검이 끝났으면 code.py 를 지우세요.")
