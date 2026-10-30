# code.py — 추가 회로 3종 단독 점검 (HC-SR04 초음파 · 포토커플러 + 릴레이 모듈 DC 모터 · PWM LED)
#
#   worksheets/추가 배선도.pdf 대로 조립한 Pico W / Pico 2 W 를 혼자서, 또는 PC 의 UI 와 함께 점검합니다.
#
#   쓰는 법
#     ① CIRCUITPY 루트에 code.py 로 저장 (기존 code.py 는 이름을 바꿔 두세요)
#     ② lib/ 에 adafruit_hcsr04.mpy — 펌웨어와 같은 주 버전(10.x) 번들에서
#     ③ 그냥 두면 「자동 시험」: 거리 측정 · LED 밝기 0→100→0 · 모터 2초 켜고 2초 끄기를 반복
#        PC 에서 pico_monitor/run_extra_ui.bat 을 열고 버튼을 누르면 「수동 조작」으로 바뀝니다
#     ④ 점검이 끝나면 code.py 를 지우거나 code.py.bak 으로 — 안 그러면 main.py 가 실행되지 않습니다
#
#   PC → Pico 명령 (한 줄씩, 대소문자 무관)
#     MOTOR ON | MOTOR OFF   모터 (수동 조작으로 바뀜)
#     LED 0~100              LED 밝기 % (수동 조작으로 바뀜)
#     AUTO                   자동 시험으로 돌아감
#     PING                   UI 가 살아 있다는 신호 — 수동에서 5초 동안 아무 명령이 없으면 모터를 끔(안전)
#     STATUS                 지금 상태를 한 번 더 보냄
#   Pico → PC
#     DATA {"dist":23.4,"motor":0,"led":50,"mode":"manual","err":""}   0.25초마다 (UI 가 읽음)
#     OK … / ERR …           명령에 대한 답
#     [거리] … 같은 한국어 줄   사람이 시리얼 모니터로 볼 때 (1초마다)
#
#   ⚠ 포토커플러 모듈의 입력 G 가 GP13 에 연결되어 있습니다: GP13 LOW = 모터 켜짐, HIGH = 꺼짐.
#     모듈의 「입력 G ↔ 출력 G 점퍼」는 반드시 빼 두세요 (꽂혀 있으면 GP13 이 GND 에 붙습니다).

import json
import sys
import time
import board
import digitalio
import pwmio
import supervisor

try:
    import adafruit_hcsr04
except ImportError as e:
    print("[준비] 라이브러리가 없습니다:", e)
    print("[준비] CircuitPython 10.x 번들에서 adafruit_hcsr04.mpy 를 CIRCUITPY/lib/ 에 복사한 뒤 다시 저장하세요.")
    raise

# ── 핀 (worksheets/추가 배선도.pdf) ──
PIN_TRIG, PIN_ECHO = board.GP10, board.GP11   # ECHO 는 1kΩ/2kΩ 분압을 거쳐 3.3V 로
PIN_MOTOR = board.GP13                        # 포토커플러 모듈 입력 G — LOW 면 켜짐
PIN_LED = board.GP22                          # PWM 슬라이스 3A (서보 · RGB 와 겹치지 않음)

# ── 설정 ──
DATA_EVERY_NS = 250_000_000     # DATA 줄 간격 0.25초
TEXT_EVERY_NS = 1_000_000_000   # 한국어 줄 간격 1초
SONAR_EVERY_NS = 100_000_000    # 초음파는 0.1초마다 (메아리가 사라질 시간 60ms 이상)
WATCHDOG_NS = 5_000_000_000     # 수동 조작에서 PC 신호가 5초 없으면 모터 끔
AUTO_MOTOR_ON_NS = 2_000_000_000
AUTO_MOTOR_OFF_NS = 2_000_000_000
AUTO_LED_STEP_NS = 30_000_000   # 자동 시험에서 LED 밝기 1% 바꾸는 간격 (0→100→0 약 6초)
BLINK_NS = 500_000_000          # 내장 LED 0.5초마다 뒤집기 = 동작 중 표시

# ── 장치 준비 ──
sonar = adafruit_hcsr04.HCSR04(trigger_pin=PIN_TRIG, echo_pin=PIN_ECHO, timeout=0.05)

motor_pin = digitalio.DigitalInOut(PIN_MOTOR)
motor_pin.switch_to_output(value=True)        # ★ HIGH 로 시작 = 모터 꺼짐 (켜진 채로 시작하지 않게)

led = pwmio.PWMOut(PIN_LED, frequency=1000, duty_cycle=0)

status_led = digitalio.DigitalInOut(board.LED)
status_led.switch_to_output(value=False)


class State:
    mode = "auto"         # auto(자동 시험) / manual(수동 조작)
    motor = False
    led = 0               # 0~100 %
    dist = None           # cm (최근 5개 중앙값)
    err = ""              # 초음파 문제 설명
    last_cmd_ns = 0       # 마지막으로 PC 명령을 받은 시각


st = State()
recent = []               # 최근 거리 5개 — 튀는 값을 걸러 중앙값을 씁니다
fails = 0


def set_motor(on):
    st.motor = bool(on)
    motor_pin.value = not st.motor             # LOW = 켜짐


def set_led(percent):
    st.led = max(0, min(100, int(percent)))
    led.duty_cycle = st.led * 65535 // 100


