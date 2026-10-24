// src/app/twin/page.tsx ── 11주차 · 디지털 트윈 (선생님이 검증해서 드리는 파일)
//
// ─────────────────────────────────────────────────────────────
// 학생은 이 파일을 열지 않습니다. 고치는 것은 `team-twin.ts` 하나뿐입니다.
//
// 이 파일에 들어 있는 것
//   ★ 8주차  블록 — 자동 재연결. dashboard/page.tsx 의 것과 **똑같습니다.**
//   ★ 9주차  블록 — 전시 모드(WakeLock · 전체화면 · ESC 복귀). 역시 똑같습니다.
//   ★ 11주차 블록 — 3D 방 · 승인 게이트 · 「이 명령이 실제로 간 길」 네 줄
//
// 2D 화면(`src/app/dashboard/page.tsx`)은 **한 글자도 건드리지 않습니다.**
// 트윈이 깨져도 관람객 앞에서 한 번에 2D 로 돌아갈 수 있어야 하기 때문입니다.
// ─────────────────────────────────────────────────────────────
//
// 🚨 WebGL 이 필요합니다 — 그리고 안 될 때의 길을 반드시 열어 둡니다.
//
//    이 화면은 three.js(WebGL)로 그립니다. 전시장 노트북이 오래됐거나 그래픽
//    드라이버가 말썽이면 **WebGL 이 아예 안 켜질 수 있습니다.** 그래서
//      ① 페이지를 열 때 WebGL 을 먼저 시험해 보고,
//      ② 안 되면 3D 를 아예 띄우지 않고 **`/office`(WebGL 없이 도는 화면)** 로 안내합니다.
//    `/office` 는 CSS 만으로 그려서 `--disable-gpu` 에서도 똑같이 나옵니다.
//
// 🚨 drei <Html> 의 **첫 번째 인스턴스만 글자가 안 나오는** 문제가 있습니다.
//
//    React 19 / Next 16 에서 실측했습니다 — 장치 다섯 개 중 **배열 맨 앞의 하나만**
//    껍데기만 생기고 글자가 비었습니다. 순서를 바꾸면 비는 것도 따라 바뀝니다.
//    (drei 가 인스턴스마다 포털 그릇을 직접 만드는데, 첫 커밋에서 그릇이 아직 없습니다)
//
//    그래서 **포털 그릇을 우리가 만들어 넘깁니다** — `labelRef` 하나를 모든
//    <Html portal={labelRef}> 가 함께 씁니다. 이 줄을 지우면 장치 하나가 조용히 사라집니다.
//
// 🚨 「적용됨」을 함부로 적지 않습니다 — 아래 CommandTrail 주석을 꼭 읽으세요.
// ─────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleHelp,
  Maximize2,
  Minimize2,
  Plug,
  PlugZap,
  RotateCcw,
  ShieldAlert,
  Thermometer,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { TWIN, type Device, type RoomKind, type Spot } from "./team-twin";

/* ════════════════════════════════════════════════════════════
   토큰 — 9주차와 같은 `const UI` 객체입니다.
   `@theme` · `bg-base` · `text-ink` 같은 토큰은 우리 코드에 없습니다.
   ════════════════════════════════════════════════════════════ */

