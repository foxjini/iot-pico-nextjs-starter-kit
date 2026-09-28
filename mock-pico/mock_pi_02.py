# -*- coding: utf-8 -*-
"""2주차 REST API + MySQL

실제 Raspberry Pi Pico 2 W 가 없어도 2주차 실습을 그대로 할 수 있게 해 주는
가상 Pico 입니다. 윈도우 PC 의 파이썬으로 실행합니다.

  py mock_pi_02.py

설치할 것이 없습니다. 파이썬 표준 라이브러리만 씁니다.
시리얼 모니터에 찍히는 문구도 진짜 Pico 와 똑같이 맞췄으므로,
교재에 나오는 시리얼 모니터 문구를 그대로 따라갈 수 있습니다.

이 주차만 WebSocket 이 아니라 REST 입니다.
  POST {서버}/api/sensor     {"temperature":..,"humidity":..,"light_percent":..}
  GET  {서버}/api/actuator   {"led_r":..,"led_g":..,"led_b":..,"servo_angle":..}
"""
import json
import random
import socket
import sys
import threading
import time

import math
import os
import urllib.error
import urllib.request

SENSOR_INTERVAL = 3.0        # 교재 main.py 와 같이 센서는 3초마다
ACTUATOR_INTERVAL = 2.0      # 제어 명령은 2초마다 확인
API_BASE = "http://127.0.0.1:3000"

STATE = {"dark": False, "hot": False, "dht_broken": False}
ACTUATOR = {"led_r": 0, "led_g": 0, "led_b": 0, "servo_angle": 90}
_running = True

# 진짜 Pico 의 current_temp 처럼 마지막 유효값을 들고 있는다
_last_temp = 25
_last_humidity = 55


