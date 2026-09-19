# main.py — 10주차 예시: 기존 5개 + 추가 4종(토양수분·초음파·미세먼지·PIR)
# ※ 네 종류를 전부 붙인 "보여주기용" 예시입니다.
#    우리 팀에 필요한 것만 골라서 그 부분만 가져다 쓰세요.
import os
import json
import time
import board
import busio
import analogio
import digitalio
import pwmio
import wifi
import socketpool
import microcontroller
import adafruit_dht
import adafruit_hcsr04          # ★ 초음파
import adafruit_pm25.uart       # ★ 미세먼지
from adafruit_motor import servo
from adafruit_httpserver import GET, Request, Server, Websocket
from asyncio import create_task, gather, run, sleep as async_sleep

# ── Wi-Fi 연결 ──
ssid = os.getenv("CIRCUITPY_WIFI_SSID")
password = os.getenv("CIRCUITPY_WIFI_PASSWORD")

print("Wi-Fi 연결 중...")
wifi.radio.connect(ssid, password)
print("연결 완료! 내 IP 주소:", wifi.radio.ipv4_address)

pool = socketpool.SocketPool(wifi.radio)
server = Server(pool, debug=True)

# ── 기존 센서 (9주차까지) ──
cds = analogio.AnalogIn(board.GP26)
dht = adafruit_dht.DHT11(board.GP16)

# ── ★ 추가 센서 ──
soil = analogio.AnalogIn(board.GP27)                  # 토양수분 (아날로그)

sonar = adafruit_hcsr04.HCSR04(                       # 초음파 거리
    trigger_pin=board.GP14, echo_pin=board.GP13
)

pir = digitalio.DigitalInOut(board.GP12)              # PIR 움직임
pir.direction = digitalio.Direction.INPUT

dust_uart = busio.UART(board.GP4, board.GP5, baudrate=9600, timeout=0.25)
pm25 = adafruit_pm25.uart.PM25_UART(dust_uart, None)  # 미세먼지 (UART)

# ── 액추에이터 ──
red = pwmio.PWMOut(board.GP17, frequency=1000, duty_cycle=0)
green = pwmio.PWMOut(board.GP18, frequency=1000, duty_cycle=0)
blue = pwmio.PWMOut(board.GP19, frequency=1000, duty_cycle=0)

servo_pwm = pwmio.PWMOut(board.GP15, duty_cycle=2 ** 15, frequency=50)
my_servo = servo.Servo(servo_pwm, min_pulse=500, max_pulse=2500)

relay = digitalio.DigitalInOut(board.GP20)            # ★ 릴레이(펌프 등)
relay.direction = digitalio.Direction.OUTPUT
RELAY_ACTIVE_LOW = True   # ★ 대부분의 릴레이 모듈은 LOW일 때 켜진다. 반대면 False로.
relay.value = RELAY_ACTIVE_LOW   # 시작할 때는 꺼진 상태로


def set_relay(on):
    relay.value = (not on) if RELAY_ACTIVE_LOW else on


def set_color(r, g, b):
    red.duty_cycle = int(r / 255 * 65535)
    green.duty_cycle = int(g / 255 * 65535)
    blue.duty_cycle = int(b / 255 * 65535)


def get_light_percent():
    raw = cds.value
    return round(100 - (raw / 65535 * 100), 1)


def get_cpu_temp():
    try:
        return round(microcontroller.cpu.temperature, 1)
    except Exception:
        return None


def get_discomfort(t, h):
    if t is None or h is None:
        return None
    return round(0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3, 1)


# ══════════ ★ 추가 센서 읽기 함수 ══════════

# 토양수분은 팀마다 직접 재서 정해야 하는 두 값이 있다 (10주차 7번 항목 참고)
SOIL_DRY = 48000   # 공기 중(마른 상태)에서 읽은 raw 값
SOIL_WET = 20000   # 물에 담갔을 때 읽은 raw 값


def get_soil():
    """토양수분 %. 마를수록 raw가 크므로 방향을 뒤집는다."""
    raw = soil.value
    pct = (SOIL_DRY - raw) / (SOIL_DRY - SOIL_WET) * 100
    return round(max(0.0, min(100.0, pct)), 1)   # 0~100 밖으로 나가지 않게 가둔다


