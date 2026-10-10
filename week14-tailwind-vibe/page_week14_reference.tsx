// src/app/dashboard/page.tsx ── 14주차 모범답안 (선생님용)
//
// ⚠️ 이 파일은 학생에게 주지 않습니다.
//    14주차는 학생이 제미나이에게 부탁해서 직접 만드는 시간입니다.
//    이 파일은 학생 결과물과 대조할 때, 그리고 막힌 팀을 봐 줄 때 쓰는 기준입니다.
//
// 13주차 3단계(page_week13_step3.tsx)에서 **세 가지만** 달라졌습니다.
//
//   미션 1 · 아이콘    lucide-react 아이콘을 센서·경고·스위치·연결상태에 붙임
//                     ★ 아이콘만으로 뜻을 전하지 않습니다 — 글자가 늘 같이 있습니다
//   미션 2 · 휴대폰 폭  390px 에서 가로 스크롤 0. 헤더 조작부가 모바일에서 한 줄 차지,
//                     주인공 값은 text-5xl → sm:text-6xl
//   미션 3 · 반응      hover / active / focus-visible / disabled 를 모두 지정.
//                     연결 상태를 글자만이 아니라 색과 아이콘으로도 보여줌
//
// 통신 코드(openSocket · scheduleRetry · sendCommand · 자동 제어 useEffect)는
// **한 글자도 바뀌지 않았습니다.** 13주차와 같습니다.
//
// (미션과 무관한 정리 한 가지: statusOf 가 activeAlerts 를 쓰므로
//  activeAlerts 를 먼저 선언하도록 순서만 바꿨습니다. 동작은 같습니다.)
"use client";

import { useEffect, useRef, useState } from "react";
// ★ 미션 1 — 아이콘은 "부품"이 아니라 그냥 컴포넌트입니다. 쓸 것만 골라 가져옵니다.
import {
  CloudSun, Cpu, Droplets, Flame, Lightbulb, RotateCw, Sprout, Sun,
  Thermometer, Waves, Wifi, WifiOff, type LucideIcon,
} from "lucide-react";

const SENSORS = [
  // ★ 맨 앞이 "주인공" 입니다. 격자에서 두 칸을 차지합니다.
  // ★ 미션 1 — 배열 구조는 그대로 두고 icon 필드만 하나 더 붙였습니다 (규칙 3-5)
  { key: "soil",          label: "토양수분", unit: "%",  max: 100, icon: Sprout },
  { key: "temperature",   label: "온도",     unit: "°C", max: 50,  icon: Thermometer },
  { key: "humidity",      label: "습도",     unit: "%",  max: 100, icon: Droplets },
  { key: "light_percent", label: "조도",     unit: "%",  max: 100, icon: Sun },
  { key: "cpu_temp",      label: "칩 온도",  unit: "°C", max: 80,  icon: Cpu },
  { key: "discomfort",    label: "불쾌지수", unit: "",   max: 100, icon: CloudSun },
];

const SWITCHES = [
  { key: "led_r", label: "빨강", pin: "GP17", icon: Lightbulb },
  { key: "led_g", label: "초록", pin: "GP18", icon: Lightbulb },
  { key: "led_b", label: "파랑", pin: "GP19", icon: Lightbulb },
  { key: "valve", label: "급수 밸브", pin: "GP10~13", icon: Waves },
];

type SensorData = Record<string, number | null>;
type SwitchState = Record<string, boolean>;
type AlertRule = {
  key: string; icon: LucideIcon; label: string; hint: string;   // ★ icon: string → LucideIcon
  level: "warn" | "bad";
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
  { key: "temperature", over: 30, icon: Flame, label: "고온 경고", level: "bad", hint: "장치 주변을 확인하세요." },
  { key: "discomfort", over: 80, icon: CloudSun, label: "불쾌지수 매우 높음", level: "warn", hint: "환기하거나 온도를 낮추세요." },
  { key: "soil", under: 20, icon: Droplets, label: "물 부족", level: "bad", hint: "급수 밸브를 확인하세요." },
];

// ★ 미션 3 — 버튼의 "반응"을 한 군데 모아 둡니다. 버튼마다 따로 쓰면 반드시 어긋납니다.
//   hover:        마우스를 올렸을 때
//   active:       누르고 있는 동안 (1px 내려가서 눌리는 느낌)
//   focus-visible: 탭 키로 초점이 왔을 때만 테두리 (마우스 클릭에는 안 나옴)
//   disabled:     못 누르는 상태 — 흐려지고, hover·active 반응도 끕니다
const BTN =
  "rounded border border-line px-3 py-1 text-sm transition " +
  "hover:border-ink-dim hover:bg-base " +
  "active:translate-y-px " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ok " +
  "disabled:cursor-not-allowed disabled:opacity-40 " +
  "disabled:hover:border-line disabled:hover:bg-surface disabled:active:translate-y-0";

