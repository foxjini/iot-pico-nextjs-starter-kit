// src/app/dashboard/page.tsx ── 8주차 4단계: ProgressBar (값 시각화)
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge, Button, Card, Col, Container, Form, ProgressBar, Row,
} from "react-bootstrap";

type SensorData = {
  temperature: number | null;
  humidity: number | null;
  light_percent: number;
};

function SensorCard({
  label,
  value,
  unit,
  max,
  variant,
}: {
  label: string;
  value: number | null;
  unit: string;
  max: number; // ★ 4단계 — 막대를 꽉 채우는 기준값 (온도 50, 습도·조도 100)
  variant: string; // ★ 4단계 — 막대 색상
}) {
  // ★ 4단계 — ProgressBar의 now는 0~100 백분율이다. 온도 24를 그대로 넣으면 24%만 찬다.
  const percent = value === null ? 0 : Math.min(100, (value / max) * 100);

  return (
    <Card className="h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center">
          <span className="text-body-secondary text-uppercase small">{label}</span>
          <span className="fs-4 font-monospace sensor-value">
            {value ?? "--"}
            <small className="text-body-secondary ms-1">{unit}</small>
          </span>
        </div>
        <ProgressBar
          now={percent}
          variant={variant}
          className="mt-3"
          style={{ height: 6 }}
        />
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">IoT 실시간 대시보드</h1>
        <Badge bg={connected ? "success" : "secondary"} className="fs-6">
          {connected ? "ONLINE" : "OFFLINE"}
        </Badge>
      </div>

      <div className="d-flex gap-2 mb-4">
        <Form.Control
          className="font-monospace"
          value={picoIp}
          onChange={(e) => setPicoIp(e.target.value)}
          placeholder="Pico IP 주소"
        />
        <Button onClick={connect} className="flex-shrink-0">
          연결
        </Button>
      </div>

      <Row className="g-3">
        <Col xs={12} sm={6} lg={4}>
          <SensorCard
            label="온도" value={sensor?.temperature ?? null} unit="°C"
            max={50} variant="danger"
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <SensorCard
            label="습도" value={sensor?.humidity ?? null} unit="%"
            max={100} variant="info"
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <SensorCard
            label="조도" value={sensor?.light_percent ?? null} unit="%"
            max={100} variant="warning"
          />
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
