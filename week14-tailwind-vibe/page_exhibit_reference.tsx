// src/app/dashboard/page.tsx ── 전시 최종 모범답안 (선생님용)
//
// ⚠️ 학생 코드와 글자 하나까지 같지는 않습니다.
//    학생들은 19단계에서 각자 주제로 화면을 만들었기 때문에 팀마다 다릅니다.
//    이 파일은 **11·14주차에서 더해야 할 두 덩어리가 어떻게 생겼는지** 보여주고,
//    선생님이 목표 동작을 직접 돌려 볼 수 있게 하는 기준입니다.
//
//    대조할 곳은 ★ 11주차 / ★ 14주차 주석이 붙은 블록뿐입니다.
//    나머지(UI 토큰 · 센서 카드 · 토스트)는 기본·심화과정에서 이미 만든 것을 흉내낸 것입니다.
//
// ─────────────────────────────────────────────────────────────
// ★ 11주차 — 자동 재연결 (전시 필수)
//    전시장에서 Wi-Fi 는 반드시 한 번은 끊깁니다. 지금 학생 코드는 끊기면
//    offline 으로만 바뀌고 **사람이 「다시 연결」을 눌러야** 합니다.
//    무인 전시에서는 그대로 멈춘 화면이 됩니다.
//
// ★ 14주차 — 전시 모드
//    WakeLock(화면 안 꺼짐) + 전체화면 + 설정 버튼 숨김 + 값 크게 + 작품 설명 상시 노출
// ─────────────────────────────────────────────────────────────
"use client";

import {
  useCallback, useEffect, useRef, useState, type ComponentType,
} from "react";
import {
  AlertTriangle, CloudSun, Cpu, Droplets, Info, Loader2, Maximize2,
  Minimize2, Power, RefreshCw, Sun, Thermometer, Wifi, WifiOff,
} from "lucide-react";

type SensorKey =
  | "temperature" | "humidity" | "light_percent" | "cpu_temp" | "discomfort";

type SensorData = Record<string, number | null>;
type ConnectionStatus = "offline" | "connecting" | "online";

type SensorDefinition = {
  key: SensorKey;
  label: string;
  unit: string;
  icon: ComponentType<{ className?: string }>;
  max: number;
};

const UI = {
  page: "min-h-screen bg-slate-50 text-slate-900",
  container: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8",
  card: "rounded-2xl border border-slate-200 bg-white",
  cardPadding: "p-5",
  sectionTitle: "text-lg font-semibold tracking-tight text-slate-900",
  cardTitle: "text-sm font-semibold text-slate-900",
  description: "text-sm leading-6 text-slate-500",
  focus:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
  primaryButton:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 " +
    "text-sm font-semibold text-white transition-colors hover:bg-slate-800 " +
    "disabled:cursor-not-allowed disabled:opacity-50",
  secondaryButton:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 " +
    "bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50",
};

const SENSORS: SensorDefinition[] = [
  { key: "temperature",   label: "온도",     unit: "°C", icon: Thermometer, max: 40 },
  { key: "humidity",      label: "습도",     unit: "%",  icon: Droplets,    max: 100 },
  { key: "light_percent", label: "조도",     unit: "%",  icon: Sun,         max: 100 },
  { key: "cpu_temp",      label: "칩 온도",  unit: "°C", icon: Cpu,         max: 100 },
  { key: "discomfort",    label: "불쾌지수", unit: "",   icon: CloudSun,    max: 100 },
];

// ★ 11주차 — 끊겼을 때 다시 시도하는 간격
const RETRY_MS = 3000;

function getSensorStatus(
  key: SensorKey, value: number | null,
): "normal" | "warning" | "danger" {
  if (value === null) return "normal";
  if (key === "temperature") { if (value >= 35) return "danger"; if (value >= 30) return "warning"; }
  if (key === "humidity")    { if (value >= 80) return "danger"; if (value >= 70) return "warning"; }
  if (key === "cpu_temp")    { if (value >= 80) return "danger"; if (value >= 70) return "warning"; }
  if (key === "discomfort")  { if (value >= 80) return "danger"; if (value >= 75) return "warning"; }
  return "normal";
}

