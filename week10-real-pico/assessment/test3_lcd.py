# test3_lcd.py — I2C LCD 만 시험 (code.py 로 저장해서 실행, 같은 폴더에 lcd_i2c.py 필요)
#   배선: Pico GP16 → 레벨 변환 LV1 → HV1 → LCD SDA,  GP17 → LV2 → HV2 → LCD SCL
#         레벨 변환 LV → 3V3, HV → 외부 5V, GND → GND.  LCD VCC → 외부 5V, GND → GND
#   글자가 안 보이고 네모만 보이면 LCD 뒤 파란 가변저항을 드라이버로 돌려 대비를 맞추세요.
#   LCD 를 180° 돌려 놓았으면(I2C 핀이 Pico 쪽) FLIP = True — 글자를 뒤집어 그려 똑바로 읽힘 (code.py 의 LCD_FLIP 과 같음)
import time
import board
import busio
from lcd_i2c import LCD, find_address

FLIP = True

i2c = busio.I2C(scl=board.GP17, sda=board.GP16, frequency=100_000)
while not i2c.try_lock():
    pass
found = i2c.scan()
i2c.unlock()
print("I2C 에서 찾은 주소:", [hex(a) for a in found] or "없음")
addr = find_address(i2c)
if addr is None:
    print("[실패] LCD 가 안 보입니다 — SDA·SCL 이 바뀌지 않았는지, 레벨 변환 LV=3V3 · HV=5V, LCD VCC=5V, GND 공통 확인")
    while True:
        time.sleep(1)
print("LCD 주소:", hex(addr))
lcd = LCD(i2c, addr)
lcd.flip = FLIP
# 뒤집기는 한 화면에 (돌려도 같은 글자 말고) 8종류까지 — 「HI PICO」 + 숫자는 늘 그 안에 들어감
n = 0
while True:
    lcd.draw(["HI PICO", "%d" % n])
    n = (n + 1) % 10000
    time.sleep(1)
