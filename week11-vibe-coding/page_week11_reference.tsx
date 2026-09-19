// src/app/dashboard/page.tsx ── 11주차 모범답안: 자동 재연결 + 전시 모드
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
  // ★ 3단계 — 두 줄을 추가했을 뿐인데 카드가 두 장 늘어난다
  { key: "cpu_temp",      label: "칩 온도",  unit: "°C", max: 80,  variant: "secondary" },
  { key: "discomfort",    label: "불쾌지수", unit: "",   max: 100, variant: "success"   },
];

// ★ 4단계 — 켜고 끄는 액추에이터도 같은 방식으로 적는다.
// key 는 Pico로 보낼 JSON의 키가 된다.
const SWITCHES = [
  { key: "led_r", label: "빨강", pin: "GP17" },
  { key: "led_g", label: "초록", pin: "GP18" },
  { key: "led_b", label: "파랑", pin: "GP19" },
];

// ★ 1단계 — 센서마다 키가 다르므로 이름을 미리 정하지 않는다.
// Record<string, ...> 는 "문자열 키에 이런 값이 들어온다"는 뜻입니다.
type SensorData = Record<string, number | null>;
type SwitchState = Record<string, boolean>;

// ★ 4단계 — 배열을 보고 스위치 초기 상태를 만든다 (전부 꺼짐).
// SWITCHES에 한 줄을 추가하면 여기도 저절로 늘어난다.
const INITIAL_SWITCHES: SwitchState = {};
for (const s of SWITCHES) INITIAL_SWITCHES[s.key] = false;

const AUTO_LIGHT_ON = 40;

// ★ 11주차 — 연결이 끊기면 이 간격으로 다시 시도한다
const RETRY_MS = 3000;

// ★ 5단계 — 경고 규칙도 배열로. 우리 팀 작품의 경고 조건을 여기 적는다.
const ALERTS = [
  { key: "temperature", over: 30, icon: "🔥", label: "고온 경고",
    variant: "danger", hint: "장치 주변을 확인하세요." },
  { key: "discomfort", over: 80, icon: "😓", label: "불쾌지수 매우 높음",
    variant: "warning", hint: "환기하거나 온도를 낮추세요." },
];

