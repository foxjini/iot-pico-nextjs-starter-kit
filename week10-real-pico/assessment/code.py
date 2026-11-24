# code.py — 3차 수행평가: 조이스틱으로 스텝모터 돌리기 + RFID 카드 번호를 LCD 에 표시 (Pico 2 W · CircuitPython 10)
#
#   CIRCUITPY 루트에 이 파일과 lcd_i2c.py · mfrc522_lite.py 를 함께 넣습니다 (lib 설치 필요 없음).
#   배선은 worksheets/수행평가 배선도.pdf.  먼저 test1~test4 로 부품을 하나씩 확인한 뒤 이 파일을 쓰세요.
#
#   동작
#     · 조이스틱 X 를 오른쪽으로 → 모터 시계 방향, 왼쪽으로 → 반시계. 많이 기울일수록 빠름. 놓으면 멈추고 코일을 끔
#     · RFID 카드 · 키태그를 대면 LCD 1줄에 번호(16진수 「6A 70 F4 BC」), 2줄에 ASCII(「ASCII: jp..」, 찍을 수 없는 값은 .)
#     · 조이스틱 Y 를 + 쪽으로 → LCD 의 카드 표시가 오른쪽으로 한 칸씩 돎(끝으로 나간 글자는 반대쪽에서 다시 나옴),
#       - 쪽으로 → 왼쪽으로 돎. 많이 기울일수록 빠름
#     · 조이스틱 버튼(누르기) → LCD 카드 표시를 원래대로 + 지금 모터 위치를 0° 로
#     · LCD · RC522 가 처음에 안 잡혀도 3초마다 다시 찾음 (선을 고쳐 꽂으면 저절로 연결). 도중에 빠져도 다시 찾음
#     · 시리얼 모니터: 조이스틱 % · 모터 각도 · 카드 번호.  내장 LED 깜빡임 = 동작 중
#     · PC 점검 앱(pico_monitor/run_assess_ui.bat)이 읽는 「DATA {...}」 줄을 0.2초마다 보냄
#
#   PC → Pico 명령 (한 줄씩, 대소문자 무관) — 점검 앱이 보냄. 조이스틱을 기울이면 PC 명령보다 조이스틱이 먼저
#     STATUS            지금 상태를 한 번 더
#     ZERO              지금 위치를 0° 로
#     MOVE +90          지정한 각도만큼 돌고 멈춤 (- 는 반시계)
#     STOP              바로 멈춤
#     LCD 글자1|글자2    LCD 두 줄 시험 (영문 · 숫자 · 기호)
#     RESTART           code.py 를 처음부터 다시 실행 (Ctrl+D 와 같음 — LCD · RC522 · 조이스틱 가운데를 새로 잡음)
#
#   핀
#     조이스틱  VRx GP26 · VRy GP27 · SW GP22 · +5V 핀 ← 3V3(★)
#     스텝모터  ULN2003 IN1~IN4 = GP10 · GP11 · GP12 · GP13 · + ← 외부 5V
#     LCD      I2C0 SDA GP16 · SCL GP17 (브레드보드에 꽂은 레벨 변환 거쳐서) · VCC ← 외부 5V
#     RFID     SPI0 SCK GP18 · MOSI GP19 · MISO GP20 · SDA(CS) GP21 · RST · 3.3V ← 3V3(★ 5V 금지)

import json
import sys
import time
import board
import busio
import analogio
import digitalio
import supervisor

try:
    import usb_cdc                              # 명령을 바이트로 읽으려고 (없으면 sys.stdin)
except ImportError:
    usb_cdc = None

from lcd_i2c import LCD
from mfrc522_lite import MFRC522, uid_hex, uid_ascii