def get_distance():
    """초음파 거리(cm). 측정 범위를 벗어나면 RuntimeError가 난다."""
    try:
        return round(sonar.distance, 1)
    except RuntimeError:
        return None    # 실패하면 값 없음으로 보낸다 (9주차 6단계)


def get_dust():
    """PM2.5 (㎍/㎥). 센서가 아직 데이터를 안 보냈으면 실패할 수 있다."""
    try:
        data = pm25.read()
        return data["pm25 standard"]
    except Exception:
        return None


# PIR은 켜짐/꺼짐뿐이라 막대 그래프에 어울리지 않는다.
# "움직임이 없다가 생긴 순간"만 세서 횟수로 바꾼다 (디지털논리의 에지 검출).
motion_count = 0
_last_pir = False


def poll_motion():
    global motion_count, _last_pir
    now = pir.value
    if now and not _last_pir:
        motion_count += 1
    _last_pir = now


websocket: Websocket = None


@server.route("/connect-websocket", GET)
def connect_client(request: Request):
    global websocket
    client_ip, client_port = request.client_address
    if websocket is not None:
        print(f"[WS] 기존 연결 종료 (새 클라이언트: {client_ip}:{client_port})")
        websocket.close()
    else:
        print(f"[WS] 클라이언트 연결됨: {client_ip}:{client_port}")
    websocket = Websocket(request)
    return websocket


server.start(str(wifi.radio.ipv4_address), port=5000)
print(f"WebSocket 서버 시작: ws://{wifi.radio.ipv4_address}:5000/connect-websocket")


async def handle_http_requests():
    while True:
        server.poll()
        await async_sleep(0)


async def watch_motion():
    """PIR은 짧게 지나가는 신호라 자주 확인해야 놓치지 않는다"""
    while True:
        poll_motion()
        await async_sleep(0.05)


async def handle_websocket_requests():
    global websocket
    while True:
        if websocket is not None:
            try:
                message = websocket.receive(fail_silently=True)
            except Exception as e:
                print("[WS] 수신 중 연결 끊김 감지:", e)
                websocket = None
                message = None

            if message:
                print("[WS] 수신 메시지:", message)
                try:
                    command = json.loads(message)
                    set_color(
                        command.get("led_r", 0),
                        command.get("led_g", 0),
                        command.get("led_b", 0),
                    )
                    # ★ 추가 액추에이터 — 0보다 크면 켜기
                    set_relay(command.get("pump", 0) > 0)
                    if "servo_angle" in command:
                        my_servo.angle = command["servo_angle"]
                    print("[WS] 명령 적용 완료:", command)
                except Exception as e:
                    print("[WS] 명령 파싱/적용 오류:", e)
        await async_sleep(0)


async def send_sensor_messages():
    global websocket
    last_temp = None
    last_humidity = None
    last_dht_read = 0
    while True:
        if websocket is not None:
            now = time.monotonic()
            if now - last_dht_read > 2.0:
                try:
                    last_temp = dht.temperature
                    last_humidity = dht.humidity
                except RuntimeError as e:
                    print("[SENSOR] DHT11 읽기 재시도:", e)
                last_dht_read = now

            payload = json.dumps(
                {
                    "temperature": last_temp,
                    "humidity": last_humidity,
                    "light_percent": get_light_percent(),
                    "cpu_temp": get_cpu_temp(),
                    "discomfort": get_discomfort(last_temp, last_humidity),
                    # ★ 추가한 센서 네 개
                    "soil": get_soil(),
                    "distance": get_distance(),
                    "dust": get_dust(),
                    "motion_count": motion_count,
                }
            )
            print("[WS] 송신 메시지:", payload)
            try:
                websocket.send_message(payload, fail_silently=True)
            except Exception as e:
                print("[WS] 송신 중 연결 끊김 감지:", e)
                websocket = None
        else:
            print("[WS] 대기 중 — 아직 연결된 클라이언트 없음")
        await async_sleep(1)


async def main():
    await gather(
        create_task(handle_http_requests()),
        create_task(handle_websocket_requests()),
        create_task(send_sensor_messages()),
        create_task(watch_motion()),     # ★ PIR 감시 태스크 추가
    )


run(main())
