# test2_stepper.py — 스텝모터만 시험 (code.py 로 저장해서 실행)
#   배선: ULN2003 IN1~IN4 → GP10 · GP11 · GP12 · GP13,  − → GND,  + → 외부 5V (어댑터),  On/Off 점퍼 꽂기
#   ★ GND 는 Pico · 어댑터 · ULN2003 모두 공통.  모터 흰 커넥터는 ULN2003 에 끝까지 꽂기
#   반 스텝 4096 번 = 한 바퀴 (28BYJ-48: 5.625° ÷ 64 기어). 정방향 한 바퀴 → 1초 쉼 → 역방향 한 바퀴
import time
import board
import digitalio

PINS = (board.GP10, board.GP11, board.GP12, board.GP13)
HALF = ((1, 0, 0, 0), (1, 1, 0, 0), (0, 1, 0, 0), (0, 1, 1, 0),
        (0, 0, 1, 0), (0, 0, 1, 1), (0, 0, 0, 1), (1, 0, 0, 1))
STEPS_PER_REV = 4096
DELAY = 0.002                                   # 반 스텝 간격 2ms ≈ 7 rpm (1.2ms 보다 짧으면 떨기만 함)

coils = []
for p in PINS:
    c = digitalio.DigitalInOut(p)
    c.switch_to_output(value=False)
    coils.append(c)


def release():
    for c in coils:
        c.value = False                         # 코일 끄기 — 멈춰 있을 때 전류 · 열을 줄임


def turn(steps, direction):
    idx = 0
    for n in range(steps):
        idx = (idx + direction) % 8
        for c, v in zip(coils, HALF[idx]):
            c.value = v
        time.sleep(DELAY)
        if n % 1024 == 0:
            print("  %d / %d" % (n, steps))


try:
    while True:
        print("정방향(시계) 한 바퀴 — ULN2003 의 LED A~D 가 차례로 켜져야 합니다")
        turn(STEPS_PER_REV, +1)
        release()
        time.sleep(1)
        print("역방향 한 바퀴")
        turn(STEPS_PER_REV, -1)
        release()
        time.sleep(2)
finally:
    release()
