# code.py — 초음파 거리 센서(HC-SR04)만 시험
# ※ ECHO 핀은 5V를 내보냅니다. 분압(1k + 2k) 또는 HC-SR04P 를 쓰세요.
import time
import board
import adafruit_hcsr04

sonar = adafruit_hcsr04.HCSR04(trigger_pin=board.GP14, echo_pin=board.GP13)

while True:
    try:
        print("거리:", sonar.distance, "cm")
    except RuntimeError:
        print("측정 실패 (범위 밖이거나 배선 확인)")
    time.sleep(0.5)