def lan_ip():
    """이 PC 가 받은 IP. 진짜 Pico 가 시리얼에 찍는 것과 같은 자리."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def _read_dht(n):
    """DHT11 읽기. 고장 모드면 예외를 내서 진짜와 같은 흐름을 만든다."""
    if STATE["dht_broken"]:
        raise RuntimeError("DHT sensor not found")
    if STATE["hot"]:
        return 31.5, 85
    return round(24 + math.sin(n / 5.0) * 3, 1), round(55 + math.cos(n / 7.0) * 10)


def get_light_percent(n):
    if STATE["dark"]:
        return 18.0
    return round(60 + math.sin(n / 3.0) * 20, 1)


def post_sensor(payload):
    """진짜 Pico 의 requests.post(f"{api_base}/api/sensor", json=payload) 와 같은 일."""
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_BASE + "/api/sensor", data=body,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=3) as res:
        return json.loads(res.read().decode("utf-8"))


def get_actuator():
    """진짜 Pico 의 requests.get(f"{api_base}/api/actuator") 와 같은 일."""
    req = urllib.request.Request(API_BASE + "/api/actuator", method="GET")
    with urllib.request.urlopen(req, timeout=3) as res:
        return json.loads(res.read().decode("utf-8"))


def set_color(r, g, b):
    ACTUATOR["led_r"], ACTUATOR["led_g"], ACTUATOR["led_b"] = r, g, b


def print_menu():
    print("[명령]  d 어둡게 / b 밝게 / h 덥게 / n 보통 / f DHT11 고장 / s 상태 / q 종료")


def _status():
    bits = []
    if STATE["dark"]:
        bits.append("어둡게")
    if STATE["hot"]:
        bits.append("덥게")
    if STATE["dht_broken"]:
        bits.append("DHT11 고장")
    return " + ".join(bits) if bits else "보통"


def handle_key(key):
    if key == "d":
        STATE["dark"] = True
        print(">> 조도를 18% 로 낮췄습니다. MySQL 에 들어가는 값이 바뀌는지 보세요.")
    elif key == "b":
        STATE["dark"] = False
        print(">> 조도를 보통으로 되돌렸습니다.")
    elif key == "h":
        STATE["hot"] = True
        print(">> 온도 31.5도 / 습도 85% 로 올렸습니다.")
    elif key == "n":
        STATE["dark"] = STATE["hot"] = STATE["dht_broken"] = False
        print(">> 전부 보통으로 되돌렸습니다.")
    elif key == "f":
        STATE["dht_broken"] = not STATE["dht_broken"]
        if STATE["dht_broken"]:
            print(">> DHT11 을 뽑은 것으로 칩니다. '읽기 재시도' 가 뜨고 마지막 값이 계속 전송됩니다.")
        else:
            print(">> DHT11 을 다시 꽂았습니다.")
    elif key == "s":
        print(">> 지금 상태:", _status())
    else:
        print_menu()


def _shutdown():
    """q 를 눌렀을 때 통신 대기 때문에 늦게 꺼지면 답답하므로 바로 끝낸다."""
    global _running
    _running = False
    print()
    print("가상 Pico 를 종료합니다.")
    sys.stdout.flush()
    os._exit(0)


def _console_loop():
    global _running
    while _running:
        try:
            line = input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            _shutdown()
            return
        if line in ("q", "quit", "exit"):
            _shutdown()
            return
        if line:
            handle_key(line)
        else:
            print_menu()


def main():
    global API_BASE, _running, _last_temp, _last_humidity
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if len(sys.argv) > 1:
        API_BASE = sys.argv[1].rstrip("/")

    print("=" * 62)
    print(" 가상 Pico 2 W - 2주차 REST API + MySQL")
    print("=" * 62)
    print("Wi-Fi 연결 중...")
    time.sleep(0.3)
    print("연결 완료! 내 IP 주소:", lan_ip())
    print("보낼 서버 주소:", API_BASE)
    print()
    print("서버 주소가 다르면 이렇게 켜세요:")
    print("    py mock_pi_02.py http://192.168.137.1:3000")
    print("Next.js 가 npm run dev:lan 으로 켜져 있어야 합니다.")
    print("-" * 62)
    print_menu()
    print("-" * 62)

    threading.Thread(target=_console_loop, daemon=True).start()

    n = 0
    last_sensor_send = 0.0
    last_actuator_check = 0.0
    try:
        while _running:
            now = time.monotonic()

            # 1) 3초마다 센서값 전송
            if now - last_sensor_send > SENSOR_INTERVAL:
                n += 1
                try:
                    _last_temp, _last_humidity = _read_dht(n)
                except RuntimeError as e:
                    print("DHT 읽기 재시도:", e)   # 실패하면 직전 값 유지
                payload = {
                    "temperature": _last_temp,
                    "humidity": _last_humidity,
                    "light_percent": get_light_percent(n),
                }
                print("보내는 값:", json.dumps(payload, ensure_ascii=False))
                try:
                    print("서버 응답:", post_sensor(payload))
                except urllib.error.HTTPError as e:
                    print("센서 전송 실패: HTTP", e.code, e.reason)
                    print("   /api/sensor 가 만들어졌는지, 값 이름(키)이 맞는지 확인하세요.")
                except Exception as e:
                    print("센서 전송 실패:", e)
                    print("   Next.js 가 켜져 있는지, 주소가 맞는지 확인하세요:", API_BASE)
                last_sensor_send = now

            # 2) 2초마다 액추에이터 명령 확인 및 반영
            if now - last_actuator_check > ACTUATOR_INTERVAL:
                try:
                    state = get_actuator()
                    set_color(state["led_r"], state["led_g"], state["led_b"])
                    ACTUATOR["servo_angle"] = state["servo_angle"]
                    print("제어 명령 수신:", json.dumps(state, ensure_ascii=False))
                    print("   -> LED:({}, {}, {})  서보:{}도".format(
                        ACTUATOR["led_r"], ACTUATOR["led_g"],
                        ACTUATOR["led_b"], ACTUATOR["servo_angle"]))
                except KeyError as e:
                    print("명령 수신 실패: 응답에 키가 없습니다 ->", e)
                    print("   /api/actuator 가 led_r / led_g / led_b / servo_angle 을 돌려주는지 확인하세요.")
                except Exception as e:
                    print("명령 수신 실패:", e)
                last_actuator_check = now

            time.sleep(0.2)
    except KeyboardInterrupt:
        pass
    print()
    print("가상 Pico 를 종료합니다.")


if __name__ == "__main__":
    main()