# ── 설정 ──
DEADZONE = 7            # 가운데 ±7% 는 「가만히」 로 봄 (조이스틱마다 가운데 값이 조금씩 다름)
FAST_NS = 1_300_000     # 끝까지 기울였을 때 반 스텝 간격 1.3ms (≈ 11 rpm, 28BYJ-48 의 거의 최고 속도)
SLOW_NS = 8_000_000     # 조금 기울였을 때 8ms
PC_NS = 2_000_000       # PC 명령(MOVE)으로 돌 때 2ms (≈ 7 rpm)
STEPS_PER_REV = 4096    # 반 스텝 기준 한 바퀴
RFID_EVERY_NS = 250_000_000
RETRY_NS = 3_000_000_000        # 빠진 LCD · RC522 를 다시 찾는 간격 (연결돼 있으면 살아 있는지 확인)
SHIFT_SLOW_NS = 400_000_000     # 조이스틱 Y 로 LCD 카드 표시를 돌리는 간격 — 조금 기울이면 0.4초
SHIFT_FAST_NS = 120_000_000     # 끝까지 기울이면 0.12초
DATA_EVERY_NS = 200_000_000
PRINT_EVERY_NS = 1_000_000_000
HALF = ((1, 0, 0, 0), (1, 1, 0, 0), (0, 1, 0, 0), (0, 1, 1, 0),
        (0, 0, 1, 0), (0, 0, 1, 1), (0, 0, 0, 1), (1, 0, 0, 1))

# ── 장치 준비 (하나가 안 돼도 나머지는 동작하게) ──
led = digitalio.DigitalInOut(board.LED)
led.switch_to_output(value=False)

vrx = analogio.AnalogIn(board.GP26)
vry = analogio.AnalogIn(board.GP27)
sw = digitalio.DigitalInOut(board.GP22)
sw.switch_to_input(pull=digitalio.Pull.UP)

coils = []
for p in (board.GP10, board.GP11, board.GP12, board.GP13):
    c = digitalio.DigitalInOut(p)
    c.switch_to_output(value=False)
    coils.append(c)

i2c = spi = None
lcd = None
lcd_lines = ["", ""]                            # LCD 에 지금 쓰인 글자 (점검 앱에 똑같이 보여 줌)
rfid = None
rc_ver = 0


def _free(bus):
    try:
        bus.deinit()
    except Exception:       # noqa: BLE001
        pass


def lcd_lost(e):
    global lcd, i2c
    print("[LCD] 연결이 끊겼습니다 — 3초마다 다시 찾습니다:", e)
    lcd = None
    if i2c:
        _free(i2c)
        i2c = None


def show(line1, line2):
    lcd_lines[0], lcd_lines[1] = line1[:16], line2[:16]
    if lcd:
        try:
            lcd.print_at(0, 0, lcd_lines[0])
            lcd.print_at(0, 1, lcd_lines[1])
        except Exception as e:      # noqa: BLE001 — 선이 빠짐
            lcd_lost(e)


def connect_lcd(first=False):
    """LCD 를 찾아 초기화합니다. 처음(first)에만 실패를 알리고, 다시 찾을 때는 찾았을 때만 알립니다."""
    global lcd, i2c
    try:
        if i2c is None:
            i2c = busio.I2C(scl=board.GP17, sda=board.GP16, frequency=100_000)
        lcd = LCD(i2c)
    except Exception as e:      # noqa: BLE001 — 어떤 이유든 LCD 없이 계속
        lcd = None
        if i2c:
            _free(i2c)
            i2c = None
        if first:
            print("[준비] LCD 를 못 찾음 — SDA=GP16 · SCL=GP17 · 레벨 변환(HV 왼쪽=5V, LV 오른쪽=3V3) · LCD VCC=5V · "
                  "GND 공통 확인 (3초마다 다시 찾습니다):", e)
        return
    print("[준비] LCD 주소" if first else "[연결] LCD 를 다시 찾았습니다 — 주소", hex(lcd.address))
    show(lcd_lines[0], lcd_lines[1])            # 그동안 쓰려던 내용을 다시 그림