const UI = {
  page: "min-h-screen bg-slate-50 text-slate-900",
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

/* ★ 8주차 — 끊겼을 때 다시 시도하는 간격 */
const RETRY_MS = 3000;

/* ★ 11주차 — 보낸 뒤 이 시간 안에 센서 메시지가 또 오면 「연결은 살아 있다」 */
const ALIVE_MS = 2000;

/* ★ 11주차 — 보낸 뒤 이 시간 안에 applied 가 같은 값으로 돌아오면 「Pico 가 적용했다」 */
const ACK_MS = 4000;

/* 실물 Pico 가 `command.get("led_r", 0)` 으로 읽으므로, 한 키만 보내면
   나머지가 전부 0 으로 돌아갑니다. 늘 **묶음 전체**를 보냅니다. */
const BASE_ACTUATOR: Record<string, number> = {
  led_r: 0,
  led_g: 0,
  led_b: 0,
  servo_angle: 90,
};

type ConnectionStatus = "offline" | "connecting" | "online";
type SensorMap = Record<string, number | null>;
type AppliedMap = Record<string, number>;

type TrailItem = {
  id: number;
  key: string;
  label: string;
  value: number;
  at: number;
  sentOk: boolean;
  aliveAt: number | null; // ② 보낸 뒤 ALIVE_MS 안에 센서 메시지가 또 왔는가
  ackAt: number | null;   // ③ applied 가 같은 값으로 돌아왔는가
  appliedSeen: boolean;   // 보낸 뒤 applied 가 **오기는** 왔는가 (값은 달랐을 수 있음)
};

/* ════════════════════════════════════════════════════════════
   ★ 11주차 — 방 프리셋과 자리
   학생은 좌표를 쓰지 않습니다. `spot` 이름 여섯 개 중에서 고를 뿐입니다.
   ════════════════════════════════════════════════════════════ */

const SPOTS: Record<Spot, [number, number, number]> = {
  shelf: [-1.55, 1.05, -2.0],
  desk: [1.5, 0.95, -1.1],
  // 「벽」은 **뒷벽**입니다. 옆벽(x=-3)은 이 카메라에서 심하게 찌그러져 보여
  // 장치를 붙이면 거의 안 보입니다. 뒷벽은 화면에서 가장 넓은 면입니다.
  wall: [-0.95, 1.8, -2.85],
  ground: [0, 0.18, 0.5],
  corner: [-2.1, 0.3, 1.7],
  ceiling: [0, 2.45, -0.4],
};

/** 「산소 펌프 을(를)」처럼 쓰지 않습니다. 팀마다 장치 이름이 다르니
 *  **받침이 있는지 계산해서** 조사를 고릅니다.
 *  한글 음절은 U+AC00 부터 28개씩 묶여 있고, 그 안의 자리가 0 이면 받침이 없습니다.
 *  (한글이 아닌 이름이면 그냥 받침 없는 쪽으로 둡니다) */
function josa(word: string, withBatchim: string, without: string) {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return without;
  return (code - 0xac00) % 28 === 0 ? without : withBatchim;
}

type RoomPreset = {
  name: string;
  floor: string;
  wall: string;
  accent: string;
};

const ROOMS: Record<RoomKind, RoomPreset> = {
  farm: { name: "온실", floor: "#8d6e4f", wall: "#eef6ef", accent: "#16a34a" },
  home: { name: "집", floor: "#d8b486", wall: "#f8fafc", accent: "#0284c7" },
  factory: { name: "공장", floor: "#94a3b8", wall: "#e2e8f0", accent: "#f59e0b" },
  park: { name: "공원", floor: "#86b86a", wall: "#eff6ff", accent: "#0ea5e9" },
};

/* ════════════════════════════════════════════════════════════
   상태 판정 — 9주차 `getSensorStatus` 와 같은 규칙입니다.
   색만으로 알리지 않습니다. **색 + 아이콘 + 글자** 셋 다 바꿉니다.
   ════════════════════════════════════════════════════════════ */

type Level = "none" | "waiting" | "ok" | "warn" | "danger";

function sensorLevel(d: Device, value: number | null | undefined, sensor: SensorMap | null): Level {
  if (sensor === null) return "waiting";      // 아직 한 번도 못 받음
  if (value === null || value === undefined) return "none"; // 그 센서만 없음
  // 팀이 기준을 안 적었으면 늘 「정상」입니다 (지어내지 않습니다)
  //
  // ★ 두 숫자의 **방향**으로 「높을수록 나쁨 / 낮을수록 나쁨」을 읽습니다.
  //     토양수분  warn 30 · danger 15  → danger 가 더 작다 → **낮을수록** 나쁨
  //     온도      warn 30 · danger 35  → danger 가 더 크다 → **높을수록** 나쁨
  //   학생이 새 항목을 적지 않아도 되고, `/office` 폴백도 **같은 규칙**을 씁니다.
  //   (이 줄이 없으면 온도처럼 높을수록 나쁜 센서가 **늘 「위험」**으로 나옵니다 — 실측)
  const low = (d.danger ?? Infinity) < (d.warn ?? Infinity);
  if (d.danger !== undefined && (low ? value <= d.danger : value >= d.danger)) return "danger";
  if (d.warn !== undefined && (low ? value <= d.warn : value >= d.warn)) return "warn";
  return "ok";
}

const LEVEL_TEXT: Record<Level, string> = {
  none: "데이터 없음",
  waiting: "연결 대기",
  ok: "정상",
  warn: "주의",
  danger: "위험",
};

const LEVEL_CLASS: Record<Level, string> = {
  none: "bg-slate-100 text-slate-500 border-slate-200",
  waiting: "bg-slate-100 text-slate-500 border-slate-200",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
};

const LEVEL_3D: Record<Level, string> = {
  none: "#cbd5e1",
  waiting: "#cbd5e1",
  ok: "#10b981",
  warn: "#f59e0b",
  danger: "#f43f5e",
};

/* ════════════════════════════════════════════════════════════
   3D — 방
   외부 3D 모델을 하나도 쓰지 않습니다. 전부 기본 도형입니다.
   (라이선스 문제가 생길 여지를 아예 없앱니다)
   ════════════════════════════════════════════════════════════ */

function RoomShell({ room }: { room: RoomPreset }) {
  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color={room.floor} roughness={0.85} />
      </mesh>
      {/* 뒷벽 */}
      <mesh position={[0, 1.5, -3]} receiveShadow>
        <boxGeometry args={[6, 3, 0.1]} />
        <meshStandardMaterial color={room.wall} roughness={0.6} />
      </mesh>
      {/* 왼쪽 벽 — ★ 카메라가 [+x, +z](앞·오른쪽)에 있으므로 옆벽은 **왼쪽(-x)** 이어야
          합니다. 오른쪽(+3)에 두면 벽이 카메라와 방 사이를 가로막아 **방이 통째로
          회색 판때기로 가려집니다** (실측으로 확인한 결함). 뒷벽과 이 벽 둘만 세워
          「열린 모서리 방」을 만드는 것이 아이소메트릭의 기본 구성입니다. */}
      <mesh position={[-3, 1.5, 0]} receiveShadow>
        <boxGeometry args={[0.1, 3, 6]} />
        <meshStandardMaterial color={room.wall} roughness={0.6} />
      </mesh>
      {/* 창가 선반 */}
      <mesh position={[-1.55, 0.95, -2.0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.08, 0.5]} />
        <meshStandardMaterial color="#faf5ee" roughness={0.4} />
      </mesh>
      {/* 책상 */}
      <mesh position={[1.5, 0.85, -1.1]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.07, 0.8]} />
        <meshStandardMaterial color="#f5e6d3" roughness={0.45} />
      </mesh>
      {/* 바닥 화단 — 방 성격을 한눈에 */}
      <mesh position={[0, 0.08, 0.5]} receiveShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.16, 24]} />
        <meshStandardMaterial color={room.accent} roughness={0.8} />
      </mesh>
    </group>
  );
}

