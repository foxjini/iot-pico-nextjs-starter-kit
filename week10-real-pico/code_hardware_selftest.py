# code.py — 실물 하드웨어 단독 점검 (백엔드와 연동하기 전에)
#
#   worksheets/최종_배선도.pdf 대로 조립한 Pico 2 W(또는 Pico W)가
#   센서 · 액추에이터와 함께 제대로 도는지 **Pico 혼자서** 확인합니다.
#   Wi-Fi · WebSocket 을 쓰지 않으므로 settings.toml(공유기 비밀번호)이 필요 없습니다.
#
#   쓰는 법
#     ① CIRCUITPY 루트에 code.py 로 저장합니다 (main.py 대신 이것이 실행됩니다)
#     ② VS Code 시리얼 모니터로 Pico 포트를 엽니다
#        보드의 내장 LED 가 1초에 한 번 깜빡이면 코드가 돌고 있는 것입니다.
#        꺼지거나 켜진 채 멈추면 코드가 멈춘 것 → 시리얼 모니터의 오류를 보세요.
#     ③ 점검이 끝나면 code.py 를 지우거나 code.py.bak 으로 바꿉니다
#        ← 안 지우면 main.py 가 영영 실행되지 않습니다 (가장 흔한 함정)
#
#   준비물: CircuitPython 10.x 펌웨어 + **같은 10.x 번들**의 lib/adafruit_dht.mpy,
#           lib/adafruit_motor/ 폴더. 번들의 주 버전이 펌웨어와 다르면
#           「Incompatible .mpy file」 오류가 납니다.
#   핀은 main_week10_reference.py 와 같습니다.

import time
import board
import analogio
import digitalio
import pwmio
import adafruit_dht
from adafruit_motor import servo

# ── 기준값 — 실습실에 맞게 고쳐 쓰세요 ──
TEMP_REF, TEMP_TOL = 24, 4      # 24 ℃ 기준, 20~28 ℃ 면 정상 (DHT11 오차 ±2 ℃ 의 두 배)
HUMI_REF, HUMI_TOL = 50, 15     # 50 % 기준, 35~65 % 면 정상 (DHT11 오차 ±5 % 의 세 배)

# 조도: CdS(GND 쪽) + 10kΩ(3V3 쪽) 분압. 교실 LED 조명(300~500 lux)에서
#   CdS 가 약 1~2kΩ → GP26 전압 0.3~0.55V → raw 약 6000~11000 → 약 83~91 %.
#   처음 실행 때 찍히는 조도 값을 보고 LIGHT_REF 를 우리 교실 값으로 고쳐 적으세요.
LIGHT_REF, LIGHT_TOL = 85, 15   # 70 % 아래면 경고
LIGHT_SAMPLES = 8               # ADC 는 한 번 읽으면 흔들립니다 — 여러 번 읽어 평균

# 서보 동작 순서와, 그 각도에 「도착하면」 켤 LED 색
SERVO_STEPS = [90, 180, 90, 0, 90]
COLOR_AT = {
    0: ("빨강", (True, False, False)),
    90: ("초록", (False, True, False)),
    180: ("파랑", (False, False, True)),
}
# 서보 속도 — 서보는 빨리 돌수록(특히 출발·정지 순간) 전류를 많이 끌어
#   5V 가 순간적으로 떨어지고, 그러면 서보가 멈추거나 떨거나 Pico 가 리셋됩니다.
#   그래서 ① 평균 45°/초로 천천히 ② 출발·도착은 부드럽게(가속·감속) 돌립니다.
#   (SG90 최고 속도는 약 600°/초 — 지금은 그 1/10 도 안 됩니다)
#   그래도 멈추거나 떨면 SERVO_SPEED 를 30 정도로 낮추세요.
SERVO_SPEED = 45     # 평균 속도 (°/초)
FRAME = 0.02         # 각도를 고치는 간격 = 서보 PWM 한 주기(50Hz). 이보다 자주 고쳐도 소용없습니다
HOLD = 1.0           # 도착한 각도에서 머무는 시간
BLINK_NS = 500_000_000   # 내장 LED 를 0.5초마다 뒤집습니다 (1초에 한 번 깜빡임)

# ── 내장 LED (동작 표시) ──
#   Pico W · Pico 2 W 의 내장 LED 는 GP25 가 아니라 무선 칩에 붙어 있습니다.
#   board.LED 로 부르면 CircuitPython 이 알아서 연결합니다 (Wi-Fi 연결은 필요 없습니다).
status_led = digitalio.DigitalInOut(board.LED)
status_led.switch_to_output(value=False)
next_blink = 0