// ★ 미션 3 — 스위치도 탭 키로 초점이 오는 것이 보여야 합니다.
//   진짜 체크박스는 sr-only 로 숨겨져 있으므로, 초점 표시는 형제인 손잡이 트랙에 겁니다.
const SWITCH_TRACK =
  "relative h-6 w-11 shrink-0 rounded-full bg-idle transition " +
  "peer-checked:bg-ok peer-disabled:opacity-40 " +
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ok " +
  "after:absolute after:left-1 after:top-1 after:h-4 after:w-4 " +
  "after:rounded-full after:bg-base after:transition " +
  "peer-checked:after:translate-x-5";

// ★ 1단계 — 카드 한 장. Bootstrap <Card> 가 하던 일을 클래스 네 개로 합니다.
function SensorCard({
  label, value, unit, max, big, status, Icon,
}: {
  label: string; value: number | null; unit: string; max: number;
  big?: boolean; status: "ok" | "warn" | "bad"; Icon: LucideIcon;
}) {
  const missing = value === null;
  const percent = missing ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  // ★ 색을 if 로 고르지 않고 "뜻 → 색" 표로 고릅니다. 등급이 늘어도 여기만 늘면 됩니다.
  const border = missing ? "border-line" : { ok: "border-line", warn: "border-warn", bad: "border-bad" }[status];
  const bar = missing ? "bg-idle" : { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[status];
  const tint = missing ? "text-idle" : { ok: "text-ink-dim", warn: "text-warn", bad: "text-bad" }[status];

  return (
    <div className={`rounded-xl border ${border} bg-surface p-5 ${big ? "sm:col-span-2" : ""}`}>
      {/* ③ 센서 이름 — ★ 미션 1: 아이콘 + 글자. 아이콘만 두지 않습니다.
          aria-hidden 은 "이 그림은 읽지 마세요" 라는 뜻입니다. 옆에 글자가 이미 있으니까요. */}
      <div className="flex items-center gap-2">
        <Icon aria-hidden className={`h-4 w-4 shrink-0 ${tint}`} />
        <span className="text-xs uppercase tracking-wider text-ink-dim">{label}</span>
      </div>
      {/* ④ 센서 값 — ★ 미션 2: 휴대폰에서는 한 단계 작게. 390px 에서 넘치지 않게. */}
      <div
        className={`mt-1 font-semibold tabular-nums ${
          big ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl"
        } ${missing ? "text-idle" : ""}`}
      >
        {missing ? "--" : value}
        {/* ⑤ 단위 */}
        <span className="ml-1 text-sm font-normal text-ink-dim">
          {missing ? "값 없음" : unit}
        </span>
      </div>
      {/* ★ 막대 — 퍼센트는 클래스로 못 만들기 때문에 style 로 줍니다 (규칙 7-4) */}
      <div className="mt-3 h-2 w-full rounded bg-line">
        <div className={`h-2 rounded ${bar} transition-[width] duration-500`} style={{ width: `${percent}%` }} />
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

  const activeAlerts = ALERTS.filter((a) => {
    const v = sensor?.[a.key];
    if (v == null) return false;
    return a.over != null ? v >= a.over : v <= (a.under as number);
  });

  // ★ 이 센서에 지금 걸린 경고가 있으면 그 등급을, 없으면 정상(ok)을 돌려준다
  const statusOf = (key: string): "ok" | "warn" | "bad" => {
    const hit = activeAlerts.find((a) => a.key === key);
    return hit ? hit.level : "ok";
  };

  // ★ 미션 3 — 연결 상태를 글자만으로 알리지 않습니다. 색과 아이콘도 같이 바뀝니다.
  //   "색만으로" 알리는 것도 안 됩니다. 색 + 아이콘 + 글자, 세 가지가 같이 바뀝니다.
  const link = connected ? "on" : retrying ? "wait" : "off";
  const LinkIcon = { on: Wifi, wait: RotateCw, off: WifiOff }[link];
  const linkClass = {
    on: "border-ok text-ok",
    wait: "border-warn text-warn",
    off: "border-idle text-ink-dim",
  }[link];
  const linkLabel = { on: "ONLINE", wait: "재연결 중…", off: "OFFLINE" }[link];

  return (
    // ★ Bootstrap <Container> 가 하던 일: 가운데 정렬 + 최대 폭 + 좌우 여백
    <div className="mx-auto max-w-6xl px-4 py-6">

      {/* ───── 헤더 ─────
          ★ 미션 2: 휴대폰에서는 조작부가 아래로 내려가 한 줄을 다 씁니다.
             sm: 부터 오른쪽으로 붙습니다 (ml-auto) */}
      <header className="mb-6 flex flex-wrap items-center gap-3">
        {/* ① 대시보드 제목 */}
        <h1 className="text-2xl font-bold tracking-tight">교실 스마트팜</h1>

        {/* ★ 미션 1 + 3: 아이콘 · 색 · 글자가 함께 바뀌는 상태 표시 */}
        <span
          className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold uppercase tracking-wider transition ${linkClass}`}
        >
          <LinkIcon
            aria-hidden
            className={`h-3.5 w-3.5 ${link === "wait" ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          {linkLabel}
        </span>

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          {!kiosk && (
            <>
              <input
                className="w-40 rounded border border-line bg-surface px-2 py-1 text-sm tabular-nums transition
                           hover:border-ink-dim
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ok"
                value={picoIp}
                onChange={(e) => setPicoIp(e.target.value)}
                placeholder="192.168.0.51"
                aria-label="Pico IP 주소"
              />
              <button className={BTN} onClick={connected ? disconnect : connect}>
                {connected ? "연결 끊기" : "장치 연결"}
              </button>
            </>
          )}
          <button className={BTN} onClick={toggleKiosk}>
            {kiosk ? "전시 모드 끄기" : "전시 모드"}
          </button>
        </div>
      </header>

      {note && <p className="mb-4 text-sm text-ink-dim">{note}</p>}

      {/* ───── 경고 ─────
          ★ 미션 1: 이모지 대신 lucide 아이콘. 글자는 그대로 남깁니다.
          ★ 미션 2: items-start 라 긴 글이 여러 줄이 되어도 아이콘이 위에 붙어 있습니다. */}
      {activeAlerts.map((a) => {
        const AlertIcon = a.icon;
        return (
          <div
            key={a.key}
            className={`mb-3 flex items-start gap-3 rounded-lg border bg-surface p-4 ${
              a.level === "bad" ? "border-bad" : "border-warn"
            }`}
          >
            <AlertIcon
              aria-hidden
              className={`mt-0.5 h-5 w-5 shrink-0 ${a.level === "bad" ? "text-bad" : "text-warn"}`}
            />
            <div>
              <div className="font-semibold">{a.label}</div>
              <div className="text-sm text-ink-dim">
                현재 값 {sensor?.[a.key]}{" "}
                ({a.over != null ? `${a.over} 이상` : `${a.under} 이하`}). {a.hint}
              </div>
            </div>
          </div>
        );
      })}

      {/* ───── Bento Grid ───── */}
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
            Icon={s.icon}
          />
        ))}
      </section>

      {/* ───── 제어판 ───── */}
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
          {/* ② 섹션 제목 */}
          <div className="mb-4 text-sm font-semibold">액추에이터</div>

          {SWITCHES.map((s) => {
            const SwIcon = s.icon;
            return (
              <label
                key={s.key}
                className="mb-2 flex items-center gap-3 rounded py-1 transition hover:bg-base"
              >
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
                <span className={SWITCH_TRACK} />
                {/* ★ 미션 1: 스위치도 아이콘 + 글자 */}
                <SwIcon
                  aria-hidden
                  className={`h-4 w-4 shrink-0 ${sw[s.key] ? "text-ok" : "text-idle"}`}
                />
                <span className="text-sm">
                  {s.label} <span className="text-ink-dim">({s.pin})</span>
                </span>
              </label>
            );
          })}

          <label className="mt-4 mb-4 flex items-center gap-3 rounded py-1 transition hover:bg-base">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={autoMode}
              onChange={(e) => setAutoMode(e.target.checked)}
            />
            <span className={SWITCH_TRACK} />
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
            aria-label="환기창 각도"
            className="w-full accent-ok focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ok"
          />

          <button
            className={`mt-3 ${BTN}`}
            disabled={!connected}
            onClick={() => sendAndNotify(sw, servoAngle)}
          >
            설정 반영
          </button>
        </div>

        {/* ★ 모달을 안 쓰므로 작품 설명을 카드로 늘 보여 줍니다. */}
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
