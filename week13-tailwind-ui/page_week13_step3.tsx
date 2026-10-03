// src/app/dashboard/page.tsx ── 13주차 3단계: Color (의미 색 토큰)
//
// 2단계에서 바뀐 곳은 색뿐입니다. 구조도 글자도 통신도 그대로입니다.
//
// ★ 색 이름을 화면 곳곳에 흩어 놓으면 나중에 한 번에 못 바꿉니다.
//   globals.css 의 @theme 에 "뜻"으로 이름을 붙이고, 화면은 그 이름만 씁니다.
//   15주차에서 그 값만 갈아끼우면 화면 전체의 분위기가 바뀝니다.
//
//   바뀌는 것   base(페이지) surface(카드) line(경계) ink(글자) ink-dim(보조)
//   안 바뀌는 것 ok(정상) warn(주의) bad(오류) idle(비활성)   ← 뜻이 정해져 있다
//
//
// 글자 위계 5단 — 중요한 순서대로 크기와 굵기를 벌립니다.
//   ① 대시보드 제목   text-2xl font-bold
//   ② 섹션 제목       text-sm  font-semibold
//   ③ 센서 이름       text-xs  uppercase tracking-wider   (작지만 모양이 달라 구분된다)
//   ④ 센서 값         text-4xl font-semibold tabular-nums (주인공은 text-6xl)
//   ⑤ 단위·보조 설명  text-sm  text-ink-dim
//
// ★ tabular-nums 가 오늘의 숨은 주인공입니다.
//   없으면 8.3 → 31.5 처럼 값이 바뀔 때 숫자 폭이 달라져 화면이 덜컹거립니다.
"use client";

import { useEffect, useRef, useState } from "react";

const SENSORS = [
  // ★ 맨 앞이 "주인공" 입니다. 격자에서 두 칸을 차지합니다.
  { key: "soil",          label: "토양수분", unit: "%",  max: 100 },
  { key: "temperature",   label: "온도",     unit: "°C", max: 50  },
  { key: "humidity",      label: "습도",     unit: "%",  max: 100 },
  { key: "light_percent", label: "조도",     unit: "%",  max: 100 },
  { key: "cpu_temp",      label: "칩 온도",  unit: "°C", max: 80  },
  { key: "discomfort",    label: "불쾌지수", unit: "",   max: 100 },
];

const SWITCHES = [
  { key: "led_r", label: "빨강", pin: "GP17" },
  { key: "led_g", label: "초록", pin: "GP18" },
  { key: "led_b", label: "파랑", pin: "GP19" },
  { key: "valve", label: "급수 밸브", pin: "GP10~13" },
];

type SensorData = Record<string, number | null>;
type SwitchState = Record<string, boolean>;
type AlertRule = {
  key: string; icon: string; label: string; hint: string;
  level: "warn" | "bad";          // ★ 3단계 — 색을 고르려면 등급이 있어야 한다
  over?: number; under?: number;
};

const INITIAL_SWITCHES: SwitchState = {};
for (const s of SWITCHES) INITIAL_SWITCHES[s.key] = false;

const AUTO_LIGHT_ON = 40;
const AUTO_SOIL_ON = 30;
const AUTO_VENT_OVER = 28;
const AUTO_KEYS = ["led_r", "led_g", "led_b"];
const RETRY_MS = 3000;

const ALERTS: AlertRule[] = [
  { key: "temperature", over: 30, icon: "🔥", label: "고온 경고", level: "bad", hint: "장치 주변을 확인하세요." },
  { key: "discomfort", over: 80, icon: "😓", label: "불쾌지수 매우 높음", level: "warn", hint: "환기하거나 온도를 낮추세요." },
  { key: "soil", under: 20, icon: "💧", label: "물 부족", level: "bad", hint: "급수 밸브를 확인하세요." },
];