def heartbeat():
    """때가 됐으면 내장 LED 를 뒤집습니다. 시간은 monotonic_ns(정수)로 잽니다 —
    monotonic()(소수)은 Pico 를 오래 켜 두면 정밀도가 떨어집니다."""
    global next_blink
    now = time.monotonic_ns()
    if now >= next_blink:
        status_led.value = not status_led.value
        next_blink = now + BLINK_NS


def wait(seconds):
    """time.sleep 대신 씁니다. 잘게 나눠 자면서 그사이에 내장 LED 를 깜빡입니다.
    그래서 DHT11 재시도(2초)나 서보가 머무는 동안에도 깜빡임이 끊기지 않습니다."""
    end = time.monotonic_ns() + int(seconds * 1_000_000_000)
    while True:
        heartbeat()
        left = end - time.monotonic_ns()
        if left <= 0:
            return
        time.sleep(min(0.05, left / 1_000_000_000))


# ── 센서 초기화 (최종 배선도 핀) ──
cds = analogio.AnalogIn(board.GP26)     # CdS 분압 → ADC0
dht = adafruit_dht.DHT11(board.GP16)    # DHT11 DATA

# ── 액추에이터 초기화 ──
# RGB LED — 이 점검은 색을 켜고 끄기만 하므로 디지털 출력이면 됩니다.
#   (main.py 는 화면에서 0~255 밝기를 받으므로 PWM 을 씁니다. 배선은 같습니다)
#   모듈 맨 위 핀이 GND 인 공통 음극형이라 True = 켜짐입니다.
def led_pin(pin):
    p = digitalio.DigitalInOut(pin)
    p.switch_to_output(value=False)   # 꺼진 채로 시작
    return p


red = led_pin(board.GP17)
green = led_pin(board.GP18)
blue = led_pin(board.GP19)

# 서보는 펄스 폭으로 각도를 정하므로 PWM 이 꼭 필요합니다.
#   duty_cycle=0(펄스 없음)으로 시작합니다. 2**15 로 시작하면 50Hz 에서 10ms 펄스가 나가
#   서보 규격(0.5~2.5ms) 밖이라 켜는 순간 튈 수 있습니다. 바로 아래에서 90° 를 줍니다.
servo_pwm = pwmio.PWMOut(board.GP15, duty_cycle=0, frequency=50)
my_servo = servo.Servo(servo_pwm, min_pulse=500, max_pulse=2500)


def set_color(r, g, b):
    red.value = r
    green.value = g
    blue.value = b


def read_dht():
    """온도·습도. 3번 시도해도 안 되면 (None, None) — 0 으로 때우지 않습니다.
    adafruit_dht 는 2초 안에 다시 물으면 센서를 깨우지 않고 직전 값을 돌려줍니다.
    그래서 실패하면 2초 쉬고 다시 읽어야 진짜로 다시 잽니다."""
    for attempt in range(1, 4):
        try:
            t = dht.temperature
            h = dht.humidity
            if t is not None and h is not None:
                return t, h
        except RuntimeError as e:   # 「Checksum did not validate」 등 — DHT11 은 가끔 실패합니다
            print(f"  (DHT11 읽기 재시도 {attempt}/3: {e})")
        wait(2)
    return None, None


def read_light():
    """조도 % 와 raw 평균값. 읽기에 실패하면 (None, None)."""
    try:
        raw = sum(cds.value for _ in range(LIGHT_SAMPLES)) // LIGHT_SAMPLES
        return round(100 - raw / 65535 * 100, 1), raw
    except Exception as e:
        print(f"  (조도 읽기 실패: {e})")
        return None, None


def check_range(name, value, unit, ref, tol):
    if value is None:
        print(f"[센서] {name}    ---          [실패] DHT11 응답 없음 — DATA=GP16 · VCC=3V3 · GND 확인")
        return
    if abs(value - ref) <= tol:
        mark = "[OK]"
    else:
        mark = f"[경고] 기준({ref}{unit})보다 {'높습니다' if value > ref else '낮습니다'}"
    print(f"[센서] {name}    {value:5.1f} {unit}     (기준 {ref} ±{tol})  {mark}")


