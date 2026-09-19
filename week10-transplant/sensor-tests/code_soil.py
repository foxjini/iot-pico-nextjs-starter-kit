# code.py — 토양수분 센서만 시험 (아날로그)
# CIRCUITPY 루트에 code.py 로 저장하면 main.py 대신 이것이 실행됩니다.
# 시험이 끝나면 지우거나 code.py.bak 으로 이름을 바꾸세요.
import time
import board
import analogio

sensor = analogio.AnalogIn(board.GP27)   # 우리 팀 핀으로 바꾸세요

while True:
    print("raw:", sensor.value)
    time.sleep(0.5)

# 확인할 것
#  ① 공기 중에 두었을 때의 값  -> SOIL_DRY 에 적는다
#  ② 물에 담갔을 때의 값       -> SOIL_WET 에 적는다
#     (흰 선까지만 담그세요. 기판이 물에 닿으면 센서가 망가집니다)
