// src/app/dashboard/page.tsx ── 8주차 9단계: Modal (설정 숨김 · 작품 설명)
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert, Badge, Button, Card, Col, Container, Form, ProgressBar, Row,
  Modal, Tab, Tabs, Toast, ToastContainer,
} from "react-bootstrap";

type SensorData = {
  temperature: number | null;
  humidity: number | null;
  light_percent: number;
};

// ★ 5단계 — 자동 모드에서 조도가 이 값보다 어두우면 LED를 켠다
const AUTO_LIGHT_ON = 40;

// ★ 6단계 — 이 온도 이상이면 경고를 띄운다
const TEMP_WARN = 30;

function SensorCard({
  label, value, unit, max, variant,
}: {
  label: string; value: number | null; unit: string; max: number; variant: string;
}) {
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
        <ProgressBar now={percent} variant={variant} className="mt-3" style={{ height: 6 }} />
      </Card.Body>
    </Card>
  );
}

export default function DashboardPage() {
  const [picoIp, setPicoIp] = useState("192.168.0.51");
  // ★ 9단계 — 대화상자 안에서 고치는 중인 임시 값. "저장"을 눌러야 picoIp에 반영된다
  const [ipDraft, setIpDraft] = useState("192.168.0.51");
  const [showSetting, setShowSetting] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sensor, setSensor] = useState<SensorData | null>(null);

  const [ledOn, setLedOn] = useState(true);      // ★ 5단계
  const [autoMode, setAutoMode] = useState(false); // ★ 5단계
  const [ledColor, setLedColor] = useState("#ff8800");
  const [servoAngle, setServoAngle] = useState(90);

  // ★ 7단계 — 잠깐 떴다 사라지는 알림
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

  // ★ 9단계
  const disconnect = () => wsRef.current?.close();

  // ★ 5단계 — 3주차 Pico 코드는 네 개 키를 모두 요구한다.
  // 그래서 스위치를 꺼도 키는 그대로 보내고 값만 0으로 만든다.
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

  // ★ 7단계 — 사람이 누른 조작만 알림을 띄운다 (자동 모드는 조용히 동작한다)
  const sendAndNotify = (on: boolean, color: string, angle: number) => {
    const ok = sendCommand(on, color, angle);
    setToast({
      show: true,
      ok,
      msg: ok ? "명령을 전송했습니다." : "연결되지 않았습니다.",
    });
  };

  // ★ 5단계 — 스위치는 누르는 즉시 보낸다 ("설정 반영"을 기다리지 않는다)
  const toggleLed = (on: boolean) => {
    setLedOn(on);
    sendAndNotify(on, ledColor, servoAngle);
  };

  // ★ 5단계 — 자동 모드: 새 센서값이 올 때마다 조도를 보고 스스로 켜고 끈다
  useEffect(() => {
    if (!autoMode || !sensor) return;
    const shouldBeOn = sensor.light_percent < AUTO_LIGHT_ON;
    if (shouldBeOn !== ledOn) {
      setLedOn(shouldBeOn);
      sendCommand(shouldBeOn, ledColor, servoAngle);
    }
    // sensor와 autoMode가 바뀔 때만 확인하면 충분하다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor, autoMode]);

  useEffect(() => () => wsRef.current?.close(), []);

  // ★ 6단계 — 지금 고온 상태인가? (값이 없으면 false)
  const isHot = sensor?.temperature != null && sensor.temperature >= TEMP_WARN;

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">IoT 실시간 대시보드</h1>
        <Badge bg={connected ? "success" : "secondary"} className="fs-6">
          {connected ? "ONLINE" : "OFFLINE"}
        </Badge>
      </div>

      {/* ★ 9단계 — IP 입력창이 화면에서 사라졌다. 평소에는 안 보이고 대화상자 안에 있다 */}
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

      {/* ★ 6단계 — 조건이 참인 동안에만 화면에 나타난다. 식으면 스스로 사라진다 */}
      {isHot && (
        <Alert variant="danger" className="d-flex align-items-center gap-3">
          <span className="fs-3">🔥</span>
          <div>
            <div className="fw-bold">고온 경고</div>
            <div className="small">
              현재 온도가 {sensor?.temperature}°C 입니다 ({TEMP_WARN}°C 이상).
              장치 주변을 확인하세요.
            </div>
          </div>
        </Alert>
      )}

      {/* ★ 8단계 — 한 화면에 다 넣지 않고 탭으로 나눈다.
          경고(Alert)는 탭 바깥에 두어 어느 탭에 있든 보이게 한다 */}
      <Tabs defaultActiveKey="monitor" id="main-tabs" className="mb-3">
        <Tab eventKey="monitor" title="실시간 모니터">
          <Row className="g-3">
            <Col xs={12} sm={6} lg={4}>
              <SensorCard label="온도" value={sensor?.temperature ?? null} unit="°C" max={50} variant="danger" />
            </Col>
            <Col xs={12} sm={6} lg={4}>
              <SensorCard label="습도" value={sensor?.humidity ?? null} unit="%" max={100} variant="info" />
            </Col>
            <Col xs={12} sm={6} lg={4}>
              <SensorCard label="조도" value={sensor?.light_percent ?? null} unit="%" max={100} variant="warning" />
            </Col>
          </Row>
        </Tab>

        <Tab eventKey="control" title="액추에이터 제어">
          <Card>
            <Card.Body>
              <Card.Subtitle className="text-body-secondary text-uppercase small mb-3">
                액추에이터
              </Card.Subtitle>

              {/* 스위치 = GPIO의 HIGH/LOW. 켜면 색상값을, 끄면 0을 보낸다 */}
              <Form.Check
                type="switch"
                id="led-power"
                label="LED 전원"
                className="fs-5 mb-2"
                checked={ledOn}
                disabled={autoMode}
                onChange={(e) => toggleLed(e.target.checked)}
              />

              {/* 자동 모드를 켜면 사람이 아니라 센서가 LED를 조작한다 */}
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

      {/* ★ 7단계 — 화면 오른쪽 아래에 떴다가 3초 뒤 스스로 사라진다 */}
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

      {/* ★ 9단계 — 설정 대화상자. 전시 중에는 닫아 둔다 */}
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

      {/* ★ 9단계 — 작품 설명 대화상자. 전시회에서 관람객이 혼자 읽는다 */}
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
