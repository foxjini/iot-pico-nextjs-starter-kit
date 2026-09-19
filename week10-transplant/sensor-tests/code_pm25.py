# code.py — 미세먼지 센서(PMS7003/PMS5003)만 시험
# ※ 전원은 반드시 VBUS(5V). TX/RX 는 엇갈려 연결합니다.
#   센서 TX -> Pico GP5(RX) / 센서 RX -> Pico GP4(TX)
#   전원을 켜고 30초쯤은 계속 실패할 수 있습니다(팬이 돌아야 값이 나옴).
import time
import board
import busio
import adafruit_pm25.uart

uart = busio.UART(board.GP4, board.GP5, baudrate=9600, timeout=0.25)
pm25 = adafruit_pm25.uart.PM25_UART(uart, None)

while True:
    try:
        data = pm25.read()
        print("PM2.5:", data["pm25 standard"], "ug/m3")
    except Exception as e:
        print("읽기 실패:", e)
    time.sleep(1)
