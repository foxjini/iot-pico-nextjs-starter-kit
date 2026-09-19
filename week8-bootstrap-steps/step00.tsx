// src/app/dashboard/page.tsx ── 8주차 0단계: 출발점 (3주차 화면 그대로)
"use client";

import { useEffect, useRef, useState } from "react";

type SensorData = {
  temperature: number | null;
  humidity: number | null;
  light_percent: number;
};

export default function DashboardPage() {
  const [picoIp, setPicoIp] = useState("192.168.0.51");
  const [connected, setConnected] = useState(false);
  const [sensor, setSensor] = useState<SensorData | null>(null);
  const [ledColor, setLedColor] = useState("#ff8800");
  const [servoAngle, setServoAngle] = useState(90);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = () => {
    wsRef.current?.close();
    const ws = new WebSocket(`ws://${picoIp}:5000/connect-websocket`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        setSensor(JSON.parse(event.data));
      } catch {
        console.warn("잘못된 메시지 형식:", event.data);
      }
    };
    wsRef.current = ws;
  };

  const sendCommand = () => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        led_r: parseInt(ledColor.slice(1, 3), 16),
        led_g: parseInt(ledColor.slice(3, 5), 16),
        led_b: parseInt(ledColor.slice(5, 7), 16),
        servo_angle: servoAngle,
      })
    );
  };

  useEffect(() => () => wsRef.current?.close(), []);

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        maxWidth: 480,
        color: "#ffffff",
        backgroundColor: "#111111",
        minHeight: "100vh",
      }}
    >
      <h1>IoT 실시간 대시보드</h1>

      <div style={{ marginBottom: 16 }}>
        <input
          value={picoIp}
          onChange={(e) => setPicoIp(e.target.value)}
          placeholder="Pico IP 주소"
          style={{
            marginRight: 8,
            padding: "6px 10px",
            border: "1px solid #888",
            borderRadius: 4,
            backgroundColor: "#222",
            color: "#fff",
          }}
        />
        <button
          onClick={connect}
          style={{
            padding: "6px 16px",
            backgroundColor: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          연결
        </button>
        <span style={{ marginLeft: 8 }}>
          상태: {connected ? "🟢 연결됨" : "🔴 연결 안됨"}
        </span>
      </div>

      <section style={{ marginBottom: 16 }}>
        <h2>센서값 (실시간)</h2>
        <p>온도: {sensor?.temperature ?? "-"} °C</p>
        <p>습도: {sensor?.humidity ?? "-"} %</p>
        <p>조도: {sensor?.light_percent ?? "-"} %</p>
      </section>

      <section>
        <h2>액추에이터 제어</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          LED 색상:{" "}
          <input
            type="color"
            value={ledColor}
            onChange={(e) => setLedColor(e.target.value)}
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          서보 각도: {servoAngle}
          <input
            type="range"
            min={0}
            max={180}
            value={servoAngle}
            onChange={(e) => setServoAngle(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </label>
        <button
          onClick={sendCommand}
          style={{
            padding: "6px 16px",
            backgroundColor: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          적용
        </button>
      </section>
    </main>
  );
}
