# code.py — PIR 움직임 센서(HC-SR501)만 시험
# ※ 전원을 켠 뒤 1분쯤은 값이 제멋대로일 수 있습니다(예열).
#   조절 나사 두 개(감도·유지시간)는 처음엔 반시계 끝까지 돌려 최소로.
import time
import board
import digitalio

pir = digitalio.DigitalInOut(board.GP12)
pir.direction = digitalio.Direction.INPUT

while True:
    print("움직임:", pir.value)
    time.sleep(0.2)