def check_lcd():
    try:
        lcd.backlight(True)                     # 1바이트만 보내 보기 — 응답이 없으면 빠진 것
    except Exception as e:      # noqa: BLE001
        lcd_lost(e)


def rfid_lost(why):
    global rfid, spi
    print("[RFID] RC522 연결이 끊겼습니다 — 3초마다 다시 찾습니다:", why)
    if rfid:
        rfid.deinit()
    rfid = None
    if spi:
        _free(spi)
        spi = None


def connect_rfid(first=False):
    global rfid, spi, rc_ver
    r = None
    try:
        if spi is None:
            spi = busio.SPI(board.GP18, MOSI=board.GP19, MISO=board.GP20)
        r = MFRC522(spi, cs=board.GP21)                 # RST 는 3.3V 레일
        v = r.version()
        if v in (0x00, 0xFF):
            raise OSError("버전 레지스터 0x%02X" % v)
    except Exception as e:      # noqa: BLE001
        if r:
            r.deinit()
        if spi:
            _free(spi)
            spi = None
        rfid = None
        if first:
            print("[준비] RC522 응답 없음 — 3.3V(5V 금지) · GND · SCK=GP18 · MOSI=GP19 · MISO=GP20 · SDA=GP21 · "
                  "RST=3.3V 확인 (3초마다 다시 찾습니다):", e)
        return
    rfid, rc_ver = r, v
    print("[준비] RC522 버전 0x%02X" % v if first else "[연결] RC522 를 다시 찾았습니다 — 버전 0x%02X" % v)


def check_rfid():
    try:
        v = rfid.version()
    except Exception as e:      # noqa: BLE001
        rfid_lost(e)
        return
    if v in (0x00, 0xFF):
        rfid_lost("버전 레지스터 0x%02X" % v)


connect_lcd(first=True)
show("Tap RFID card", "Joystick: motor")
connect_rfid(first=True)

time.sleep(0.3)
cx = sum(vrx.value for _ in range(32)) // 32           # 켜질 때 조이스틱을 건드리지 않은 값 = 가운데
cy = sum(vry.value for _ in range(32)) // 32
print("[준비] 조이스틱 가운데 X=%d Y=%d" % (cx, cy))
if not 20000 < cx < 45000:
    print("[주의] 조이스틱 가운데 값이 이상합니다 — +5V 핀을 3V3 에 꽂았는지, VRx=GP26 인지 확인")


def percent(v, c):
    span = c if v < c else 65535 - c
    return max(-100, min(100, round((v - c) * 100 / span))) if span else 0


def set_coils(pattern):
    for c, v in zip(coils, pattern):
        c.value = v


def release():
    set_coils((0, 0, 0, 0))


class S:
    phase = 0           # 반 스텝 순서 0~7
    position = 0        # 기준점에서 몇 반 스텝 왔는지 (+ = 시계)
    moving = 0          # -1 반시계 · 0 정지 · 1 시계
    pc_left = 0         # PC 명령(MOVE)으로 남은 반 스텝 (+/-)
    mode = "idle"       # joy · pc · idle
    uid = ""
    ascii = ""
    card = None         # LCD 에 보일 카드 두 줄 (16칸씩) — 돌리기 전 원래 모양
    rot = 0             # 오른쪽으로 몇 칸 돌렸는지 (0~15)
    px = py = 0
    pressed = False
    restarting = False


st = S()


def step(direction):
    st.phase = (st.phase + direction) % 8
    set_coils(HALF[st.phase])
    st.position += direction


def send_data():
    print("DATA " + json.dumps({
        "jx": st.px, "jy": st.py, "sw": int(st.pressed), "moving": st.moving, "mode": st.mode,
        "pos": st.position, "angle": round(st.position * 360 / STEPS_PER_REV, 1),
        "uid": st.uid, "ascii": st.ascii, "rot": st.rot, "lcd": lcd_lines, "lcd_addr": hex(lcd.address) if lcd else "",
        "rc_ver": ("0x%02X" % rc_ver) if rfid else "", "cx": cx, "cy": cy}))


