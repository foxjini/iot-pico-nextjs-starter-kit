// src/app/dashboard/page.tsx ── 9주차 1단계: SENSORS 배열 + .map()
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert, Badge, Button, Card, Col, Container, Form, ProgressBar, Row,
  Modal, Tab, Tabs, Toast, ToastContainer,
} from "react-bootstrap";

// ★ 1단계 — 우리 팀이 고치는 곳은 이 배열 하나입니다.
// key 는 Pico가 보내는 JSON의 키와 "글자 하나까지" 같아야 합니다.
const SENSORS = [
  { key: "temperature",   label: "온도", unit: "°C", max: 50,  variant: "danger"  },
  { key: "humidity",      label: "습도", unit: "%",  max: 100, variant: "info"    },
  { key: "light_percent", label: "조도", unit: "%",  max: 100, variant: "warning" },
];

// ★ 1단계 — 센서마다 키가 다르므로 이름을 미리 정하지 않는다.
// Record<string, ...> 는 "문자열 키에 이런 값이 들어온다"는 뜻입니다.
type SensorData = Record<string, number | null>;

const AUTO_LIGHT_ON = 40;
const TEMP_WARN = 30;

function SensorCard({
  label, value, unit, max, variant,
}: {
  label: string; value: number | null; unit: string; max: number; variant: string;
}) {
  const percent = value === null ? 0 : Math.min(100, (value / max) * 100);

  return (
    <Card className="h-100">
      <Card.Body className="text-center">
        <div className="text-body-secondary text-uppercase small">{label}</div>
        <div className="display-5 fw-semibold font-monospace sensor-value my-2">
          {value ?? "--"}
          <small className="fs-5 text-body-secondary ms-1">{unit}</small>
        </div>
        <ProgressBar now={percent} variant={variant} style={{ height: 8 }} />
      </Card.Body>
    </Card>
  );
}

