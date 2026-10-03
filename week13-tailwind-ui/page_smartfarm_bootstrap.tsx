// src/app/dashboard/page.tsx ── 11주차 스마트팜 완성본 (Bootstrap)
//
// 11주차를 프롬프트 0~7 로 끝까지 따라가면 나오는 화면입니다.
// 팀마다 AI 답변이 조금씩 달라 파일이 같지 않으므로, 13주차는 이 파일을 공통 출발점으로 씁니다.
// 13주차에서는 이 화면의 "보이는 부분"만 Tailwind 로 다시 그립니다.
// 통신 부분(openSocket / scheduleRetry / sendCommand / 자동 모드)은 한 글자도 바꾸지 않습니다.
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert, Badge, Button, Card, Col, Container, Form, ProgressBar, Row,
  Modal, Tab, Tabs, Toast, ToastContainer,
} from "react-bootstrap";

// ★ 센서 — key 는 Pico가 보내는 JSON의 키와 "글자 하나까지" 같아야 합니다.
const SENSORS = [
  { key: "temperature",   label: "온도",     unit: "°C", max: 50,  variant: "danger"    },
  { key: "humidity",      label: "습도",     unit: "%",  max: 100, variant: "info"      },
  { key: "light_percent", label: "조도",     unit: "%",  max: 100, variant: "warning"   },
  { key: "cpu_temp",      label: "칩 온도",  unit: "°C", max: 80,  variant: "secondary" },
  { key: "discomfort",    label: "불쾌지수", unit: "",   max: 100, variant: "success"   },
  // ★ 11주차 스마트팜 — 프롬프트 1 로 추가한 센서
  { key: "soil",          label: "토양수분", unit: "%",  max: 100, variant: "info"      },
];

// ★ 액추에이터 — key 는 Pico로 보낼 JSON의 키가 된다.
const SWITCHES = [
  { key: "led_r", label: "빨강", pin: "GP17" },
  { key: "led_g", label: "초록", pin: "GP18" },
  { key: "led_b", label: "파랑", pin: "GP19" },
  // ★ 11주차 스마트팜 — 프롬프트 1-B 로 추가한 급수 밸브 (28BYJ-48 스텝모터)
  { key: "valve", label: "급수 밸브", pin: "GP10~13" },
];

type SensorData = Record<string, number | null>;
type SwitchState = Record<string, boolean>;

// ★ 경고 규칙 — over 는 "~보다 크면", under 는 "~보다 작으면".
// 조건이 두 방향이 되어서 필드를 하나 더 두었습니다. 배열 구조 자체는 그대로입니다.
type AlertRule = {
  key: string; icon: string; label: string; variant: string; hint: string;
  over?: number; under?: number;
};

const INITIAL_SWITCHES: SwitchState = {};
for (const s of SWITCHES) INITIAL_SWITCHES[s.key] = false;

// ★ 자동 제어 기준값 세 가지 — 서로 다른 센서를 본다
const AUTO_LIGHT_ON = 40;   // 조도 40% 아래면 생장등 켜기
const AUTO_SOIL_ON = 30;    // 토양수분 30% 아래면 급수 밸브 열기
const AUTO_VENT_OVER = 28;  // 온도 28도 넘으면 환기창 90도

// ★ 자동 모드가 "조도 하나로 함께" 움직이는 스위치들.
// 급수 밸브는 토양수분으로 움직이므로 여기 넣으면 안 됩니다 (조건이 다릅니다).
const AUTO_KEYS = ["led_r", "led_g", "led_b"];

const RETRY_MS = 3000;

const ALERTS: AlertRule[] = [
  { key: "temperature", over: 30, icon: "🔥", label: "고온 경고",
    variant: "danger", hint: "장치 주변을 확인하세요." },
  { key: "discomfort", over: 80, icon: "😓", label: "불쾌지수 매우 높음",
    variant: "warning", hint: "환기하거나 온도를 낮추세요." },
  // ★ 11주차 스마트팜 — 프롬프트 3-B. "~보다 작으면" 이라 under 를 쓴다.
  { key: "soil", under: 20, icon: "💧", label: "물 부족",
    variant: "danger", hint: "급수 밸브를 확인하세요." },
];