def handle(line):
    words = line.strip().split(" ", 1)
    cmd = words[0].upper()
    arg = words[1] if len(words) > 1 else ""
    if not cmd:
        return
    if cmd == "STATUS":
        send_data()
    elif cmd == "ZERO":
        st.position = 0
        print("OK ZERO")
    elif cmd == "MOVE":
        try:
            deg = float(arg)
        except ValueError:
            print("ERR MOVE 뒤에 각도를 쓰세요 (예: MOVE +90)")
            return
        st.pc_left = round(deg * STEPS_PER_REV / 360)
        print("OK MOVE", arg)
    elif cmd == "STOP":
        st.pc_left = 0
        print("OK STOP")
    elif cmd == "LCD":
        a, _, b = arg.partition("|")
        st.card = None                          # 시험 글자는 돌리지 않음
        show(a, b)
        print("OK LCD" if lcd else "ERR LCD 가 연결되어 있지 않아 화면에만 반영했습니다")
    elif cmd == "RESTART":
        print("OK RESTART — code.py 를 처음부터 다시 실행합니다")
        st.restarting = True
        release()
        show("Restarting...", "")
        time.sleep(0.2)
        supervisor.reload()                     # Ctrl+D 와 같음. finally 에서 정리한 뒤 다시 시작
    else:
        print("ERR 알 수 없는 명령:", line.strip())


def draw_card():
    """카드 두 줄을 st.rot 칸만큼 오른쪽으로 돌려 LCD 에 씁니다 (끝으로 나간 글자는 왼쪽에서 다시 나옴)."""
    k = st.rot % 16
    a, b = st.card
    show(a[16 - k:] + a[:16 - k], b[16 - k:] + b[:16 - k])


inbox = ""


def read_commands():
    """USB 시리얼에 들어온 글자를 멈추지 않고 읽어 줄 단위로 처리합니다 (2차 code_extra_circuits.py 와 같은 방식)."""
    global inbox
    console = usb_cdc.console if usb_cdc else None
    if console:
        n = console.in_waiting
        if n:
            inbox += "".join(chr(b) for b in console.read(n) if b < 128)   # ASCII 만 — 한글이 와도 멈추지 않게
    else:
        n = supervisor.runtime.serial_bytes_available
        if n:
            inbox += sys.stdin.read(n)
    if n:
        while "\n" in inbox or "\r" in inbox:
            cut = min(i for i in (inbox.find("\n"), inbox.find("\r")) if i >= 0)
            line, inbox = inbox[:cut], inbox[cut + 1:]
            handle(line)
        inbox = inbox[-200:]


next_step = next_rfid = next_data = next_print = next_blink = next_shift = time.monotonic_ns()
next_retry = next_step + RETRY_NS
shifting = False
seen_at = 0
shown_uid = None
sw_was = False
print("시작 — 조이스틱을 좌우로 기울여 보세요. 카드를 대 보세요.")