// ★ 1단계 — 카드 한 장. Bootstrap <Card> 가 하던 일을 클래스 네 개로 합니다.
//   rounded-xl(모서리) border(테두리) bg-surface(배경) p-5(안쪽 여백)
function SensorCard({
  label, value, unit, max, big, status,
}: {
  label: string; value: number | null; unit: string; max: number;
  big?: boolean; status: "ok" | "warn" | "bad";
}) {
  const missing = value === null;
  const percent = missing ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  // ★ 색을 if 로 고르지 않고 "뜻 → 색" 표로 고릅니다. 등급이 늘어도 여기만 늘면 됩니다.
  const border = missing ? "border-line" : { ok: "border-line", warn: "border-warn", bad: "border-bad" }[status];
  const bar = missing ? "bg-idle" : { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[status];

  return (
    <div className={`rounded-xl border ${border} bg-surface p-5 ${big ? "sm:col-span-2" : ""}`}>
      {/* ③ 센서 이름 */}
      <div className="text-xs uppercase tracking-wider text-ink-dim">{label}</div>
      {/* ④ 센서 값 — 주인공만 더 크게. tabular-nums 로 숫자 폭을 고정한다 */}
      <div
        className={`mt-1 font-semibold tabular-nums ${big ? "text-6xl" : "text-4xl"} ${
          missing ? "text-idle" : ""
        }`}
      >
        {missing ? "--" : value}
        {/* ⑤ 단위 */}
        <span className="ml-1 text-sm font-normal text-ink-dim">
          {missing ? "값 없음" : unit}
        </span>
      </div>
      {/* ★ 막대 — 바깥 상자에 안쪽 막대를 넣고 width 만 바꿉니다.
          퍼센트는 클래스로 못 만들기 때문에 style 로 줍니다. */}
      <div className="mt-3 h-2 w-full rounded bg-line">
        <div
          className={`h-2 rounded ${bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [picoIp, setPicoIp] = useState("192.168.0.51");
  const [connected, setConnected] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [kiosk, setKiosk] = useState(false);
  const [sensor, setSensor] = useState<SensorData | null>(null);
  const [sw, setSw] = useState<SwitchState>(INITIAL_SWITCHES);
  const [autoMode, setAutoMode] = useState(false);
  const [servoAngle, setServoAngle] = useState(90);
  const [note, setNote] = useState("");

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
    ws.onopen = () => { setConnected(true); setRetrying(false); };
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

  const connect = () => { wantConnectedRef.current = true; openSocket(); };

  const disconnect = () => {
    wantConnectedRef.current = false;
    if (retryRef.current) clearTimeout(retryRef.current);
    setRetrying(false);
    wsRef.current?.close();
  };

  const sendCommand = (next: SwitchState, angle: number) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false;
    const payload: Record<string, number> = { servo_angle: angle };
    for (const s of SWITCHES) payload[s.key] = next[s.key] ? 255 : 0;
    wsRef.current.send(JSON.stringify(payload));
    return true;
  };

  // ★ 토스트 대신 헤더에 한 줄로 알립니다 (Tailwind 에는 Toast 부품이 없습니다)
  const sendAndNotify = (next: SwitchState, angle: number) => {
    const ok = sendCommand(next, angle);
    setNote(ok ? "명령을 전송했습니다." : "연결되지 않았습니다.");
  };

  const toggleSwitch = (key: string, on: boolean) => {
    const next = { ...sw, [key]: on };
    setSw(next);
    sendAndNotify(next, servoAngle);
  };

  useEffect(() => {
    if (!autoMode || !sensor) return;
    const next = { ...sw };
    let angle = servoAngle;
    let changed = false;

    const light = sensor.light_percent;
    if (light != null) {
      const on = light < AUTO_LIGHT_ON;
      for (const k of AUTO_KEYS) {
        if (next[k] !== on) { next[k] = on; changed = true; }
      }
    }
    const soil = sensor.soil;
    if (soil != null) {
      const open = soil < AUTO_SOIL_ON;
      if (next.valve !== open) { next.valve = open; changed = true; }
    }
    const temp = sensor.temperature;
    if (temp != null) {
      const want = temp > AUTO_VENT_OVER ? 90 : 0;
      if (angle !== want) { angle = want; changed = true; }
    }

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
      } catch { /* 지원하지 않는 브라우저에서도 멈추지 않는다 */ }
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
    } catch { /* 전체화면이 막혀도 전시 모드 자체는 동작한다 */ }
  };

  // ★ 이 센서에 지금 걸린 경고가 있으면 그 등급을, 없으면 정상(ok)을 돌려준다
  const statusOf = (key: string): "ok" | "warn" | "bad" => {
    const hit = activeAlerts.find((a) => a.key === key);
    return hit ? hit.level : "ok";
  };

  const activeAlerts = ALERTS.filter((a) => {
    const v = sensor?.[a.key];
    if (v == null) return false;
    return a.over != null ? v >= a.over : v <= (a.under as number);
  });

  return (
    // ★ Bootstrap <Container> 가 하던 일: 가운데 정렬 + 최대 폭 + 좌우 여백
    <div className="mx-auto max-w-6xl px-4 py-6">

      {/* ───── 헤더 ─────
          모달을 안 쓰므로 IP 입력칸이 헤더에 그대로 나와 있습니다 */}
      <header className="mb-6 flex flex-wrap items-center gap-3">
        {/* ① 대시보드 제목 */}
        <h1 className="text-2xl font-bold tracking-tight">교실 스마트팜</h1>
        <span className="rounded border border-line px-2 py-1 text-xs font-semibold uppercase tracking-wider">
          {connected ? "ONLINE" : retrying ? "재연결 중…" : "OFFLINE"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!kiosk && (
            <>
              <input
                className="w-40 rounded border border-line bg-surface px-2 py-1 text-sm tabular-nums"
                value={picoIp}
                onChange={(e) => setPicoIp(e.target.value)}
                placeholder="192.168.0.51"
                aria-label="Pico IP 주소"
              />
              <button
                className="rounded border border-line px-3 py-1 text-sm"
                onClick={connected ? disconnect : connect}
              >
                {connected ? "연결 끊기" : "장치 연결"}
              </button>
            </>
          )}
          <button className="rounded border border-line px-3 py-1 text-sm" onClick={toggleKiosk}>
            {kiosk ? "전시 모드 끄기" : "전시 모드"}
          </button>
        </div>
      </header>

      {note && <p className="mb-4 text-sm text-ink-dim">{note}</p>}

      {/* ───── 경고 ───── */}
      {activeAlerts.map((a) => (
        <div
          key={a.key}
          className={`mb-3 flex items-center gap-3 rounded-lg border bg-surface p-4 ${
            a.level === "bad" ? "border-bad" : "border-warn"
          }`}
        >
          <span className="text-2xl">{a.icon}</span>
          <div>
            <div className="font-semibold">{a.label}</div>
            <div className="text-sm text-ink-dim">
              현재 값 {sensor?.[a.key]}{" "}
              ({a.over != null ? `${a.over} 이상` : `${a.under} 이하`}). {a.hint}
            </div>
          </div>
        </div>
      ))}

      {/* ───── Bento Grid ─────
          grid-cols-1 : 좁을 때 한 줄에 한 장
          sm:grid-cols-2 / lg:grid-cols-3 : 넓어지면 두 장, 세 장
          gap-4 : 카드 사이 간격 (16px)
          맨 앞 센서는 sm:col-span-2 로 두 칸을 차지합니다 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SENSORS.map((s, i) => (
          <SensorCard
            key={s.key}
            label={s.label}
            value={sensor?.[s.key] ?? null}
            unit={s.unit}
            max={s.max}
            big={i === 0}
            status={statusOf(s.key)}
          />
        ))}
      </section>

      {/* ───── 제어판 ─────
          탭을 안 쓰므로 모니터 바로 아래에 이어 붙입니다 */}
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
          {/* ② 섹션 제목 */}
          <div className="mb-4 text-sm font-semibold">액추에이터</div>

          {SWITCHES.map((s) => (
            <label key={s.key} className="mb-2 flex items-center gap-3">
              {/* ★ Tailwind 에는 스위치 부품이 없습니다. 직접 만듭니다.
                  peer sr-only : 진짜 체크박스를 숨기되 키보드로는 쓸 수 있게 둡니다
                  peer-checked: : "앞의 peer 가 체크되면" — 형제에게만 걸립니다
                  after:       : 손잡이는 가짜 요소(::after)로 만듭니다.
                                 자식 <span> 으로 만들면 형제가 아니라서 peer-checked 가 안 걸립니다. */}
              <input
                type="checkbox"
                className="peer sr-only"
                checked={sw[s.key]}
                disabled={autoMode && (AUTO_KEYS.includes(s.key) || s.key === "valve")}
                onChange={(e) => toggleSwitch(s.key, e.target.checked)}
              />
              <span
                className="relative h-6 w-11 shrink-0 rounded-full bg-idle transition
                           peer-checked:bg-ok peer-disabled:opacity-40
                           after:absolute after:left-1 after:top-1 after:h-4 after:w-4
                           after:rounded-full after:bg-base after:transition
                           peer-checked:after:translate-x-5"
              />
              <span className="text-sm">{s.label} <span className="text-ink-dim">({s.pin})</span></span>
            </label>
          ))}

          <label className="mt-4 mb-4 flex items-center gap-3">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={autoMode}
              onChange={(e) => setAutoMode(e.target.checked)}
            />
            <span
              className="relative h-6 w-11 shrink-0 rounded-full bg-idle transition
                         peer-checked:bg-ok
                         after:absolute after:left-1 after:top-1 after:h-4 after:w-4
                         after:rounded-full after:bg-base after:transition
                         peer-checked:after:translate-x-5"
            />
            <span className="text-sm">
              자동 모드 — 흙 {AUTO_SOIL_ON}% 아래면 급수, 조도 {AUTO_LIGHT_ON}% 아래면 생장등,
              {" "}{AUTO_VENT_OVER}도 넘으면 환기
            </span>
          </label>

          <div className="flex justify-between text-sm">
            <span className="text-ink-dim">환기창 각도</span>
            <span className="tabular-nums">{servoAngle}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={180}
            value={servoAngle}
            onChange={(e) => setServoAngle(Number(e.target.value))}
            className="w-full"
          />

          <button
            className="mt-3 rounded border border-line px-3 py-1 text-sm"
            disabled={!connected}
            onClick={() => sendAndNotify(sw, servoAngle)}
          >
            설정 반영
          </button>
        </div>

        {/* ★ 모달을 안 쓰므로 작품 설명을 카드로 늘 보여 줍니다.
            전시회에서 관람객이 버튼을 누르지 않아도 읽을 수 있습니다. */}
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-2 text-sm font-semibold">이 작품은?</div>
          <p className="mb-2 text-sm leading-relaxed text-ink-dim">
            Pico 2 W가 온도·습도·조도·토양수분을 1초마다 재서 Wi-Fi로 이 화면에 보냅니다.
          </p>
          <p className="text-sm leading-relaxed text-ink-dim">
            자동 모드를 켜면 흙이 마르면 급수 밸브를 열고, 어두워지면 생장등을 켜고,
            더워지면 환기창을 엽니다. 손으로 조도 센서를 가려 보세요.
          </p>
        </div>
      </section>
    </div>
  );
}
