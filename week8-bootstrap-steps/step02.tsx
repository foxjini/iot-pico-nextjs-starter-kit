// src/app/dashboard/page.tsx ── 8주차 2단계: Row / Col (반응형 배치)
"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Col, Container, Form, Row } from "react-bootstrap";

type SensorData = {
  temperature: number | null;
  humidity: number | null;
  light_percent: number;
};

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
    // ★ 2단계 — h-100: 세 카드의 높이를 서로 맞춘다 (mb-3은 Row의 g-3이 대신한다)
    <Card className="h-100">
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

      {/* ★ 2단계 — 12칸을 나눠 쓴다. 휴대폰 12(1개) / 태블릿 6(2개) / 데스크톱 4(3개) */}
      <Row className="g-3">
        <Col xs={12} sm={6} lg={4}>
          <SensorCard label="온도" value={sensor?.temperature ?? null} unit="°C" />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <SensorCard label="습도" value={sensor?.humidity ?? null} unit="%" />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <SensorCard label="조도" value={sensor?.light_percent ?? null} unit="%" />
        </Col>
      </Row>

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