def check_sensors():
    t, h = read_dht()
    check_range("온도", t, "℃", TEMP_REF, TEMP_TOL)
    check_range("습도", h, "%", HUMI_REF, HUMI_TOL)

    # 조도 — 값이 이상하면 숫자보다 「어디가 빠졌는지」를 먼저 알려 줍니다
    light, raw = read_light()
    if light is None:
        print("[센서] 조도    ---          [실패] GP26 읽기 실패")
        return
    head = f"[센서] 조도    {light:5.1f} %  raw={raw:5d} "
    if raw >= 64000:
        print(head + " [실패] CdS 가 빠졌거나 CdS 의 GND 쪽이 끊겼습니다")
    elif raw <= 1000:
        print(head + " [실패] 10kΩ 가 빠졌거나 CdS 와 자리가 바뀌었습니다")
    elif light < LIGHT_REF - LIGHT_TOL:
        print(head + f" (기준 {LIGHT_REF} -{LIGHT_TOL}) [경고] 너무 어둡습니다 — 조명·CdS 위치 확인")
    else:
        print(head + f" (기준 {LIGHT_REF} -{LIGHT_TOL}) [OK] 손으로 가리면 값이 내려가야 정상")


servo_now = 90   # 서보가 지금 있는 각도 (서보는 위치를 알려 주지 않으므로 코드가 기억합니다)


def glide(target):
    """servo_now → target 으로 부드럽게 이동합니다.
    smoothstep(3x² − 2x³) 곡선이라 출발할 때 천천히 빨라지고 도착할 때 천천히 멈춥니다.
    한 번에 확 돌리지 않으므로 순간 전류(전압 강하)가 작습니다."""
    global servo_now
    start = servo_now
    frames = max(1, round(abs(target - start) / SERVO_SPEED / FRAME))
    for i in range(1, frames + 1):
        x = i / frames
        servo_now = start + (target - start) * x * x * (3 - 2 * x)
        my_servo.angle = servo_now
        wait(FRAME)
    my_servo.angle = target
    servo_now = target


def move_to(target):
    """target 까지 움직인 「뒤에」 LED 색을 바꿉니다. 이동 중에는 직전 색이 그대로입니다."""
    glide(target)
    name, rgb = COLOR_AT[target]
    set_color(*rgb)
    print(f"[서보] {target:3d}° 도착 -> LED {name}")
    wait(HOLD)


def check_actuators():
    print("[서보] 순서 " + " -> ".join(f"{a}°" for a in SERVO_STEPS))
    for target in SERVO_STEPS:
        move_to(target)


# ── 시작 ──
print()
print("Pico 하드웨어 단독 점검을 시작합니다 (멈추려면 Ctrl+C)")
print("서보 전원은 외부 5V 어댑터, 왼쪽 파랑 <-> 오른쪽 파랑 공통 GND 를 먼저 확인하세요.")
# ⚠️ 서보가 처음에 어디 있는지는 알 수 없어서 첫 90° 만은 한 번에 움직입니다.
#    전압 강하가 이때 가장 크므로, 다른 일을 하지 않고 1.5초 기다려 자리를 잡게 합니다.
#    (이 순간 Pico 가 리셋되면 서보 전원이 외부 5V · 커패시터 · 공통 GND 인지 다시 보세요)
print("[서보] 시작 위치 90° 로 맞추는 중...")
my_servo.angle = 90
set_color(*COLOR_AT[90][1])  # 초록
wait(1.5)                    # DHT11 도 전원이 들어온 뒤 1초는 기다려야 읽힙니다

round_no = 0
try:
    while True:
        round_no += 1
        print()
        print(f"==== 점검 {round_no}회차 ====")
        check_sensors()
        check_actuators()
except KeyboardInterrupt:
    print("점검을 멈춥니다.")
finally:
    # 정리 단계는 하나가 실패해도 나머지가 진행되게 따로따로 감쌉니다
    try:
        glide(90)         # 멈춘 자리에서 90° 까지도 부드럽게 (한 번에 돌리면 전압이 떨어집니다)
        wait(0.3)         # 코드가 끝나면 PWM 이 바로 끊기므로 자리 잡을 시간을 줍니다
    except Exception as e:
        print("서보 되돌리기 실패:", e)
    try:
        set_color(False, False, False)   # RGB LED 끄기
        status_led.value = False         # 내장 LED 끄기
    except Exception as e:
        print("LED 끄기 실패:", e)
    try:
        dht.exit()        # DHT11 이 쓰던 PulseIn 을 돌려줍니다 (다음 code.py/main.py 를 위해)
    except Exception as e:
        print("DHT11 해제 실패:", e)
    print("LED 끔 · 서보 90° 로 돌려 둠. 점검이 끝났으면 code.py 를 지우세요.")