function SensorCard({
  label, value, unit, max, variant,
}: {
  label: string; value: number | null; unit: string; max: number; variant: string;
}) {
  // ★ 6단계 — 값이 없는 센서(고장·읽기 실패)를 흐리게 표시해 눈에 띄게 구분한다
  const missing = value === null;
  // ★ 6단계 — 음수나 최대값 초과가 들어와도 막대가 카드를 뚫고 나가지 않게 0~100으로 가둔다
  const percent = missing ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <Card className="h-100">
      <Card.Body className="text-center">
        <div className="text-body-secondary text-uppercase small">{label}</div>
        <div
          className={`display-5 fw-semibold font-monospace sensor-value my-2 ${
            missing ? "opacity-50" : ""
          }`}
        >
          {missing ? "--" : value}
          <small className="fs-5 text-body-secondary ms-1">
            {missing ? "값 없음" : unit}
          </small>
        </div>
        <ProgressBar
          now={percent}
          variant={missing ? "secondary" : variant}
          style={{ height: 8 }}
        />
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
  const [retrying, setRetrying] = useState(false);   // ★ 11주차
  const [kiosk, setKiosk] = useState(false);         // ★ 11주차 전시 모드
  const [sensor, setSensor] = useState<SensorData | null>(null);

  // ★ 4단계 — 스위치 여러 개의 상태를 한 덩어리로 들고 있는다
  const [sw, setSw] = useState<SwitchState>(INITIAL_SWITCHES);
  const [autoMode, setAutoMode] = useState(false);
  const [servoAngle, setServoAngle] = useState(90);

  const [toast, setToast] = useState({ show: false, ok: true, msg: "" });

  const wsRef = useRef<WebSocket | null>(null);
  // ★ 11주차 — 재연결에 필요한 것 세 가지
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantConnectedRef = useRef(false);   // 사용자가 "연결"을 눌러 둔 상태인가
  const picoIpRef = useRef(picoIp);         // 타이머가 나중에 쓸 IP

  useEffect(() => {
    picoIpRef.current = picoIp;
  }, [picoIp]);

  // ★ 11주차 — 실제로 소켓을 여는 부분. 재연결 타이머도 이 함수를 부른다.
  const openSocket = () => {
    wsRef.current?.close();
    const ws = new WebSocket(`ws://${picoIpRef.current}:5000/connect-websocket`);

    ws.onopen = () => {
      setConnected(true);
      setRetrying(false);
    };
    ws.onclose = () => {
      setConnected(false);
      // 사용자가 끊은 게 아니라면 다시 시도한다
      if (wantConnectedRef.current) scheduleRetry();
    };
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

  // ★ 11주차 — 3초 뒤에 다시 열어 본다
  const scheduleRetry = () => {
    setRetrying(true);
    if (retryRef.current) clearTimeout(retryRef.current);
    retryRef.current = setTimeout(openSocket, RETRY_MS);
  };

  // ★ 11주차 — "장치 연결" 버튼
  const connect = () => {
    wantConnectedRef.current = true;
    openSocket();
  };

  // ★ 11주차 — "연결 끊기" 버튼. 사용자가 끊었으므로 다시 붙지 않는다.
  const disconnect = () => {
    wantConnectedRef.current = false;
    if (retryRef.current) clearTimeout(retryRef.current);
    setRetrying(false);
    wsRef.current?.close();
  };

  // ★ 4단계 — 스위치 배열을 돌면서 보낼 JSON을 만든다.
  // 켜짐은 255(최대 밝기), 꺼짐은 0. 릴레이라면 Pico에서 "0보다 크면 ON"으로 받으면 된다.
  const sendCommand = (next: SwitchState, angle: number) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false;
    const payload: Record<string, number> = { servo_angle: angle };
    for (const s of SWITCHES) {
      payload[s.key] = next[s.key] ? 255 : 0;
    }
    wsRef.current.send(JSON.stringify(payload));
    return true;
  };

  const sendAndNotify = (next: SwitchState, angle: number) => {
    const ok = sendCommand(next, angle);
    setToast({
      show: true,
      ok,
      msg: ok ? "명령을 전송했습니다." : "연결되지 않았습니다.",
    });
  };

  // ★ 4단계 — 나머지 스위치는 그대로 두고 눌린 것 하나만 갈아끼운다
  const toggleSwitch = (key: string, on: boolean) => {
    const next = { ...sw, [key]: on };
    setSw(next);
    sendAndNotify(next, servoAngle);
  };

  // ★ 4단계 — 자동 모드는 스위치를 전부 같이 켜고 끈다 (전부 켜면 흰색)
  useEffect(() => {
    if (!autoMode || !sensor) return;
    // ★ 6단계 — ?? 0 을 쓰면 조도 센서가 죽었을 때 0(깜깜함)으로 읽혀 계속 켜진다.
    // 값이 없으면 판단하지 않고 그대로 둔다.
    const light = sensor.light_percent;
    if (light == null) return;
    const on = light < AUTO_LIGHT_ON;
    if (SWITCHES.some((s) => sw[s.key] !== on)) {
      const next: SwitchState = {};
      for (const s of SWITCHES) next[s.key] = on;
      setSw(next);
      sendCommand(next, servoAngle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor, autoMode]);

  // ★ 11주차 — 페이지를 벗어날 때 타이머까지 정리한다 (안 하면 계속 재연결을 시도한다)
  useEffect(() => {
    return () => {
      wantConnectedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  // ★ 11주차 — 전시 모드: 화면이 꺼지지 않게 막는다 (Wake Lock)
  useEffect(() => {
    if (!kiosk) return;
    let lock: { release: () => Promise<void> } | null = null;

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) lock = await nav.wakeLock.request("screen");
      } catch {
        // 지원하지 않는 브라우저에서도 오류로 멈추지 않는다
      }
    };
    // 다른 탭에 갔다 오면 잠금이 풀리므로 다시 건다
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [kiosk]);

  // ★ 11주차 — 전시 모드 켜기/끄기
  const toggleKiosk = async () => {
    const next = !kiosk;
    setKiosk(next);
    try {
      if (next) await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // 전체화면이 막힌 환경에서도 전시 모드 자체는 동작한다
    }
  };

  // ★ 5단계 — 지금 조건을 만족하는 경고만 걸러낸다 (filter = 걸러내기).
  // 여러 개가 동시에 참이면 여러 개가 같이 뜬다.
  const activeAlerts = ALERTS.filter((a) => {
    const v = sensor?.[a.key];
    return v != null && v >= a.over;
  });

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2 mb-0">IoT 실시간 대시보드</h1>
        {/* ★ 11주차 — 재연결 중임을 알려준다 */}
        <Badge
          bg={connected ? "success" : retrying ? "warning" : "secondary"}
          className="fs-5"
        >
          {connected ? "ONLINE" : retrying ? "재연결 중…" : "OFFLINE"}
        </Badge>
      </div>

      {/* ★ 11주차 — 전시 모드에서는 설정 버튼을 숨기고 "이 작품은?"만 남긴다 */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        {!kiosk && (
          <>
            <Button
              variant={connected ? "outline-danger" : "success"}
              onClick={connected ? disconnect : connect}
            >
              {connected ? "연결 끊기" : "장치 연결"}
            </Button>
            <Button variant="outline-secondary" onClick={() => { setIpDraft(picoIp); setShowSetting(true); }}>
              장치 설정
            </Button>
          </>
        )}
        <Button variant="outline-info" onClick={() => setShowAbout(true)}>
          이 작품은?
        </Button>
        <Button
          variant={kiosk ? "warning" : "outline-warning"}
          className="ms-sm-auto"
          onClick={toggleKiosk}
        >
          {kiosk ? "전시 모드 끄기" : "전시 모드"}
        </Button>
      </div>

      {/* ★ 5단계 — 걸러낸 경고를 돌면서 띄운다 */}
      {activeAlerts.map((a) => (
        <Alert key={a.key} variant={a.variant} className="d-flex align-items-center gap-3">
          <span className="fs-3">{a.icon}</span>
          <div>
            <div className="fw-bold">{a.label}</div>
            <div className="small">
              현재 값 {sensor?.[a.key]} ({a.over} 이상). {a.hint}
            </div>
          </div>
        </Alert>
      ))}

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

              {/* ★ 4단계 — 스위치도 배열을 돌면서 만든다. 센서 카드와 똑같은 방식이다.
                  세 개를 조합하면 여덟 가지 색이 나온다 — 디지털논리의 3비트 진리표 */}
              {SWITCHES.map((s) => (
                <Form.Check
                  key={s.key}
                  type="switch"
                  id={`sw-${s.key}`}
                  label={`${s.label} (${s.pin})`}
                  className="fs-5 mb-2"
                  checked={sw[s.key]}
                  disabled={autoMode}
                  onChange={(e) => toggleSwitch(s.key, e.target.checked)}
                />
              ))}

              <Form.Check
                type="switch"
                id="auto-mode"
                label={`자동 모드 — 조도 ${AUTO_LIGHT_ON}% 아래면 전부 켜기`}
                className="fs-5 mt-4 mb-4"
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
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
                onClick={() => sendAndNotify(sw, servoAngle)}
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
            <strong>빨강·초록·파랑</strong> 스위치를 조합하면 여덟 가지 색이 나옵니다.
            <strong>자동 모드</strong>를 켜면 주변이 어두워질 때 스스로 켜집니다 —
            손으로 조도 센서를 가려 보세요.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowAbout(false)}>닫기</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
