// src/app/dashboard/page.tsx ── 8주차 1단계: Card + Flex
"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Container, Form } from "react-bootstrap";

type SensorData = {
  temperature: number | null;
  humidity: number | null;
  light_percent: number;
};

// ★ 1단계 — 센서 한 개를 카드 한 장으로 그리는 함수
function SensorCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <Card className="mb-3">
      {/* d-flex: 가로로 나란히 · justify-content-between: 양 끝으로 · align-items-center: 세로 가운데 */}
      <Card.Body className="d-flex justify-content-between align-items-center">
        <span className="text-body-secondary text-uppercase small">{label}</span>
        <span className="fs-4 font-monospace sensor-value">
          {value ?? "--"}
          <small className="text-body-secondary ms-1">{unit}</small>
        </span>
      </Card.Body>
    </Card>
  );
}

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
    <Container className="py-4">
      <h1 className="h3 mb-4">IoT 실시간 대시보드</h1>

      <div className="mb-4">
        <Form.Control
          className="mb-2 font-monospace"
          value={picoIp}
          onChange={(e) => setPicoIp(e.target.value)}
          placeholder="Pico IP 주소"
        />
        <Button onClick={connect}>연결</Button>
        <span className="ms-2">상태: {connected ? "🟢 연결됨" : "🔴 연결 안됨"}</span>
      </div>

      {/* ★ 1단계 — 센서값 세 개를 카드로 */}
      <SensorCard label="온도" value={sensor?.temperature ?? null} unit="°C" />
      <SensorCard label="습도" value={sensor?.humidity ?? null} unit="%" />
      <SensorCard label="조도" value={sensor?.light_percent ?? null} unit="%" />

      <h2 className="h5 mt-4">액추에이터 제어</h2>
      <div className="mb-2">
        LED 색상:{" "}
        <input
          type="color"
          value={ledColor}
          onChange={(e) => setLedColor(e.target.value)}
        />
      </div>
      <div className="mb-2">
        서보 각도: {servoAngle}
        <input
          type="range"
          min={0}
          max={180}
          value={servoAngle}
          onChange={(e) => setServoAngle(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>
      <Button onClick={sendCommand}>적용</Button>
    </Container>
  );
}