/* ════════════════════════════════════════════════════════════
   3D — 장치 하나
   값은 **3D 안의 텍스처가 아니라 진짜 글자(DOM)** 로 띄웁니다.
   그래야 1m 밖에서도 또렷하고, 화면 읽기 프로그램도 읽을 수 있습니다.
   ════════════════════════════════════════════════════════════ */

function SensorNode({
  device,
  value,
  level,
  stale,
  big,
  selected,
  onSelect,
  portal,
}: {
  device: Device;
  value: number | null | undefined;
  level: Level;
  stale: boolean;
  big: boolean;
  selected: boolean;
  onSelect: () => void;
  portal: RefObject<HTMLElement>;
}) {
  const pos = SPOTS[device.spot];
  const color = LEVEL_3D[level];
  const shown = value === null || value === undefined ? "—" : String(value);

  return (
    <group position={pos}>
      <mesh castShadow>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={level === "danger" ? 0.6 : 0.2}
          roughness={0.35}
        />
      </mesh>
      <Html center portal={portal} position={[0, 0.45, 0]} zIndexRange={[20, 0]}>
        <button
          type="button"
          onClick={onSelect}
          data-device={device.key}
          aria-label={`${device.label} — ${LEVEL_TEXT[level]}${
            value === null || value === undefined ? "" : ` ${value}${device.unit ?? ""}`
          }`}
          className={`pointer-events-auto flex w-max flex-col items-center gap-0.5 rounded-xl border px-2.5 py-1.5 text-center shadow-sm ${UI.focus} ${
            LEVEL_CLASS[level]
          } ${stale ? "opacity-60" : ""} ${selected ? "ring-2 ring-blue-500" : ""}`}
        >
          <span className="text-[11px] font-semibold leading-tight">{device.label}</span>
          {big && device.hero ? (
            <span data-hero-value className="text-4xl font-bold leading-none tabular-nums">
              {shown}
              <span className="ml-0.5 text-base font-semibold">{device.unit ?? ""}</span>
            </span>
          ) : (
            <span className="text-[10px] leading-tight">{LEVEL_TEXT[level]}</span>
          )}
        </button>
      </Html>
    </group>
  );
}