try:
    while True:
        now = time.monotonic_ns()
        read_commands()
        st.px = percent(vrx.value, cx)
        st.py = -percent(vry.value, cy)         # 이 조이스틱은 Y 값이 반대로 나옴 → 부호를 바꿔 위로 밀면 +

        # 버튼: 누르는 순간 LCD 카드 표시를 원래대로 + 모터 위치를 0 으로
        st.pressed = not sw.value
        if st.pressed and not sw_was:
            st.position = 0
            if st.card and st.rot:
                st.rot = 0
                draw_card()
            print("[버튼] LCD 카드 표시를 원래대로 · 지금 위치를 0° 로")
        sw_was = st.pressed

        # 조이스틱 Y: LCD 카드 표시 돌리기 (+ = 오른쪽, - = 왼쪽). 기울이고 있는 동안 계속, 많이 기울일수록 빠르게
        if st.card and abs(st.py) > DEADZONE:
            if not shifting:
                shifting, next_shift = True, now
            if now >= next_shift:
                st.rot = (st.rot + (1 if st.py > 0 else -1)) % 16
                draw_card()
                k = (abs(st.py) - DEADZONE) / (100 - DEADZONE)
                next_shift = now + int(SHIFT_SLOW_NS - (SHIFT_SLOW_NS - SHIFT_FAST_NS) * k)
        else:
            shifting = False

        # 빠진 장치 다시 찾기 · 연결된 장치가 살아 있는지 확인
        if now >= next_retry:
            next_retry = now + RETRY_NS
            if lcd:
                check_lcd()
            else:
                connect_lcd()
            if rfid:
                check_rfid()
            else:
                connect_rfid()

        # 스텝모터: 조이스틱이 먼저, 가만히 있으면 PC 명령(MOVE), 둘 다 없으면 멈추고 코일 끄기
        if abs(st.px) > DEADZONE:
            if st.pc_left:
                st.pc_left = 0
                print("[모터] 조이스틱을 움직여 PC 명령을 취소했습니다")
            direction = 1 if st.px > 0 else -1
            k = (abs(st.px) - DEADZONE) / (100 - DEADZONE)          # 0 ~ 1
            interval = int(SLOW_NS - (SLOW_NS - FAST_NS) * k)
            st.mode = "joy"
        elif st.pc_left:
            direction = 1 if st.pc_left > 0 else -1
            interval = PC_NS
            st.mode = "pc"
        else:
            direction = 0
            st.mode = "idle"
        if direction:
            if st.moving != direction:                              # 이제 막 움직이기 시작
                next_step = now
                st.moving = direction
            if now >= next_step:
                step(direction)
                if st.mode == "pc":
                    st.pc_left -= direction
                next_step += interval
                if next_step < now:                                 # 늦었으면 따라잡지 말고 지금부터
                    next_step = now + interval
        elif st.moving:
            st.moving = 0
            release()                                               # 멈추면 코일 끄기 — 발열 · 전류 줄임

        # RFID → LCD
        if rfid and now >= next_rfid:
            next_rfid = now + RFID_EVERY_NS * (3 if st.moving else 1)  # 모터가 돌 때는 덜 자주 (읽는 동안 모터가 잠깐 멈추므로)
            try:
                uid = rfid.read_uid()
            except Exception as e:      # noqa: BLE001
                uid = None
                rfid_lost(e)
            if uid:
                # 카드는 한 번 읽히면 다음 요청을 한 번 건너뜀 → 1초 안에 다시 보인 같은 카드는 「계속 대고 있음」
                if uid != shown_uid or now - seen_at > 1_000_000_000:
                    st.uid, st.ascii = uid_hex(uid), uid_ascii(uid)
                    print("[RFID] 카드 UID:", st.uid, "· ASCII:", st.ascii)
                    st.card = ("%-16s" % st.uid, "%-16s" % ("ASCII: " + st.ascii))
                    st.rot = 0
                    draw_card()
                shown_uid, seen_at = uid, now

        # 시리얼 · 동작 표시
        if now >= next_data:
            next_data = now + DATA_EVERY_NS
            send_data()
        if now >= next_print:
            next_print = now + PRINT_EVERY_NS
            print("[조이스틱] X %+4d%% Y %+4d%% · [모터] %s %7.1f°" % (
                st.px, st.py, {1: "시계", -1: "반시계", 0: "정지"}[st.moving], st.position * 360 / STEPS_PER_REV))
        if now >= next_blink:
            next_blink = now + 500_000_000
            led.value = not led.value
        time.sleep(0.0002)
except KeyboardInterrupt:
    print("멈춥니다.")
finally:
    release()
    led.value = False
    if lcd and not st.restarting:
        try:
            lcd.print_at(0, 0, "Stopped")
            lcd.print_at(0, 1, "")
        except Exception:       # noqa: BLE001
            pass