def read_sonar():
    """거리를 재서 st.dist 를 갱신합니다. 3번 연속 실패하면 원인 안내를 st.err 에 남깁니다."""
    global fails
    try:
        d = sonar.distance                       # cm, 실패하면 RuntimeError
        if not 2 <= d <= 400:                    # HC-SR04 측정 범위 밖
            raise RuntimeError("범위 밖 %.1f" % d)
        recent.append(d)
        if len(recent) > 5:
            recent.pop(0)
        st.dist = round(sorted(recent)[len(recent) // 2], 1)
        st.err = ""
        fails = 0
    except RuntimeError:
        fails += 1
        if fails >= 3:
            st.dist = None
            recent.clear()
            st.err = "응답 없음 — TRIG=GP10 · ECHO 분압(1kΩ/2kΩ)→GP11 · VCC=5V · GND 확인"


def send_data():
    print("DATA " + json.dumps({"dist": st.dist, "motor": int(st.motor), "led": st.led,
                                "mode": st.mode, "err": st.err}))


def handle(line):
    """PC 에서 온 명령 한 줄을 처리합니다."""
    words = line.strip().upper().split()
    if not words:
        return
    st.last_cmd_ns = time.monotonic_ns()
    cmd = words[0]
    if cmd == "PING":
        return
    if cmd == "STATUS":
        send_data()
        return
    if cmd == "AUTO":
        st.mode = "auto"
        print("OK AUTO — 자동 시험으로 돌아갑니다")
        return
    if cmd == "MOTOR" and len(words) == 2 and words[1] in ("ON", "OFF"):
        st.mode = "manual"
        set_motor(words[1] == "ON")
        print("OK MOTOR", words[1])
        return
    if cmd == "LED" and len(words) == 2 and words[1].isdigit():
        st.mode = "manual"
        set_led(int(words[1]))
        print("OK LED", st.led)
        return
    print("ERR 알 수 없는 명령:", line.strip())


inbox = ""


def read_commands():
    """USB 시리얼에 들어온 글자를 멈추지 않고 읽어 줄 단위로 처리합니다."""
    global inbox
    n = supervisor.runtime.serial_bytes_available
    if n:
        inbox += sys.stdin.read(n)
        while "\n" in inbox or "\r" in inbox:
            cut = min(i for i in (inbox.find("\n"), inbox.find("\r")) if i >= 0)
            line, inbox = inbox[:cut], inbox[cut + 1:]
            handle(line)
        inbox = inbox[-200:]                     # 줄바꿈 없이 쌓이기만 하는 글자는 버림


def run():
    now = time.monotonic_ns()
    next_sonar = next_data = next_text = next_blink = now
    auto_motor_at = now + AUTO_MOTOR_OFF_NS      # 자동 시험: 2초 뒤 첫 켜짐
    auto_led_at, auto_led_dir = now, 1
    was_mode = None
    print()
    print("추가 회로 점검을 시작합니다 — 자동 시험 (PC UI 에서 버튼을 누르면 수동 조작)")
    print("모터: GP13 LOW = 켜짐 · 포토커플러 모듈의 입력 G ↔ 출력 G 점퍼는 빼 두세요")
    while True:
        now = time.monotonic_ns()
        read_commands()

        if st.mode != was_mode:
            print("[모드]", "자동 시험" if st.mode == "auto" else "수동 조작 (PC)")
            if st.mode == "auto":
                set_motor(False)
                auto_motor_at = now + AUTO_MOTOR_OFF_NS
            was_mode = st.mode

        if st.mode == "auto":
            if now >= auto_motor_at:             # 모터: 2초 켜고 2초 끄기
                set_motor(not st.motor)
                auto_motor_at = now + (AUTO_MOTOR_ON_NS if st.motor else AUTO_MOTOR_OFF_NS)
                print("[모터]", "켜짐 (릴레이 딸깍 · 모터 회전)" if st.motor else "꺼짐")
            if now >= auto_led_at:               # LED: 0 → 100 → 0 천천히
                nxt = st.led + auto_led_dir
                if nxt > 100 or nxt < 0:
                    auto_led_dir = -auto_led_dir
                    nxt = st.led + auto_led_dir
                set_led(nxt)
                auto_led_at = now + AUTO_LED_STEP_NS
        elif st.motor and now - st.last_cmd_ns > WATCHDOG_NS:
            set_motor(False)                     # PC 가 사라졌는데 모터가 돌고 있으면 끈다
            print("[안전] PC 신호가 5초 없어 모터를 껐습니다")

        if now >= next_sonar:
            read_sonar()
            next_sonar = now + SONAR_EVERY_NS
        if now >= next_data:
            send_data()
            next_data = now + DATA_EVERY_NS
        if now >= next_text:
            if st.dist is None:
                print("[거리] --- [실패]", st.err or "측정 중…")
            else:
                print("[거리] %.1f cm · 모터 %s · LED %d%%" % (st.dist, "켜짐" if st.motor else "꺼짐", st.led))
            next_text = now + TEXT_EVERY_NS
        if now >= next_blink:
            status_led.value = not status_led.value
            next_blink = now + BLINK_NS
        time.sleep(0.005)


try:
    run()
except KeyboardInterrupt:
    print("점검을 멈춥니다.")
finally:
    # 정리 — 하나가 실패해도 나머지가 진행되게 따로 감쌉니다
    for step in (lambda: set_motor(False), lambda: set_led(0), lambda: setattr(status_led, "value", False),
                 sonar.deinit):
        try:
            step()
        except Exception as e:
            print("정리 중 오류:", e)
    print("모터 끔 · LED 끔. 점검이 끝났으면 code.py 를 지우세요.")