function SensorCard({
  label, value, unit, max, variant,
}: {
  label: string; value: number | null; unit: string; max: number; variant: string;
}) {
  const missing = value === null;
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
  const [retrying, setRetrying] = useState(false);
  const [kiosk, setKiosk] = useState(false);
  const [sensor, setSensor] = useState<SensorData | null>(null);

  const [sw, setSw] = useState<SwitchState>(INITIAL_SWITCHES);
  const [autoMode, setAutoMode] = useState(false);
  const [servoAngle, setServoAngle] = useState(90);

  const [toast, setToast] = useState({ show: false, ok: true, msg: "" });

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantConnectedRef = useRef(false);
  const picoIpRef = useRef(picoIp);

  useEffect(() => {
    picoIpRef.current = picoIp;
  }, [picoIp]);

  const openSocket = () => {
    wsRef.current?.close();
    const ws = new WebSocket(`ws://${picoIpRef.current}:5000/connect-websocket`);

    ws.onopen = () => {
      setConnected(true);
      setRetrying(false);
    };
    ws.onclose = () => {
      setConnected(false);
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

  const scheduleRetry = () => {
    setRetrying(true);
    if (retryRef.current) clearTimeout(retryRef.current);
    retryRef.current = setTimeout(openSocket, RETRY_MS);
  };

  const connect = () => {
    wantConnectedRef.current = true;
    openSocket();
  };

  const disconnect = () => {
    wantConnectedRef.current = false;
    if (retryRef.current) clearTimeout(retryRef.current);
    setRetrying(false);
    wsRef.current?.close();
  };

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

  const toggleSwitch = (key: string, on: boolean) => {
    const next = { ...sw, [key]: on };
    setSw(next);
    sendAndNotify(next, servoAngle);
  };

  // ★ 자동 제어 세 가지 — 서로 다른 센서를 보는 독립 규칙입니다.
  // 한 센서가 null 이어도 나머지 규칙은 계속 움직입니다.
  // ?? 0 을 쓰면 센서가 죽었을 때 0 으로 읽혀 물을 계속 주게 됩니다 (9주차 6단계).
  useEffect(() => {
    if (!autoMode || !sensor) return;

    const next = { ...sw };
    let angle = servoAngle;
    let changed = false;

    // ① 조도 → 생장등 (AUTO_KEYS 가 하나의 조건으로 함께 움직인다)
    const light = sensor.light_percent;
    if (light != null) {
      const on = light < AUTO_LIGHT_ON;
      for (const k of AUTO_KEYS) {
        if (next[k] !== on) { next[k] = on; changed = true; }
      }
    }

    // ② 토양수분 → 급수 밸브 (조도와 다른 조건이라 따로 본다)
    const soil = sensor.soil;
    if (soil != null) {
      const open = soil < AUTO_SOIL_ON;
      if (next.valve !== open) { next.valve = open; changed = true; }
    }

    // ③ 온도 → 환기창 (서보)
    const temp = sensor.temperature;
    if (temp != null) {
      const want = temp > AUTO_VENT_OVER ? 90 : 0;
      if (angle !== want) { angle = want; changed = true; }
    }

    // ★ 바뀐 것이 있을 때만 보낸다. 그냥 두면 1초마다 같은 명령이 나가고,
    //   스텝모터는 명령을 받을 때마다 또 돌아서 밸브가 한 방향으로 계속 감깁니다.
    if (changed) {
      setSw(next);
      setServoAngle(angle);
      sendCommand(next, angle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor, autoMode]);

  useEffect(() => {
    return () => {
      wantConnectedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

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

  // ★ over 가 있으면 "이상", 없으면 under 로 "이하" 를 본다
  const activeAlerts = ALERTS.filter((a) => {
    const v = sensor?.[a.key];
    if (v == null) return false;
    return a.over != null ? v >= a.over : v <= (a.under as number);
  });

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2 mb-0">교실 스마트팜</h1>
        <Badge
          bg={connected ? "success" : retrying ? "warning" : "secondary"}
          className="fs-5"
        >
          {connected ? "ONLINE" : retrying ? "재연결 중…" : "OFFLINE"}
        </Badge>
      </div>

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

      {activeAlerts.map((a) => (
        <Alert key={a.key} variant={a.variant} className="d-flex align-items-center gap-3">
          <span className="fs-3">{a.icon}</span>
          <div>
            <div className="fw-bold">{a.label}</div>
            <div className="small">
              현재 값 {sensor?.[a.key]}{" "}
              ({a.over != null ? `${a.over} 이상` : `${a.under} 이하`}). {a.hint}
            </div>
          </div>
        </Alert>
      ))}

      <Tabs defaultActiveKey="monitor" id="main-tabs" className="mb-3 fs-5">
        <Tab eventKey="monitor" title="실시간 모니터">
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

              {SWITCHES.map((s) => (
                <Form.Check
                  key={s.key}
                  type="switch"
                  id={`sw-${s.key}`}
                  label={`${s.label} (${s.pin})`}
                  className="fs-5 mb-2"
                  checked={sw[s.key]}
                  // ★ 자동 모드가 쥐고 있는 스위치만 잠근다
                  disabled={autoMode && (AUTO_KEYS.includes(s.key) || s.key === "valve")}
                  onChange={(e) => toggleSwitch(s.key, e.target.checked)}
                />
              ))}

              <Form.Check
                type="switch"
                id="auto-mode"
                label={`자동 모드 — 흙 ${AUTO_SOIL_ON}% 아래면 급수, 조도 ${AUTO_LIGHT_ON}% 아래면 생장등, ${AUTO_VENT_OVER}도 넘으면 환기`}
                className="fs-5 mt-4 mb-4"
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
              />

              <div className="d-flex justify-content-between small text-body-secondary">
                <span>환기창 각도</span>
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
            Raspberry Pi Pico 2 W가 온도·습도·조도·토양수분을 1초마다 측정해
            Wi-Fi로 이 화면에 보냅니다.
          </p>
          <p className="mb-0">
            <strong>자동 모드</strong>를 켜면 세 가지가 스스로 움직입니다 —
            흙이 마르면 <strong>급수 밸브</strong>를 열고, 어두워지면 <strong>생장등</strong>을 켜고,
            더워지면 <strong>환기창</strong>을 엽니다. 손으로 조도 센서를 가려 보세요.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowAbout(false)}>닫기</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