function SensorCard({
  definition, value, stale, big,
}: {
  definition: SensorDefinition;
  value: number | null;
  stale: boolean;     // ★ 11주차 — 재연결 중에는 마지막 값을 흐리게 유지합니다
  big: boolean;       // ★ 14주차 — 전시 모드에서 크게
}) {
  const { label, unit, icon: Icon, max } = definition;
  const status = getSensorStatus(definition.key, value);
  const missing = value === null;

  const tone =
    status === "danger" ? "text-rose-600"
    : status === "warning" ? "text-amber-600"
    : "text-emerald-600";

  const bar =
    status === "danger" ? "bg-rose-500"
    : status === "warning" ? "bg-amber-500"
    : "bg-emerald-500";

  const percent = missing ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <article className={`${UI.card} ${UI.cardPadding} ${stale ? "opacity-60" : ""} transition-opacity`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h3 className={UI.cardTitle}>{label}</h3>
        <span className={`ml-auto text-xs font-medium ${tone}`}>
          {missing ? "데이터 없음"
            : status === "danger" ? "위험" : status === "warning" ? "주의" : "정상"}
        </span>
      </div>

      {/* ★ 14주차 — 전시 모드에서 1m 밖에서도 읽히게 */}
      <p
        className={`mt-3 font-mono font-semibold tracking-tight tabular-nums ${
          big ? "text-6xl" : "text-3xl"
        } ${missing ? "text-slate-400" : "text-slate-900"}`}
      >
        {missing ? "--" : value.toFixed(1)}
        <span className={`ml-1 font-medium text-slate-500 ${big ? "text-2xl" : "text-base"}`}>
          {unit}
        </span>
      </p>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={`h-full rounded-full ${bar} transition-[width] duration-500`}
             style={{ width: `${percent}%` }} />
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const [picoIp, setPicoIp] = useState("127.0.0.1");
  const [status, setStatusState] = useState<ConnectionStatus>("offline");
  const [sensor, setSensor] = useState<SensorData | null>(null);
  const [kiosk, setKiosk] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // ★ 11주차 — 재연결에 필요한 것 네 가지
  //   타이머 안에서는 useState 값이 "소켓을 열던 시점의 옛날 값" 으로 보입니다.
  //   그래서 타이머가 읽어야 하는 것은 전부 useRef 로 둡니다.
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantConnectedRef = useRef(false);  // 사람이 "연결"을 눌러 둔 상태인가
  const picoIpRef = useRef(picoIp);        // 타이머가 나중에 쓸 IP
  const statusRef = useRef<ConnectionStatus>("offline");

  useEffect(() => { picoIpRef.current = picoIp; }, [picoIp]);

  const setStatus = useCallback((next: ConnectionStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  // ★ 11주차 — 실제로 소켓을 여는 부분. 재연결 타이머도 이 함수를 부릅니다.
  const openSocket = useCallback(() => {
    setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${picoIpRef.current}:5000/connect-websocket`);
    } catch {
      // IP 를 잘못 적으면 생성자가 바로 던집니다. 그래도 멈추지 않고 다시 시도합니다.
      if (wantConnectedRef.current) scheduleRetryRef.current?.();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => setStatus("online");

    ws.onmessage = (event) => {
      try {
        setSensor(JSON.parse(event.data));
      } catch {
        console.warn("잘못된 메시지 형식:", event.data);
      }
    };

    // onerror 다음에 onclose 가 이어서 불립니다. 재시도는 onclose 한 곳에서만 합니다.
    ws.onclose = () => {
      wsRef.current = null;
      if (wantConnectedRef.current) scheduleRetryRef.current?.();
      else setStatus("offline");
    };
  }, [setStatus]);

  // ★ 11주차 — RETRY_MS 뒤에 다시 열어 본다
  const scheduleRetryRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    scheduleRetryRef.current = () => {
      setStatus("connecting");          // 화면에는 "재연결 중" 으로 보입니다
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(openSocket, RETRY_MS);
    };
  }, [openSocket, setStatus]);

  const connect = () => {
    if (statusRef.current !== "offline") return;   // state 가 아니라 ref 를 봅니다
    wantConnectedRef.current = true;
    openSocket();
  };

  // ★ 11주차 — 사람이 끊었으면 다시 붙지 않습니다
  const disconnect = () => {
    wantConnectedRef.current = false;
    if (retryRef.current) clearTimeout(retryRef.current);
    retryRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("offline");
  };

  // ★ 11주차 — 페이지를 벗어날 때 타이머까지 정리 (안 하면 계속 재연결을 시도합니다)
  useEffect(() => {
    return () => {
      wantConnectedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  // ★ 14주차 — 전시 모드: 화면이 꺼지지 않게 막습니다
  useEffect(() => {
    if (!kiosk) return;
    let lock: { release: () => Promise<void> } | null = null;

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) lock = await nav.wakeLock.request("screen");
      } catch { /* 지원하지 않는 브라우저에서도 멈추지 않습니다 */ }
    };
    // 다른 탭에 갔다 오면 잠금이 풀리므로 다시 겁니다
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [kiosk]);

  // ★ 14주차 — ESC 로 전체화면을 빠져나와도 전시 모드가 같이 꺼지게
  //   이게 없으면 버튼이 숨겨진 채로 남아 되돌릴 방법이 없어집니다.
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setKiosk(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleKiosk = async () => {
    const next = !kiosk;
    setKiosk(next);
    try {
      if (next) await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* 전체화면이 막혀도 전시 모드 자체는 동작합니다 */ }
  };

  const online = status === "online";
  const connecting = status === "connecting";
  // ★ 11주차 — 재연결 중이면 마지막 값을 지우지 않고 흐리게 둡니다 (화면 깜빡임 방지)
  const stale = connecting && sensor !== null;

  return (
    <main className={UI.page}>
      <div className={UI.container}>

        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              우리 팀 작품 이름
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Pico 2 W 센서를 실시간으로 보여 줍니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* ★ 11주차 — 상태를 색 + 아이콘 + 글자 세 가지로 알립니다 */}
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                online ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : connecting ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-500"
              }`}
              role="status"
              aria-live="polite"
            >
              {online ? <Wifi className="h-4 w-4" aria-hidden="true" />
                : connecting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                : <WifiOff className="h-4 w-4" aria-hidden="true" />}
              {online ? "ONLINE" : connecting ? "재연결 중…" : "OFFLINE"}
            </span>

            {/* ★ 14주차 — 전시 모드에서는 조작 버튼을 숨깁니다 */}
            {!kiosk && (
              <>
                <input
                  value={picoIp}
                  onChange={(e) => setPicoIp(e.target.value)}
                  aria-label="Pico IP 주소"
                  className={`w-36 rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm ${UI.focus}`}
                />
                <button
                  type="button"
                  onClick={online || connecting ? disconnect : connect}
                  className={`${UI.secondaryButton} ${UI.focus}`}
                >
                  <Power className="h-4 w-4" aria-hidden="true" />
                  {online || connecting ? "연결 끊기" : "장치 연결"}
                </button>
              </>
            )}

            <button type="button" onClick={toggleKiosk} className={`${UI.primaryButton} ${UI.focus}`}>
              {kiosk ? <Minimize2 className="h-4 w-4" aria-hidden="true" />
                     : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
              {kiosk ? "전시 모드 끄기" : "전시 모드"}
            </button>
          </div>
        </header>

        {/* ★ 11주차 — 사람이 끊어 둔 상태에서만 "다시 연결" 을 권합니다.
            자동 재연결 중에는 이 카드가 뜨지 않아야 합니다. */}
        {status === "offline" && !kiosk && (
          <section className="mt-6">
            <div className="flex flex-col gap-4 rounded-xl border border-rose-200 bg-rose-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-rose-900">장치에 연결되어 있지 않습니다.</h3>
                  <p className="mt-1 text-sm leading-6 text-rose-700">
                    Pico 2 W 의 IP 주소를 확인하고 「장치 연결」을 눌러 주세요.
                  </p>
                </div>
              </div>
              <button type="button" onClick={connect}
                      className={`${UI.secondaryButton} shrink-0 ${UI.focus}`}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                다시 연결
              </button>
            </div>
          </section>
        )}

        {/* 센서 */}
        <section className="mt-8">
          {!kiosk && (
            <div className="mb-4">
              <h2 className={UI.sectionTitle}>실시간 센서</h2>
              <p className={`mt-1 ${UI.description}`}>Pico 2 W 에서 받은 값입니다.</p>
            </div>
          )}

          {sensor === null ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
              <Info className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold text-slate-700">
                아직 센서 데이터가 없습니다.
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                장치에 연결하면 값이 들어옵니다.
              </p>
            </div>
          ) : (
            <div className={`grid gap-4 sm:grid-cols-2 ${kiosk ? "lg:grid-cols-3" : "lg:grid-cols-3"}`}>
              {SENSORS.map((item) => (
                <SensorCard
                  key={item.key}
                  definition={item}
                  value={sensor[item.key] ?? null}
                  stale={stale}
                  big={kiosk}
                />
              ))}
            </div>
          )}
        </section>

        {/* ★ 14주차 — 작품 설명.
            전시 모드에서는 모달이 아니라 "늘 보이는 카드" 로 띄웁니다.
            관람객은 버튼을 누르지 않습니다. */}
        <section className="mt-8">
          <div className={`${UI.card} ${UI.cardPadding}`}>
            <h2 className={UI.sectionTitle}>이 작품은?</h2>
            <p className={`mt-2 ${UI.description}`}>
              {/* 여기를 우리 팀 작품 설명으로 바꾸세요.
                  기술 이름(Next.js · Tailwind)이 아니라, 관람객이 궁금한 것을 적습니다. */}
              교실 공기를 재서 더우면 알려 주는 장치입니다.
              온도와 습도로 불쾌지수를 계산해, 환기할 때가 되면 화면이 노랗게 바뀝니다.
            </p>
            <p className={`mt-2 ${UI.description}`}>
              <strong className="text-slate-700">해 보세요 —</strong>{" "}
              조도 센서를 손으로 가려 보면 값이 바로 내려갑니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