export default function DashboardPage() {
  const [picoIp, setPicoIp] = useState("192.168.0.51");
  const [ipDraft, setIpDraft] = useState("192.168.0.51");
  const [showSetting, setShowSetting] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sensor, setSensor] = useState<SensorData | null>(null);

  const [ledOn, setLedOn] = useState(true);
  const [autoMode, setAutoMode] = useState(false);
  const [ledColor, setLedColor] = useState("#ff8800");
  const [servoAngle, setServoAngle] = useState(90);

  const [toast, setToast] = useState({ show: false, ok: true, msg: "" });

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

  const disconnect = () => wsRef.current?.close();

  const sendCommand = (on: boolean, color: string, angle: number) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false;
    wsRef.current.send(
      JSON.stringify({
        led_r: on ? parseInt(color.slice(1, 3), 16) : 0,
        led_g: on ? parseInt(color.slice(3, 5), 16) : 0,
        led_b: on ? parseInt(color.slice(5, 7), 16) : 0,
        servo_angle: angle,
      })
    );
    return true;
  };

  const sendAndNotify = (on: boolean, color: string, angle: number) => {
    const ok = sendCommand(on, color, angle);
    setToast({
      show: true,
      ok,
      msg: ok ? "명령을 전송했습니다." : "연결되지 않았습니다.",
    });
  };

  const toggleLed = (on: boolean) => {
    setLedOn(on);
    sendAndNotify(on, ledColor, servoAngle);
  };

  useEffect(() => {
    if (!autoMode || !sensor) return;
    const shouldBeOn = (sensor.light_percent ?? 0) < AUTO_LIGHT_ON;
    if (shouldBeOn !== ledOn) {
      setLedOn(shouldBeOn);
      sendCommand(shouldBeOn, ledColor, servoAngle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor, autoMode]);

  useEffect(() => () => wsRef.current?.close(), []);

  const temp = sensor?.temperature;
  const isHot = temp != null && temp >= TEMP_WARN;

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2 mb-0">IoT 실시간 대시보드</h1>
        <Badge bg={connected ? "success" : "secondary"} className="fs-5">
          {connected ? "ONLINE" : "OFFLINE"}
        </Badge>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-4">
        <Button
          variant={connected ? "outline-danger" : "success"}
          onClick={connected ? disconnect : connect}
        >
          {connected ? "연결 끊기" : "장치 연결"}
        </Button>
        <Button variant="outline-secondary" onClick={() => { setIpDraft(picoIp); setShowSetting(true); }}>
          장치 설정
        </Button>
        <Button variant="outline-info" className="ms-sm-auto" onClick={() => setShowAbout(true)}>
          이 작품은?
        </Button>
      </div>

      {isHot && (
        <Alert variant="danger" className="d-flex align-items-center gap-3">
          <span className="fs-3">🔥</span>
          <div>
            <div className="fw-bold">고온 경고</div>
            <div className="small">
              현재 온도가 {temp}°C 입니다 ({TEMP_WARN}°C 이상). 장치 주변을 확인하세요.
            </div>
          </div>
        </Alert>
      )}

      <Tabs defaultActiveKey="monitor" id="main-tabs" className="mb-3 fs-5">
        <Tab eventKey="monitor" title="실시간 모니터">
          {/* ★ 1단계 — 카드를 세 번 적는 대신, 배열을 돌면서 카드를 만든다.
              파이썬의 for 문과 같은 일을 한다. key 는 React가 카드를 구분하는 이름표다. */}
          <Row className="g-3">
            {SENSORS.map((s) => (
              <Col key={s.key} xs={12} sm={6} lg={4}>
                <SensorCard
                  label={s.label}
                  value={sensor?.[s.key] ?? null}
                  unit={s.unit}
                  max={s.max}
                  variant={s.variant}
                />
              </Col>
            ))}
          </Row>
        </Tab>

        <Tab eventKey="control" title="액추에이터 제어">
          <Card>
            <Card.Body>
              <Card.Subtitle className="text-body-secondary text-uppercase small mb-3">
                액추에이터
              </Card.Subtitle>

              <Form.Check
                type="switch"
                id="led-power"
                label="LED 전원"
                className="fs-5 mb-2"
                checked={ledOn}
                disabled={autoMode}
                onChange={(e) => toggleLed(e.target.checked)}
              />

              <Form.Check
                type="switch"
                id="auto-mode"
                label={`자동 모드 — 조도 ${AUTO_LIGHT_ON}% 아래면 켜기`}
                className="fs-5 mb-4"
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
              />

              <Form.Label className="small text-body-secondary">LED 색상</Form.Label>
              <Form.Control
                type="color"
                value={ledColor}
                onChange={(e) => setLedColor(e.target.value)}
                className="mb-4"
                style={{ width: 64 }}
              />

              <div className="d-flex justify-content-between small text-body-secondary">
                <span>서보 각도</span>
                <span className="font-monospace text-body">{servoAngle}°</span>
              </div>
              <Form.Range
                min={0}
                max={180}
                value={servoAngle}
                onChange={(e) => setServoAngle(Number(e.target.value))}
              />

              <Button
                className="mt-3"
                disabled={!connected}
                onClick={() => sendAndNotify(ledOn, ledColor, servoAngle)}
              >
                설정 반영
              </Button>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      <ToastContainer className="position-fixed bottom-0 end-0 p-3">
        <Toast
          show={toast.show}
          onClose={() => setToast((t) => ({ ...t, show: false }))}
          bg={toast.ok ? "success" : "danger"}
          delay={3000}
          autohide
        >
          <Toast.Header closeButton>
            <strong className="me-auto">{toast.ok ? "완료" : "오류"}</strong>
          </Toast.Header>
          <Toast.Body className="text-white">{toast.msg}</Toast.Body>
        </Toast>
      </ToastContainer>

      <Modal show={showSetting} onHide={() => setShowSetting(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">장치 설정</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label htmlFor="pico-ip">Pico IP 주소</Form.Label>
          <Form.Control
            id="pico-ip"
            className="font-monospace"
            value={ipDraft}
            onChange={(e) => setIpDraft(e.target.value)}
            placeholder="192.168.0.51"
          />
          <Form.Text className="text-body-secondary">
            Pico 시리얼 모니터에 출력된 IP를 입력하세요.
            내 노트북 IP와 앞 세 칸이 같아야 합니다.
          </Form.Text>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSetting(false)}>취소</Button>
          <Button
            onClick={() => {
              setPicoIp(ipDraft);
              setShowSetting(false);
              setToast({ show: true, ok: true, msg: "IP를 저장했습니다. 장치 연결을 눌러주세요." });
            }}
          >
            저장
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAbout} onHide={() => setShowAbout(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">이 작품은?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Raspberry Pi Pico 2 W가 온도·습도·조도를 1초마다 측정해
            Wi-Fi로 이 화면에 보냅니다.
          </p>
          <p className="mb-0">
            <strong>자동 모드</strong>를 켜면 주변이 어두워질 때
            LED가 스스로 켜집니다. 손으로 조도 센서를 가려 보세요.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowAbout(false)}>닫기</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