function ActuatorNode({
  device,
  on,
  pending,
  stale,
  hidden,
  selected,
  onSelect,
  portal,
}: {
  device: Device;
  on: boolean;
  pending: boolean;
  stale: boolean;
  hidden: boolean;
  selected: boolean;
  onSelect: () => void;
  portal: RefObject<HTMLElement>;
}) {
  const pos = SPOTS[device.spot];
  if (hidden) return null;
  const color = on ? "#f59e0b" : "#64748b";

  return (
    <group position={pos}>
      <mesh castShadow>
        <boxGeometry args={[0.32, 0.26, 0.32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={on ? 0.75 : 0.05}
          roughness={0.4}
        />
      </mesh>
      <Html center portal={portal} position={[0, 0.45, 0]} zIndexRange={[20, 0]}>
        <button
          type="button"
          onClick={onSelect}
          data-device={device.key}
          aria-label={`${device.label} — ${on ? "켜짐" : "꺼짐"}${pending ? ", 승인 기다리는 중" : ""}`}
          className={`pointer-events-auto flex w-max flex-col items-center gap-0.5 rounded-xl border px-2.5 py-1.5 text-center shadow-sm ${UI.focus} ${
            on
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-600"
          } ${stale ? "opacity-60" : ""} ${selected ? "ring-2 ring-blue-500" : ""}`}
        >
          <span className="text-[11px] font-semibold leading-tight">{device.label}</span>
          <span className="text-[10px] leading-tight">{on ? "켜짐" : "꺼짐"}</span>
        </button>
      </Html>
    </group>
  );
}

/* ════════════════════════════════════════════════════════════
   ★ 11주차 — 「이 명령이 실제로 간 길」
   ════════════════════════════════════════════════════════════

   관람객에게도 학생에게도 가장 많이 거짓말을 하게 되는 자리입니다.
   3D 는 버튼을 누르면 **그림이 바뀌니까** 「됐다」고 느끼게 만듭니다.
   그런데 그림이 바뀐 것과 펌프가 돈 것은 다릅니다.

   그래서 네 줄로 나눠 적습니다. 각 줄은 **화면이 정말 아는 것만** 체크합니다.

     ① 화면이 보냈다        readyState 가 OPEN 이고 send() 가 예외 없이 끝남
     ② 연결은 살아 있다      보낸 뒤 2초 안에 센서 메시지가 또 옴
     ③ Pico 가 받아서 적용했다  applied 가 같은 값으로 돌아옴   ← 11주차에 새로 생겼습니다
     ④ 실물이 실제로 움직였다   ❌ **끝까지 알 수 없습니다**

   ③ 은 10주차에서 Pico 가 적용값을 되돌려 보내게 고친 팀만 체크됩니다.
   안 고친 팀은 「아직 응답 없음」으로 남습니다 — 고장이 아닙니다.

   ④ 는 **어떤 상태로도 체크되지 않습니다.** applied 는 *Pico 안의 변수가
   바뀌었다*는 뜻이지 *펌프가 돌았다*는 뜻이 아닙니다. 선이 빠져 있어도,
   펌프가 고장 나 있어도 ③ 은 체크됩니다. ④ 를 확인하는 방법은 하나뿐입니다 —
   **눈과 귀로 직접 보는 것.** 이 줄을 지우거나 체크되게 고치지 마세요.
   ════════════════════════════════════════════════════════════ */

function CommandTrail({ trail, now }: { trail: TrailItem[]; now: number }) {
  if (trail.length === 0) {
    return <p className={UI.description}>아직 보낸 명령이 없습니다. 장치를 눌러 보세요.</p>;
  }
  return (
    <ul className="space-y-4">
      {trail.map((t) => {
        /* ③ 은 네 가지로 갈립니다. 「아직 기다리는 중」과 「끝내 안 왔다」는 다릅니다. */
        const waiting = t.sentOk && t.ackAt === null && now - t.at <= ACK_MS;
        return (
          <li key={t.id} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
                {t.label} → {t.value > 0 ? "켜기" : "끄기"}
              </span>
              <span className="text-xs tabular-nums text-slate-400">
                {new Date(t.at).toLocaleTimeString("ko-KR")}
              </span>
            </div>
            <ol className="space-y-1.5 text-xs">
              <Row done={t.sentOk} label="① 화면이 보냈다" />
              <Row done={t.aliveAt !== null} label="② 연결은 살아 있다" />

              {t.ackAt !== null ? (
                <Row done label="③ Pico 가 받아서 적용했다" />
              ) : waiting ? (
                <Row done={false} label="③ Pico 가 받아서 적용했다" />
              ) : t.appliedSeen ? (
                <li data-row-three className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    ③ Pico 가 받아서 적용했다 — <b>응답은 왔는데 값이 다릅니다.</b> 보낸 값과
                    되돌아온 값이 어긋납니다. Pico 쪽에서 그 키를 다른 이름으로 읽고 있지 않은지
                    보세요.
                  </span>
                </li>
              ) : (
                <li data-row-three className="flex items-start gap-2 text-slate-500">
                  <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    ③ Pico 가 받아서 적용했다 — <b>아직 응답 없음.</b> 이 Pico 는 적용값을
                    되돌려 보내지 않습니다 (<b>10주차</b>에서 고칩니다). <b>고장이 아닙니다.</b>
                  </span>
                </li>
              )}

              {/* ★ 이 줄은 어떤 상태로도 체크되지 않습니다. 하드코딩입니다. */}
              <li data-row-four className="flex items-start gap-2 text-slate-500">
                <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  ④ 실물이 실제로 움직였다 — <b>이 화면은 알 수 없습니다.</b> ③ 은{" "}
                  <i>Pico 안의 값이 바뀌었다</i>는 뜻이지 <i>장치가 돌았다</i>는 뜻이 아닙니다.
                  선이 빠져 있어도 ③ 은 체크됩니다. <b>눈과 귀로 확인하세요.</b>
                </span>
              </li>
            </ol>
          </li>
        );
      })}
    </ul>
  );
}

function Row({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
      ) : (
        <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      )}
      <span className={done ? "text-slate-700" : "text-slate-500"}>
        {label} {done ? "✓" : "— 아직"}
      </span>
    </li>
  );
}

