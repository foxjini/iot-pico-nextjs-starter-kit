# main.py — 15주차 모범답안: 가상 Pico 가 보내던 것을 진짜 Pico 가 그대로 보낸다
#
#   ★ 선생님용입니다. 학생에게 통째로 주지 마세요.
#     막힌 팀에게는 아래 「★ 15주차」 로 표시된 블록만 보여 주세요.
#
#   3주차 main.py 에서 바뀐 것은 네 가지뿐입니다.
#     ① cpu_temp   — 가상 Pico 가 보내던 키인데 3주차 코드에는 없었다
#     ② discomfort — 같은 이유. 온도·습도로 계산한다
#     ③ 우리 팀 센서      (여기서는 soil / GP27 을 예로 듭니다)
#     ④ 우리 팀 액추에이터 (여기서는 pump / GP14 를 예로 듭니다)
#
#   통신 구조(adafruit_httpserver + asyncio)는 3주차 그대로입니다.
#   가상 Pico 는 CPython(socket · threading)으로 쓰여 있지만 그 구조는 가져오지 않습니다.
#   가상 Pico 에서 가져오는 것은 "무엇을 보내는가" 하나뿐입니다.

import os
import json
import time
import board
import analogio
import digitalio
import pwmio
import wifi
import socketpool
import microcontroller  # ★ 15주차 ① — 칩 내장 온도계
import adafruit_dht
from adafruit_motor import servo
from adafruit_httpserver import GET, Request, Server, Websocket
from asyncio import create_task, gather, run, sleep as async_sleep

# ── Wi-Fi 연결 ──
# 비밀번호는 settings.toml 에 있습니다. 코드에 직접 쓰지 않습니다.
ssid = os.getenv("CIRCUITPY_WIFI_SSID")
password = os.getenv("CIRCUITPY_WIFI_PASSWORD")

print("Wi-Fi 연결 중...")
wifi.radio.connect(ssid, password)
print("연결 완료! 내 IP 주소:", wifi.radio.ipv4_address)

pool = socketpool.SocketPool(wifi.radio)
server = Server(pool, debug=True)

# ── 센서 초기화 ──
cds = analogio.AnalogIn(board.GP26)
dht = adafruit_dht.DHT11(board.GP16)

# ★ 15주차 ③ — 우리 팀 센서 (토양수분, 아날로그, GP27)
#   아날로그로 쓸 수 있는 핀은 GP27 · GP28 두 개뿐입니다.
soil = analogio.AnalogIn(board.GP27)
SOIL_DRY = 48000   # 공기 중(마른 상태) 에서 읽히는 raw 값
SOIL_WET = 20000   # 물에 담갔을 때 읽히는 raw 값

# ── 액추에이터 초기화 ──
red = pwmio.PWMOut(board.GP17, frequency=1000, duty_cycle=0)
green = pwmio.PWMOut(board.GP18, frequency=1000, duty_cycle=0)
blue = pwmio.PWMOut(board.GP19, frequency=1000, duty_cycle=0)

servo_pwm = pwmio.PWMOut(board.GP15, duty_cycle=2 ** 15, frequency=50)
my_servo = servo.Servo(servo_pwm, min_pulse=500, max_pulse=2500)

# ★ 15주차 ④ — 우리 팀 액추에이터 (급수 펌프, 디지털 출력, GP14)
pump = digitalio.DigitalInOut(board.GP14)
pump.direction = digitalio.Direction.OUTPUT
pump.value = False   # 켜진 채로 시작하지 않게 반드시 꺼 두고 시작합니다


def set_color(r, g, b):
    red.duty_cycle = int(r / 255 * 65535)
    green.duty_cycle = int(g / 255 * 65535)
    blue.duty_cycle = int(b / 255 * 65535)


def get_light_percent():
    """조도. 읽기에 실패하면 None 을 돌려줍니다 (9주차에서 배운 규칙)."""
    try:
        raw = cds.value
        return round(100 - (raw / 65535 * 100), 1)
    except Exception as e:
        print("[SENSOR] 조도 읽기 실패:", e)
        return None


def get_soil_percent():
    """★ 15주차 ③ — 토양수분. 마를수록 raw 가 커지므로 마른 쪽이 0% 가 되게 뒤집습니다."""
    try:
        raw = soil.value
        percent = (SOIL_DRY - raw) / (SOIL_DRY - SOIL_WET) * 100
        return round(max(0, min(100, percent)), 1)   # 0~100 밖으로 나가지 않게 가둡니다
    except Exception as e:
        print("[SENSOR] 토양수분 읽기 실패:", e)
        return None


def get_cpu_temp():
    """★ 15주차 ① — 칩 내장 온도계. 부품을 붙이지 않아도 읽힙니다."""
    try:
        return round(microcontroller.cpu.temperature, 1)
    except Exception as e:
        print("[SENSOR] 칩 온도 읽기 실패:", e)
        return None


def get_discomfort(t, h):
    """★ 15주차 ② — 불쾌지수. 가상 Pico 와 같은 식을 씁니다.
    온도나 습도가 없으면 계산할 수 없으므로 None 입니다. 0 으로 때우지 않습니다."""
    if t is None or h is None:
        return None
    return round(0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3, 1)


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


async def handle_websocket_requests():
    """브라우저가 보낸 제어 명령(JSON)을 받아 즉시 반영"""
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

                    # .get(키, 기본값) 으로 받으면 그 키가 빠져도 나머지가 동작합니다
                    set_color(
                        command.get("led_r", 0),
                        command.get("led_g", 0),
                        command.get("led_b", 0),
                    )
                    my_servo.angle = command.get("servo_angle", 90)

                    # ★ 15주차 ④ — 우리 팀 액추에이터. 켜짐은 255, 꺼짐은 0 입니다
                    pump.value = command.get("pump", 0) > 0

                    print("[WS] 명령 적용 완료 -> LED:({}, {}, {}) 서보:{}도 펌프:{}".format(
                        command.get("led_r", 0),
                        command.get("led_g", 0),
                        command.get("led_b", 0),
                        command.get("servo_angle", 90),
                        "켜짐" if pump.value else "꺼짐",
                    ))
                except Exception as e:
                    print("[WS] 명령 파싱/적용 오류:", e)
        await async_sleep(0)


async def send_sensor_messages():
    """1초마다 센서값을 JSON 으로 보냅니다.
    DHT11 은 규격상 최소 2초 간격이 필요해 읽는 주기만 따로 관리합니다."""
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
                    # DHT11 은 가끔 읽기에 실패합니다. 직전 값을 그대로 둡니다
                    print("[SENSOR] DHT11 읽기 재시도:", e)
                last_dht_read = now

            # ★ 15주차 — 가상 Pico 가 보내던 키를 하나도 빠뜨리지 않습니다
            payload = json.dumps({
                "temperature": last_temp,
                "humidity": last_humidity,
                "light_percent": get_light_percent(),
                "cpu_temp": get_cpu_temp(),                        # ①
                "discomfort": get_discomfort(last_temp, last_humidity),  # ②
                "soil": get_soil_percent(),                        # ③ 우리 팀 센서
            })
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
    )


run(main())