/* ════════════════════════════════════════════════════════════
   페이지
   ════════════════════════════════════════════════════════════ */

export default function TwinPage() {
  const room = ROOMS[TWIN.room];
  const sensors = TWIN.devices.filter((d) => d.kind === "sensor");
  const actuators = TWIN.devices.filter((d) => d.kind === "actuator");

  const [picoIp, setPicoIp] = useState("127.0.0.1");
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [sensor, setSensor] = useState<SensorMap | null>(null);
  const [applied, setApplied] = useState<AppliedMap | null>(null);
  const [actuator, setActuator] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"detail" | "control" | "trail">("detail");
  const [pending, setPending] = useState<{ device: Device; value: number } | null>(null);
  const [trail, setTrail] = useState<TrailItem[]>([]);
  const [kiosk, setKiosk] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  /* ★ 11주차 — 모든 3D 라벨이 함께 쓰는 포털 그릇 (위 🚨 주석 참고) */
  const labelRef = useRef<HTMLElement>(null!);
  const trailId = useRef(0);

  /* ★ 8주차 — 자동 재연결에 필요한 ref 네 개 */
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantConnectedRef = useRef(false);
  const picoIpRef = useRef(picoIp);
  const statusRef = useRef<ConnectionStatus>("offline");
  const scheduleRetryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    picoIpRef.current = picoIp;
  }, [picoIp]);

  const setStatusBoth = useCallback((next: ConnectionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /* ★ 11주차 — WebGL 을 먼저 시험합니다. 안 되면 3D 를 아예 안 띄웁니다. */
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const gl =
        c.getContext("webgl2") ||
        c.getContext("webgl") ||
        c.getContext("experimental-webgl");
      setWebgl(Boolean(gl));
    } catch {
      setWebgl(false);
    }
  }, []);

  const openSocket = useCallback(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${picoIpRef.current}:5000/connect-websocket`);
    } catch {
      if (wantConnectedRef.current) scheduleRetryRef.current?.();
      return;
    }
    wsRef.current = ws;
    setStatusBoth("connecting");

    ws.onopen = () => setStatusBoth("online");

    ws.onmessage = (event) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      /* ★ 11주차 — applied 는 센서가 아닙니다. 떼어 내고 나머지만 센서로 둡니다. */
      const { applied: appliedRaw, ...rest } = data;
      setSensor(rest as SensorMap);

      const now = Date.now();
      if (appliedRaw && typeof appliedRaw === "object") {
        const ap = appliedRaw as AppliedMap;
        setApplied(ap);
        setTrail((prev) =>
          prev.map((t) => {
            if (!t.sentOk || now - t.at > ACK_MS) return t;
            const seen = true;
            const acked = t.ackAt === null && ap[t.key] === t.value ? now : t.ackAt;
            return t.appliedSeen === seen && t.ackAt === acked
              ? t
              : { ...t, appliedSeen: seen, ackAt: acked };
          }),
        );
      }

      /* ② 보낸 뒤 ALIVE_MS 안에 센서 메시지가 또 왔다 = 연결은 살아 있다 */
      setTrail((prev) =>
        prev.map((t) =>
          t.aliveAt === null && t.sentOk && now - t.at <= ALIVE_MS ? { ...t, aliveAt: now } : t,
        ),
      );
    };

    ws.onerror = () => {
      if (wantConnectedRef.current) scheduleRetryRef.current?.();
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (wantConnectedRef.current) {
        setStatusBoth("connecting");
        scheduleRetryRef.current?.();
      } else {
        setStatusBoth("offline");
      }
    };
  }, [setStatusBoth]);

  useEffect(() => {
    scheduleRetryRef.current = () => {
      if (!wantConnectedRef.current) return;
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(openSocket, RETRY_MS);
    };
  }, [openSocket]);

  const connect = () => {
    if (statusRef.current !== "offline") return;
    wantConnectedRef.current = true;
    openSocket();
  };

  const disconnect = () => {
    wantConnectedRef.current = false;
    if (retryRef.current) clearTimeout(retryRef.current);
    retryRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setStatusBoth("offline");
  };

  useEffect(
    () => () => {
      wantConnectedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    },
    [],
  );

  /* ★ 9주차 — 전시 모드. WakeLock · 전체화면 · 되돌아오기 */
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLockRef.current = await navigator.wakeLock?.request("screen");
    } catch {
      /* 브라우저가 막아도 전시는 계속되어야 합니다 */
    }
  }, []);

  useEffect(() => {
    if (!kiosk) return;
    requestWakeLock();
    const onVisible = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [kiosk, requestWakeLock]);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setKiosk(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleKiosk = async () => {
    if (kiosk) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setKiosk(false);
      return;
    }
    await document.documentElement.requestFullscreen?.().catch(() => {});
    setKiosk(true);
  };

  /* ★ 11주차 — 명령은 늘 묶음 전체로 보냅니다 */
  const sendAll = (next: Record<string, number>, device: Device, value: number) => {
    const ws = wsRef.current;
    let sentOk = false;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(next));
        sentOk = true;
      } catch {
        sentOk = false;
      }
    }
    if (sentOk) setActuator(next);
    trailId.current += 1;
    setTrail((prev) =>
      [
        {
          id: trailId.current,
          key: device.key,
          label: device.label,
          value,
          at: Date.now(),
          sentOk,
          aliveAt: null,
          ackAt: null,
          appliedSeen: false,
        },
        ...prev,
      ].slice(0, 6),
    );
  };

  const requestToggle = (device: Device) => {
    const on = (actuator[device.key] ?? 0) > 0;
    const value = on ? 0 : device.onValue ?? 255;
    /* 위험한 장치는 바로 안 보냅니다 — 먼저 묻습니다 */
    if (device.risk === "high" && value > 0) {
      setPending({ device, value });
      return;
    }
    sendAll({ ...BASE_ACTUATOR, ...actuator, [device.key]: value }, device, value);
  };

  const approvePending = () => {
    if (!pending) return;
    sendAll(
      { ...BASE_ACTUATOR, ...actuator, [pending.device.key]: pending.value },
      pending.device,
      pending.value,
    );
    setPending(null);
  };

  /* ★ 11주차 — ③행은 "아직 기다리는 중" 과 "끝내 안 왔다" 가 다릅니다.
     시간이 지나야 결론이 나므로 기록이 있는 동안만 1초마다 다시 그립니다. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (trail.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [trail.length]);

  const stale = status === "connecting" && sensor !== null;
  const selectedDevice = TWIN.devices.find((d) => d.key === selected) ?? null;
  /* 전시 모드에서는 위험한 장치를 아예 숨깁니다 (9주차 단계 J3) */
  const visibleActuators = actuators.filter((d) => !(kiosk && d.risk === "high"));

  /* ── WebGL 이 없을 때 ───────────────────────────────────── */
  if (webgl === false) {
    return (
      <main className={`${UI.page} flex items-center justify-center p-6`}>
        <div className={`${UI.card} ${UI.cardPadding} max-w-lg space-y-4 text-center`}>
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
          <h1 className={UI.sectionTitle}>이 컴퓨터에서는 3D 를 켤 수 없습니다</h1>
          <p className={UI.description}>
            그래픽 기능(WebGL)이 꺼져 있습니다. <b>작품이 고장 난 것이 아닙니다.</b>
            <br />
            아래 화면은 <b>3D 없이 똑같은 내용</b>을 보여 줍니다. 전시는 그대로 하세요.
          </p>
          <div className="flex justify-center gap-2">
            <a href="/office" className={`${UI.primaryButton} ${UI.focus}`}>
              <Boxes className="h-4 w-4" aria-hidden="true" /> 3D 없는 화면으로
            </a>
            <a href="/dashboard" className={`${UI.secondaryButton} ${UI.focus}`}>
              2D 로 돌아가기
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={UI.page}>
      {/* ── 머리줄 ─────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="text-base font-semibold">
            {TWIN.teamName}
            <span className="ml-2 text-sm font-normal text-slate-500">· {room.name}</span>
          </h1>

          <span
            data-status={status}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              status === "online"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : status === "connecting"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            {status === "online" ? (
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {status === "online" ? "ONLINE" : status === "connecting" ? "재연결 중" : "OFFLINE"}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!kiosk && (
              <>
                <label className="sr-only" htmlFor="pico-ip">
                  Pico IP 주소
                </label>
                <input
                  id="pico-ip"
                  value={picoIp}
                  onChange={(e) => setPicoIp(e.target.value)}
                  className={`w-36 rounded-xl border border-slate-300 px-3 py-2 text-sm ${UI.focus}`}
                  placeholder="192.168.0.51"
                />
                {status === "offline" ? (
                  <button type="button" onClick={connect} className={`${UI.primaryButton} ${UI.focus}`}>
                    <Plug className="h-4 w-4" aria-hidden="true" /> 연결
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={disconnect}
                    className={`${UI.secondaryButton} ${UI.focus}`}
                  >
                    <PlugZap className="h-4 w-4" aria-hidden="true" /> 끊기
                  </button>
                )}
                <a href="/office" className={`${UI.secondaryButton} ${UI.focus}`}>
                  3D 없는 화면
                </a>
                <a href="/dashboard" className={`${UI.secondaryButton} ${UI.focus}`}>
                  2D 로 돌아가기
                </a>
              </>
            )}
            <button type="button" onClick={toggleKiosk} className={`${UI.secondaryButton} ${UI.focus}`}>
              {kiosk ? (
                <>
                  <Minimize2 className="h-4 w-4" aria-hidden="true" /> 전시 모드 끄기
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" aria-hidden="true" /> 전시 모드
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`mx-auto grid max-w-[1400px] gap-4 p-4 ${
          kiosk ? "lg:grid-cols-1" : "lg:grid-cols-[260px_minmax(0,1fr)_340px]"
        }`}
      >
        {/* ── 왼쪽 · 장치 목록 ──────────────────────────────── */}
        {!kiosk && (
          <aside className={`${UI.card} ${UI.cardPadding} space-y-2`}>
            <h2 className={UI.cardTitle}>우리 팀 장치</h2>
            <ul className="space-y-1.5">
              {TWIN.devices.map((d) => {
                const lvl =
                  d.kind === "sensor" ? sensorLevel(d, sensor?.[d.key], sensor) : "ok";
                const on = (actuator[d.key] ?? 0) > 0;
                return (
                  <li key={d.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(d.key);
                        setTab("detail");
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm ${UI.focus} ${
                        selected === d.key
                          ? "border-blue-300 bg-blue-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {d.kind === "sensor" ? (
                          <Thermometer className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        ) : (
                          <Boxes className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        )}
                        <span className="font-medium">{d.label}</span>
                        {d.risk === "high" && (
                          <ShieldAlert className="h-3.5 w-3.5 text-rose-500" aria-label="위험한 장치" />
                        )}
                      </span>
                      <span className="text-xs text-slate-500">
                        {d.kind === "sensor" ? LEVEL_TEXT[lvl] : on ? "켜짐" : "꺼짐"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {/* ── 가운데 · 3D 방 ────────────────────────────────── */}
        {/* 높이를 화면에 맞춥니다. 460px 로 못박아 두면 전시용 노트북(보통 1080p)에서
            아래 40% 가 **빈 흰 공간**으로 남습니다. 좌우 패널은 그리드가 늘려 줍니다. */}
        <section
          className={`${UI.card} relative overflow-hidden`}
          style={{ minHeight: "min(72vh, 760px)" }}
        >
          <div
            ref={(el) => {
              labelRef.current = el as HTMLElement;
            }}
            className="pointer-events-none absolute inset-0 z-20"
            aria-live="off"
          />
          <div className="absolute inset-0">
            {webgl === null ? null : (
              <Canvas shadows camera={{ position: [4.6, 4.6, 5.3], fov: 40 }}>
                {/* ★ 조명은 **카메라 쪽**에서 비춰야 합니다. 반대편([-4,7,-4])에 두면
                    우리가 보는 면이 전부 그늘이라, 흰 벽(#eef6ef)도 **짙은 회색**으로
                    나옵니다. groundColor 도 너무 어두우면(#1e293b) 옆면을 끌어내립니다. */}
                {/* 그림자가 너무 진하면 바닥에 **구멍이 뚫린 것처럼** 보입니다.
                    주광을 낮추고 주변광을 올리면 그림자가 옅어집니다. */}
                <hemisphereLight intensity={1.2} groundColor="#cbd5e1" />
                <ambientLight intensity={1.15} />
                <directionalLight
                  position={[4, 9, 4]}
                  intensity={1.5}
                  castShadow
                  shadow-mapSize={[2048, 2048]}
                  shadow-camera-left={-6}
                  shadow-camera-right={6}
                  shadow-camera-top={6}
                  shadow-camera-bottom={-6}
                />
                <RoomShell room={room} />
                {sensors.map((d) => (
                  <SensorNode
                    key={d.key}
                    device={d}
                    value={sensor?.[d.key]}
                    level={sensorLevel(d, sensor?.[d.key], sensor)}
                    stale={stale}
                    big={kiosk}
                    portal={labelRef}
                    selected={selected === d.key}
                    onSelect={() => {
                      setSelected(d.key);
                      setTab("detail");
                    }}
                  />
                ))}
                {actuators.map((d) => (
                  <ActuatorNode
                    key={d.key}
                    device={d}
                    on={(applied?.[d.key] ?? actuator[d.key] ?? 0) > 0}
                    pending={pending?.device.key === d.key}
                    stale={stale}
                    hidden={kiosk && d.risk === "high"}
                    portal={labelRef}
                    selected={selected === d.key}
                    onSelect={() => {
                      setSelected(d.key);
                      setTab("control");
                    }}
                  />
                ))}
                <OrbitControls
                  enablePan={false}
                  /* 바닥(y=0)이 아니라 **사람 눈높이**를 봅니다. 원점을 보면 바닥이
                     화면 아래 2/3 를 먹고 장치가 작아집니다. */
                  target={[0, 0.9, 0]}
                  minPolarAngle={0.4}
                  maxPolarAngle={1.35}
                  minDistance={5}
                  maxDistance={13}
                />
              </Canvas>
            )}
          </div>

          {/* 승인 말풍선 — 위험한 장치는 먼저 묻습니다 */}
          {pending && (
            <div className="absolute inset-x-0 bottom-0 z-30 p-4">
              <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-white p-4 shadow-lg">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-500" aria-hidden="true" />
                  <b className="text-sm">
                    {pending.device.label}
                    {josa(pending.device.label, "을", "를")} 켤까요?
                  </b>
                </div>
                <p className={`${UI.description} mb-3`}>
                  물 · 열 · 움직임이 있는 장치입니다. <b>승인하기 전에는 아무것도 보내지 않습니다.</b>
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    className={`${UI.secondaryButton} ${UI.focus}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" /> 나중에
                  </button>
                  <button
                    type="button"
                    onClick={approvePending}
                    className={`${UI.primaryButton} ${UI.focus}`}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> 승인
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── 오른쪽 · 상세 / 제어 / 기록 ───────────────────── */}
        {!kiosk && (
          <aside className={`${UI.card} ${UI.cardPadding} space-y-4`}>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {(
                [
                  ["detail", "상세"],
                  ["control", "제어"],
                  ["trail", "기록"],
                ] as const
              ).map(([k, name]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${UI.focus} ${
                    tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {tab === "detail" && (
              <div className="space-y-3">
                {selectedDevice === null ? (
                  <p className={UI.description}>장치를 고르면 자세한 값이 나옵니다.</p>
                ) : selectedDevice.kind === "sensor" ? (
                  (() => {
                    const v = sensor?.[selectedDevice.key];
                    const lvl = sensorLevel(selectedDevice, v, sensor);
                    return (
                      <>
                        <h2 className={UI.sectionTitle}>{selectedDevice.label}</h2>
                        <p data-detail-value className="text-3xl font-bold tabular-nums">
                          {v === null || v === undefined ? "—" : v}
                          <span className="ml-1 text-base font-semibold text-slate-500">
                            {selectedDevice.unit ?? ""}
                          </span>
                        </p>
                        <p className={`inline-block rounded-lg border px-2 py-1 text-xs font-semibold ${LEVEL_CLASS[lvl]}`}>
                          {LEVEL_TEXT[lvl]}
                        </p>
                        <p className={UI.description}>
                          JSON 키 <code className="rounded bg-slate-100 px-1">{selectedDevice.key}</code>
                        </p>
                      </>
                    );
                  })()
                ) : (
                  <>
                    <h2 className={UI.sectionTitle}>{selectedDevice.label}</h2>
                    <p className={UI.description}>
                      JSON 키 <code className="rounded bg-slate-100 px-1">{selectedDevice.key}</code>
                      {selectedDevice.risk === "high" && (
                        <>
                          <br />
                          <b className="text-rose-600">위험한 장치</b> — 누르면 먼저 묻고,
                          전시 모드에서는 숨깁니다.
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>
            )}

            {tab === "control" && (
              <div className="space-y-2">
                {visibleActuators.length === 0 ? (
                  <p className={UI.description}>지금 만질 수 있는 장치가 없습니다.</p>
                ) : (
                  visibleActuators.map((d) => {
                    const on = (actuator[d.key] ?? 0) > 0;
                    return (
                      <div
                        key={d.key}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {d.label}
                          {d.risk === "high" && (
                            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" aria-label="위험한 장치" />
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => requestToggle(d)}
                          disabled={status !== "online"}
                          className={`${on ? UI.secondaryButton : UI.primaryButton} ${UI.focus}`}
                        >
                          {on ? "끄기" : "켜기"}
                        </button>
                      </div>
                    );
                  })
                )}
                <p className={UI.description}>
                  명령은 언제나 <b>묶음 전체</b>로 나갑니다. 한 키만 보내면 Pico 쪽에서
                  나머지가 0 으로 돌아갑니다.
                </p>
              </div>
            )}

            {tab === "trail" && (
              <div className="space-y-3">
                <h2 className={UI.sectionTitle}>이 명령이 실제로 간 길</h2>
                <CommandTrail trail={trail} now={now} />
              </div>
            )}
          </aside>
        )}
      </div>

      {kiosk && (
        <p className="pb-4 text-center text-xs text-slate-400">
          <RotateCcw className="mr-1 inline h-3 w-3" aria-hidden="true" />
          끌어서 돌려 보세요 · ESC 를 누르면 조작 화면으로 돌아갑니다
        </p>
      )}
    </main>
  );
}
