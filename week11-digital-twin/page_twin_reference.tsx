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

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import {
  Html,
  OrbitControls,
  RoundedBox,
  ContactShadows,
  Float,
} from "@react-three/drei";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Cpu,
  Droplets,
  Fan,
  Gauge,
  Lightbulb,
  Power,
  Sprout,
  Sun,
  Waves,
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
  /* ★ 다크 관제실 (ui-ux-pro-max · IoT 대시보드 권장: Glassmorphism + Dark).
     위쪽에 청록·남색 빛이 아주 옅게 번집니다. */
  page:
    "min-h-screen bg-[#0B1120] text-slate-100 " +
    "bg-[radial-gradient(900px_420px_at_18%_-6%,rgba(34,211,238,0.10),transparent_70%),radial-gradient(900px_480px_at_85%_-10%,rgba(99,102,241,0.12),transparent_70%)]",
  /* 패널은 **유리** — 반투명 + 흐림 + 머리카락 테두리 */
  card: "rounded-[14px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl",
  cardPadding: "p-5",
  sectionTitle: "text-lg font-semibold tracking-tight text-slate-50",
  cardTitle: "text-sm font-semibold tracking-tight text-slate-100",
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400",
  mono: "font-mono text-[11px] tracking-tight text-slate-400",
  /* 🚨 글자에 slate-500 이하를 쓰지 않습니다 — 이 배경에서 4.5:1 이 안 나옵니다 */
  description: "text-sm leading-6 text-slate-400",
  focus:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120]",
  /* 강조색은 **청록 하나** — 상태색(초록·호박·장미)과 섞이지 않게 */
  primaryButton:
    "inline-flex items-center justify-center gap-2 rounded-[10px] bg-cyan-400 px-4 py-2.5 " +
    "text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 " +
    "disabled:cursor-not-allowed disabled:opacity-40",
  secondaryButton:
    "inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/[0.12] " +
    "bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.08] " +
    "disabled:cursor-not-allowed disabled:opacity-40",
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

/* ★ 여섯 자리는 이제 **캐릭터가 서는 바닥 위 자리**입니다 (y = 0).
 *  이름은 그대로라 학생 설정(`spot: "desk"` 등)은 바꿀 것이 없습니다.
 *  좌표는 정사영 카메라에서 **이름표끼리 안 겹치게** 실측으로 잡았습니다 —
 *  옮길 때는 「여섯 자리 전부 쓰는 설정」으로 다시 확인하세요. */
const SPOTS: Record<Spot, [number, number, number]> = {
  shelf: [-1.75, 0, -2.0], //  뒤쪽 낮은 선반 앞
  desk: [1.6, 0, -0.65], //    오른쪽 책상 무리 앞 (벽 자리 캐릭터를 가리지 않게)
  wall: [0.25, 0, -2.15], //   뒷벽 화이트보드 앞
  ground: [-0.2, 0, 0.55], //  가운데 러그 위 — 주인공 자리로 좋습니다
  corner: [-2.05, 0, 1.95], // 앞쪽 왼편 구석
  ceiling: [2.0, 0, 1.55], //  앞쪽 오른편 — 천장 조명을 돌보는 자리
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

/* ★ 다크 관제실. 바닥은 방 성격에 맞춰 **아주 살짝만** 물들인 짙은 색,
   강조색(accent)은 러그와 발광선에 씁니다. */
const ROOMS: Record<RoomKind, RoomPreset> = {
  farm: { name: "온실", floor: "#14262B", wall: "#1A2436", accent: "#2DD4BF" },
  home: { name: "집", floor: "#1C2133", wall: "#1E2538", accent: "#60A5FA" },
  factory: { name: "공장", floor: "#1A202C", wall: "#1E2533", accent: "#FBBF24" },
  park: { name: "공원", floor: "#14281F", wall: "#1A2634", accent: "#4ADE80" },
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
  none: "bg-white/[0.05] text-slate-300 border-white/[0.12]",
  waiting: "bg-white/[0.05] text-slate-300 border-white/[0.12]",
  ok: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
  warn: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  danger: "bg-rose-500/15 text-rose-200 border-rose-400/40",
};

/* 추세선 색 (상태별) */
const LEVEL_LINE: Record<Level, string> = {
  none: "#64748B",
  waiting: "#64748B",
  ok: "#34D399",
  warn: "#FBBF24",
  danger: "#FB7185",
};

/* ★ 장치마다 **다른 아이콘** (lucide 한 계열만).
 *  전부 온도계면 목록이 「자리표시자」처럼 보입니다.
 *  🚨 `office/page.tsx` 의 iconFor 와 **같아야** 합니다 (두 화면은 형제). */
const DEVICE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  temperature: Thermometer, humidity: Droplets, light_percent: Sun,
  cpu_temp: Cpu, soil: Sprout, pump: Waves,
  led_r: Lightbulb, led_g: Lightbulb, led_b: Lightbulb,
};
function iconFor(d: Device): ComponentType<{ className?: string }> {
  const k = d.key.toLowerCase();
  if (DEVICE_ICON[k]) return DEVICE_ICON[k];
  if (/water|level|humid|moist|rain/.test(k)) return Droplets;
  if (/soil/.test(k)) return Sprout;
  if (/temp/.test(k)) return Thermometer;
  if (/led|lamp/.test(k)) return Lightbulb;
  if (/light|lux/.test(k)) return d.kind === "actuator" ? Lightbulb : Sun;
  if (/fan/.test(k)) return Fan;
  if (/pump|motor|valve/.test(k)) return Waves;
  if (/cpu/.test(k)) return Cpu;
  return d.kind === "actuator" ? Power : Gauge;
}

/* ★ 추세선 (스파크라인) — 라이브러리 없이 SVG 한 장.
 *  실시간 모니터링 화면의 기본입니다. 숫자 하나만으로는 「오르는 중인지」가 안 보입니다. */
function Spark({
  data,
  color,
  w = 64,
  h = 20,
  warn,
  danger,
  labels = false,
}: {
  data: number[];
  color: string;
  w?: number;
  h?: number;
  warn?: number;
  danger?: number;
  labels?: boolean;
}) {
  const gid = useId();
  if (data.length < 2) {
    return (
      <svg width={w} height={h} aria-hidden="true" className="shrink-0">
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#64748B" strokeOpacity="0.5" strokeDasharray="2 3" />
      </svg>
    );
  }
  /* 기준선이 화면 안에 들어오게 범위에 포함합니다 */
  const extra = [warn, danger].filter((x): x is number => x !== undefined && labels);
  let lo = Math.min(...data, ...extra);
  let hi = Math.max(...data, ...extra);
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h;
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {labels &&
        ([
          ["주의", warn, "#FBBF24"],
          ["위험", danger, "#FB7185"],
        ] as const).map(([name, v, c]) =>
          v === undefined ? null : (
            <g key={name}>
              <line x1="0" x2={w} y1={y(v)} y2={y(v)} stroke={c} strokeOpacity="0.55" strokeDasharray="3 3" />
              <text x={w} y={y(v) - 3} textAnchor="end" fontSize="10" fill={c} fillOpacity="0.9">
                {name} {v}
              </text>
            </g>
          ),
        )}
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(last)} r="2.4" fill={color} />
    </svg>
  );
}

/* 3D 쪽은 **클레이 파스텔**입니다. 화면 글자(LEVEL_CLASS)는 또렷한 색을 쓰지만,
   입체물은 채도를 낮춰야 점토처럼 보입니다 — 형광색은 플라스틱처럼 보입니다. */
const LEVEL_3D: Record<Level, string> = {
  none: "#CFD4DC",
  waiting: "#CFD4DC",
  ok: "#4FC48D",
  warn: "#F2B33D",
  danger: "#F2607A",
};

/* ★ 장치마다 **자기 색**을 줍니다.
 *
 *  전부 상태색(정상=초록)으로 칠하면 평소에 **온 방이 초록 한 가지**가 되어
 *  어느 덩어리가 어느 장치인지 눈으로 구분이 안 됩니다 (실측으로 확인).
 *  그래서 평소에는 고유색, **주의·위험일 때만 상태색으로 덮습니다.**
 *  상태는 라벨 글자(「정상」·「위험」)로도 읽히므로 색만으로 판단하지 않아도 됩니다. */
const CLAY = ["#7FC8E8", "#F2A3B3", "#F2CE7A", "#A7B6F2", "#8FD9B6", "#F2B289"];

/* 고유색을 흰색 쪽으로 섞습니다 — 몸통은 머리카락보다 옅어야 점토 인형처럼 보입니다 */
function mix(hex: string, to: string, t: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = (v: number, sh: number) => (v >> sh) & 255;
  const m = (sh: number) => Math.round(ch(a, sh) + (ch(b, sh) - ch(a, sh)) * t);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, "0")}`;
}

/* ════════════════════════════════════════════════════════════
   3D — 방
   외부 3D 모델을 하나도 쓰지 않습니다. 전부 기본 도형입니다.
   (라이선스 문제가 생길 여지를 아예 없앱니다)
   ════════════════════════════════════════════════════════════ */

/* 🐞 재질은 전부 meshLambertMaterial 입니다. meshStandardMaterial(물리 기반)은 픽셀마다
   계산이 훨씬 무거워, 캐릭터·소품이 늘어난 지금 프레임이 목표(12fps, GPU 없는 환경)
   아래로 떨어졌습니다. 바꿔 보니 **그림은 사실상 같고 11.2 → 14.2fps** 였습니다.
   roughness · metalness 를 다시 쓰자고 하지 마세요. */
function RoomShell({ room }: { room: RoomPreset }) {
  const WALL_H = 1.1;
  const GLOW = "#22D3EE";

  return (
    <group>
      {/* 떠 있는 단 + **청록 발광 테두리선** — 「떠 있는 디지털 모형」 */}
      <RoundedBox args={[6.7, 0.44, 6.7]} radius={0.2} smoothness={2} position={[0, -0.24, 0]}>
        <meshLambertMaterial color="#121A2B" />
      </RoundedBox>
      {[
        { p: [0, 0.006, 3.32], a: [6.64, 0.012, 0.03] },
        { p: [0, 0.006, -3.32], a: [6.64, 0.012, 0.03] },
        { p: [3.32, 0.006, 0], a: [0.03, 0.012, 6.64] },
        { p: [-3.32, 0.006, 0], a: [0.03, 0.012, 6.64] },
      ].map((e, k) => (
        <mesh key={k} position={e.p as [number, number, number]}>
          <boxGeometry args={e.a as [number, number, number]} />
          <meshLambertMaterial color={GLOW} emissive={GLOW} emissiveIntensity={1.4} />
        </mesh>
      ))}

      {/* 바닥 + 가는 격자 (three 코어 gridHelper — 새 라이브러리 아님) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshLambertMaterial color={room.floor} />
      </mesh>
      <gridHelper args={[6, 12, "#24485A", "#1B3240"]} position={[0, 0.007, 0]} />

      {/* 가운데 러그 — 주인공 자리 */}
      <mesh position={[-0.2, 0.012, 0.55]}>
        <cylinderGeometry args={[1.3, 1.3, 0.02, 48]} />
        <meshLambertMaterial color={mix(room.accent, "#0B1120", 0.78)} />
      </mesh>
      <mesh position={[-0.2, 0.024, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.26, 1.3, 64]} />
        <meshBasicMaterial color={room.accent} transparent opacity={0.45} />
      </mesh>

      {/* 낮은 반벽 + 위 모서리 발광 띠 */}
      <RoundedBox args={[6, WALL_H, 0.14]} radius={0.04} smoothness={2} position={[0, WALL_H / 2, -3]}>
        <meshLambertMaterial color={room.wall} />
      </RoundedBox>
      <RoundedBox args={[0.14, WALL_H, 6]} radius={0.04} smoothness={2} position={[-3, WALL_H / 2, 0]}>
        <meshLambertMaterial color={room.wall} />
      </RoundedBox>
      <mesh position={[0, WALL_H + 0.01, -3]}>
        <boxGeometry args={[6, 0.02, 0.16]} />
        <meshLambertMaterial color={GLOW} emissive={GLOW} emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[-3, WALL_H + 0.01, 0]}>
        <boxGeometry args={[0.16, 0.02, 6]} />
        <meshLambertMaterial color={GLOW} emissive={GLOW} emissiveIntensity={0.9} />
      </mesh>

      {/* 벽면 디스플레이 — 발광 화면 + 막대 */}
      <group position={[0.55, 0, -2.72]}>
        <RoundedBox args={[1.58, 0.93, 0.05]} radius={0.03} smoothness={2} position={[0, 1.15, -0.03]}>
          <meshLambertMaterial color="#2A3448" />
        </RoundedBox>
        <mesh position={[0, 1.15, 0.0]}>
          <boxGeometry args={[1.46, 0.81, 0.01]} />
          <meshLambertMaterial color="#0A1322" emissive="#0E7490" emissiveIntensity={0.25} />
        </mesh>
        {[0.22, 0.38, 0.3, 0.5, 0.42].map((h, k) => (
          <mesh key={k} position={[-0.5 + k * 0.25, 0.86 + h / 2, 0.012]}>
            <boxGeometry args={[0.13, h, 0.01]} />
            <meshLambertMaterial color={CLAY[k % CLAY.length]} emissive={CLAY[k % CLAY.length]} emissiveIntensity={0.85} />
          </mesh>
        ))}
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} position={[x, 0.36, 0.02]}>
            <cylinderGeometry args={[0.025, 0.025, 0.72, 8]} />
            <meshLambertMaterial color="#3A4660" />
          </mesh>
        ))}
      </group>

      {/* 뒤쪽 낮은 선반 + 책 */}
      <RoundedBox args={[1.4, 0.56, 0.36]} radius={0.04} smoothness={2} position={[-1.85, 0.28, -2.72]}>
        <meshLambertMaterial color="#263046" />
      </RoundedBox>
      {[
        { x: -2.3, h: 0.24, c: "#F2A3B3" },
        { x: -2.18, h: 0.3, c: "#7FC8E8" },
        { x: -2.06, h: 0.2, c: "#F2CE7A" },
      ].map((b) => (
        <mesh key={b.x} position={[b.x, 0.56 + b.h / 2, -2.72]}>
          <boxGeometry args={[0.09, b.h, 0.26]} />
          <meshLambertMaterial color={b.c} />
        </mesh>
      ))}

      {/* 오른쪽 뒤 책상 무리 — 모니터 화면이 빛납니다 */}
      <RoundedBox args={[1.5, 0.08, 0.75]} radius={0.03} smoothness={2} position={[2.0, 0.62, -2.35]}>
        <meshLambertMaterial color="#2B3650" />
      </RoundedBox>
      {[1.35, 2.65].map((x) => (
        <mesh key={x} position={[x, 0.3, -2.35]}>
          <boxGeometry args={[0.06, 0.6, 0.65]} />
          <meshLambertMaterial color="#222B3F" />
        </mesh>
      ))}
      {[1.65, 2.35].map((x) => (
        <group key={x}>
          <RoundedBox args={[0.5, 0.32, 0.04]} radius={0.02} smoothness={2} position={[x, 0.86, -2.5]}>
            <meshLambertMaterial color="#0F1623" />
          </RoundedBox>
          <mesh position={[x, 0.86, -2.475]}>
            <boxGeometry args={[0.44, 0.26, 0.005]} />
            <meshLambertMaterial color="#67E8F9" emissive="#22D3EE" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[x, 0.68, -2.5]}>
            <boxGeometry args={[0.16, 0.04, 0.12]} />
            <meshLambertMaterial color="#0F1623" />
          </mesh>
          <RoundedBox args={[0.38, 0.07, 0.38]} radius={0.04} smoothness={2} position={[x, 0.42, -1.85]}>
            <meshLambertMaterial color="#334063" />
          </RoundedBox>
          <RoundedBox args={[0.38, 0.36, 0.07]} radius={0.04} smoothness={2} position={[x, 0.62, -1.68]}>
            <meshLambertMaterial color="#334063" />
          </RoundedBox>
          <mesh position={[x, 0.2, -1.85]}>
            <cylinderGeometry args={[0.04, 0.12, 0.4, 10]} />
            <meshLambertMaterial color="#1E2738" />
          </mesh>
        </group>
      ))}

      {/* 왼쪽 벽 소파 */}
      <group position={[-2.45, 0, -0.25]}>
        <RoundedBox args={[0.75, 0.26, 1.6]} radius={0.08} smoothness={2} position={[0, 0.2, 0]}>
          <meshLambertMaterial color="#2E3A55" />
        </RoundedBox>
        <RoundedBox args={[0.22, 0.5, 1.6]} radius={0.08} smoothness={2} position={[-0.3, 0.42, 0]}>
          <meshLambertMaterial color="#28334C" />
        </RoundedBox>
        {[-0.74, 0.74].map((z) => (
          <RoundedBox key={z} args={[0.75, 0.36, 0.16]} radius={0.06} smoothness={2} position={[0, 0.27, z]}>
            <meshLambertMaterial color="#28334C" />
          </RoundedBox>
        ))}
        <RoundedBox args={[0.3, 0.3, 0.3]} radius={0.08} smoothness={2} position={[0.05, 0.45, 0.25]}>
          <meshLambertMaterial color="#F2B289" />
        </RoundedBox>
      </group>

      {/* 화분 셋 — 다크 장면의 유일한 자연색 */}
      {[
        { p: [-2.55, 0, 1.0], s: 0.9 },
        { p: [2.55, 0, 2.55], s: 0.8 },
      ].map((pl, k) => (
        <group key={k} position={pl.p as [number, number, number]} scale={pl.s}>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.2, 0.15, 0.34, 18]} />
            <meshLambertMaterial color="#2A3448" />
          </mesh>
          {[
            { p: [0, 0.55, 0], r: 0.22 },
            { p: [0.14, 0.45, 0.08], r: 0.15 },
            { p: [-0.13, 0.47, -0.06], r: 0.14 },
            { p: [0.02, 0.76, 0.02], r: 0.13 },
          ].map((l, m) => (
            <mesh key={m} position={l.p as [number, number, number]}>
              <sphereGeometry args={[l.r, 14, 12]} />
              <meshLambertMaterial color={m % 2 ? "#43B884" : "#2F9E6B"} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ════════════════════════════════════════════════════════════
   3D — 장치 하나
   값은 **3D 안의 텍스처가 아니라 진짜 글자(DOM)** 로 띄웁니다.
   그래야 1m 밖에서도 또렷하고, 화면 읽기 프로그램도 읽을 수 있습니다.
   ════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   3D — 장치를 돌보는 **디자이너 토이** 캐릭터
   ════════════════════════════════════════════════════════════

   장치 하나마다 캐릭터 하나. 큰 머리 · 짧은 팔다리 · 볼터치.
   **장치마다 머리 모양이 다릅니다**(6가지) — 색만이 아니라 실루엣으로도 구분됩니다.

     머리카락·옷   = 누구인지 (CLAY 고유색)
     발밑 고리     = 지금 상태 (색 + 맥박 빠르기) — 위험이면 빨리 뜁니다
     머리 위 구슬  = 주의(호박) · 위험(장미)
     연결 대기     = 캐릭터가 회색으로 가라앉습니다
     켜진 액추에이터 = 한 팔을 들고 일합니다

   기본 도형만 씁니다. 움직임 줄이기 설정이면 전부 멈춥니다.
   ════════════════════════════════════════════════════════════ */

const SKIN = "#F6D2B8";

/* 캐릭터 크기 배율. 이름표·말풍선 높이가 여기에 맞춰져 있습니다 */
const CHAR = 1.3;

/* 머리 모양 여섯 가지. 색(CLAY)과 함께 **전체 장치 순번**으로 고릅니다.
   자리가 최대 여섯이므로 이렇게 하면 캐릭터가 **절대 겹치지 않습니다**.
   (예전에는 센서끼리 순번 · 액추에이터는 순번+3 이라, 센서가 넷 이상이면
   센서 하나와 액추에이터 하나가 머리·색까지 똑같은 쌍둥이가 됐습니다 — 실측) */
const HAIR = ["bob", "bun", "cap", "headset", "beanie", "long"] as const;
type HairStyle = (typeof HAIR)[number];

/* 이름표의 상태 점 색 */
const DOT: Record<Level, string> = {
  none: "#94A3B8",
  waiting: "#94A3B8",
  ok: "#4ADE80",
  warn: "#FBBF24",
  danger: "#FFFFFF",
};

/* 발밑 상태 고리의 맥박 빠르기 (1초에 몇 번) — 위험할수록 빨리 */
const PULSE: Record<Level, number> = { none: 0, waiting: 0, ok: 0.45, warn: 1.0, danger: 1.8 };

/* 움직임 줄이기 설정을 따릅니다 (멀미·집중 방해 방지 — 접근성) */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/* ★ 발밑 상태 고리 — ui-ux-pro-max 의 IoT 권장 효과 「Device status pulse」 */
function StatusRing({ color, speed, calm }: { color: string; speed: number; calm: boolean }) {
  const wave = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const m = wave.current;
    if (!m) return;
    if (calm || speed === 0) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const t = (clock.elapsedTime * speed) % 1;
    m.scale.setScalar(1 + t * 0.7);
    (m.material as MeshBasicMaterial).opacity = 0.5 * (1 - t);
  });
  return (
    <group position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.4, 0.46, 32]} />
        <meshBasicMaterial color={color} transparent opacity={speed === 0 ? 0.35 : 0.9} depthWrite={false} />
      </mesh>
      <mesh ref={wave}>
        <ringGeometry args={[0.46, 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Hair({ style, color }: { style: HairStyle; color: string }) {
  const cap = (
    <mesh position={[0, 0.02, -0.01]} scale={[1.06, 1, 1.06]}>
      <sphereGeometry args={[0.225, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      <meshLambertMaterial color={style === "headset" ? "#3B2F35" : color} />
    </mesh>
  );
  switch (style) {
    case "bob":
      return (
        <group>
          {cap}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.17, -0.07, -0.03]}>
              <sphereGeometry args={[0.1, 14, 12]} />
              <meshLambertMaterial color={color} />
            </mesh>
          ))}
        </group>
      );
    case "bun":
      return (
        <group>
          {cap}
          <mesh position={[0, 0.24, -0.05]}>
            <sphereGeometry args={[0.09, 14, 12]} />
            <meshLambertMaterial color={color} />
          </mesh>
        </group>
      );
    case "cap":
      return (
        <group>
          {cap}
          <mesh position={[0, 0.1, 0.19]} rotation={[-0.25, 0, 0]}>
            <boxGeometry args={[0.26, 0.025, 0.16]} />
            <meshLambertMaterial color={mix(color, "#0B1120", 0.25)} />
          </mesh>
        </group>
      );
    case "headset":
      return (
        <group>
          {cap}
          <mesh position={[0, 0.02, 0]}>
            <torusGeometry args={[0.245, 0.022, 8, 28, Math.PI]} />
            <meshLambertMaterial color={color} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.245, 0.0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.065, 0.065, 0.06, 16]} />
              <meshLambertMaterial color={color} />
            </mesh>
          ))}
        </group>
      );
    case "beanie":
      return (
        <group>
          <mesh position={[0, 0.03, -0.01]} scale={[1.07, 1.18, 1.07]}>
            <sphereGeometry args={[0.225, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.055, 12, 10]} />
            <meshLambertMaterial color="#F1F5F9" />
          </mesh>
        </group>
      );
    case "long":
      return (
        <group>
          {cap}
          <RoundedBox args={[0.4, 0.34, 0.12]} radius={0.05} smoothness={2} position={[0, -0.13, -0.14]}>
            <meshLambertMaterial color={color} />
          </RoundedBox>
        </group>
      );
  }
}

function Toy({
  tint,
  hair,
  seed,
  mood,
  working,
  hero,
  calm,
  children,
}: {
  tint: string;
  hair: HairStyle;
  seed: number;
  mood: Level;
  working: boolean;
  hero: boolean;
  calm: boolean;
  children: React.ReactNode;
}) {
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const orb = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (calm) return;
    const t = clock.elapsedTime + seed;
    /* 숨쉬기 — 일할 때는 조금 더 크게 */
    if (body.current) body.current.scale.y = 1 + Math.sin(t * 2.1) * (working ? 0.045 : 0.022);
    if (head.current) {
      head.current.rotation.z = Math.sin(t * 0.8) * 0.06;
      /* 위험하면 고개를 짧게 젓습니다 */
      head.current.rotation.y = mood === "danger" ? Math.sin(t * 13) * 0.1 : Math.sin(t * 0.5) * 0.12;
    }
    if (orb.current) orb.current.position.y = 1.02 + Math.sin(t * 3) * 0.03;
  });

  const waiting = mood === "waiting" || mood === "none";
  const hairC = waiting ? "#64748B" : tint;
  const skin = waiting ? "#A3A8B4" : SKIN;
  const outfit = waiting ? "#475569" : mix(tint, "#FFFFFF", 0.18);
  const pants = waiting ? "#334155" : "#2B3550";
  const orbColor = mood === "danger" ? "#FB7185" : mood === "warn" ? "#FBBF24" : null;

  return (
    <Float enabled={hero && !calm} speed={1.1} rotationIntensity={0.06} floatIntensity={0.16} floatingRange={[0, 0.04]}>
      {/* 카메라가 [+x, +z] 쪽이므로 45° 돌려 관람객을 보게 합니다 */}
      <group rotation={[0, Math.PI / 4, 0]} scale={CHAR}>
        {/* 다리 */}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.065, 0.09, 0]}>
            <capsuleGeometry args={[0.05, 0.08, 2, 8]} />
            <meshLambertMaterial color={pants} />
          </mesh>
        ))}
        <group ref={body}>
          {/* 몸통 */}
          <mesh position={[0, 0.29, 0]}>
            <capsuleGeometry args={[0.13, 0.12, 3, 10]} />
            <meshLambertMaterial color={outfit} />
          </mesh>
          {/* 팔 — 일할 때는 오른팔을 듭니다 */}
          <mesh position={[-0.17, 0.3, 0]} rotation={[0, 0, 0.3]}>
            <capsuleGeometry args={[0.042, 0.12, 2, 8]} />
            <meshLambertMaterial color={outfit} />
          </mesh>
          <mesh position={working ? [0.19, 0.42, 0] : [0.17, 0.3, 0]} rotation={[0, 0, working ? -2.5 : -0.3]}>
            <capsuleGeometry args={[0.042, 0.12, 2, 8]} />
            <meshLambertMaterial color={outfit} />
          </mesh>
        </group>
        {/* 머리 — 큰 머리가 토이 비율의 핵심입니다 */}
        <group ref={head} position={[0, 0.63, 0]}>
          <mesh scale={[1, 0.93, 1]}>
            <sphereGeometry args={[0.22, 18, 14]} />
            <meshLambertMaterial color={skin} />
          </mesh>
          {/* 눈 + 반짝임 */}
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * 0.075, 0.0, 0.198]}>
              <mesh scale={[1, 1.25, 0.6]}>
                <sphereGeometry args={[0.028, 10, 8]} />
                <meshLambertMaterial color="#1E1B24" />
              </mesh>
              <mesh position={[0.01, 0.012, 0.015]}>
                <sphereGeometry args={[0.009, 6, 6]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
            </group>
          ))}
          {/* 볼터치 */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.125, -0.06, 0.165]} scale={[1, 0.6, 0.4]}>
              <sphereGeometry args={[0.032, 10, 8]} />
              <meshLambertMaterial color="#F59AAE" />
            </mesh>
          ))}
          {/* 입 */}
          <mesh position={[0, -0.075, 0.2]} scale={[1.4, mood === "danger" ? 1.2 : 0.5, 0.5]}>
            <sphereGeometry args={[0.016, 8, 6]} />
            <meshLambertMaterial color="#7A3A46" />
          </mesh>
          <Hair style={hair} color={hairC} />
        </group>
        {/* 머리 위 상태 구슬 — 주의·위험일 때만 */}
        {orbColor && (
          <mesh ref={orb} position={[0, 1.02, 0]}>
            <sphereGeometry args={[0.055, 14, 12]} />
            <meshLambertMaterial color={orbColor} emissive={orbColor} emissiveIntensity={1.2} />
          </mesh>
        )}
        {/* 돌보는 장치 — 캐릭터 오른편 */}
        <group position={[0.4, 0, 0.02]}>{children}</group>
      </group>
    </Float>
  );
}

/* 이름표 — 머리 위 유리 알약. **값**을 보여 줍니다 */
function NameTag({
  portal,
  deviceKey,
  ariaLabel,
  onSelect,
  danger,
  ring,
  stale,
  children,
}: {
  portal: RefObject<HTMLElement>;
  deviceKey: string;
  ariaLabel: string;
  onSelect: () => void;
  danger: boolean;
  ring: "" | "selected" | "pending";
  stale: boolean;
  children: React.ReactNode;
}) {
  return (
    <Html center portal={portal} position={[0, 1.12 * CHAR, 0]} zIndexRange={[20, 0]}>
      <button
        type="button"
        onClick={onSelect}
        data-device={deviceKey}
        aria-label={ariaLabel}
        className={`pointer-events-auto inline-flex w-max items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)] backdrop-blur-md transition-colors ${UI.focus} ${
          danger ? "border-rose-300/50 bg-rose-600/90" : "border-white/[0.12] bg-slate-950/70 hover:bg-slate-900/90"
        } ${stale ? "opacity-60" : ""} ${
          ring === "pending"
            ? "ring-2 ring-rose-400 ring-offset-2 ring-offset-[#0B1120]"
            : ring === "selected"
              ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#0B1120]"
              : ""
        }`}
      >
        {children}
      </button>
    </Html>
  );
}

function SensorNode({
  device,
  value,
  level,
  stale,
  big,
  selected,
  onSelect,
  portal,
  index,
  calm,
}: {
  device: Device;
  value: number | null | undefined;
  level: Level;
  stale: boolean;
  big: boolean;
  selected: boolean;
  onSelect: () => void;
  portal: RefObject<HTMLElement>;
  index: number;
  calm: boolean;
}) {
  const pos = SPOTS[device.spot];
  const bulb = LEVEL_3D[level];
  const has = value !== null && value !== undefined;
  const shown = has ? String(value) : "—";
  const aria = `${device.label} — ${LEVEL_TEXT[level]}${has ? ` ${value}${device.unit ?? ""}` : ""}`;

  return (
    <group position={pos}>
      <StatusRing color={LEVEL_3D[level]} speed={PULSE[level]} calm={calm} />
      <Toy
        tint={CLAY[index % CLAY.length]}
        hair={HAIR[index % HAIR.length]}
        seed={index * 1.7}
        mood={level}
        working={false}
        hero={device.hero === true}
        calm={calm}
      >
        {/* 센서 기둥 + 전구 — 전구 색이 상태입니다 */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.1, 0.11, 0.04, 16]} />
          <meshLambertMaterial color="#2A3448" />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
          <meshLambertMaterial color="#64748B" />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshLambertMaterial
            color={bulb}
            emissive={bulb}
            emissiveIntensity={level === "danger" ? 1.6 : level === "warn" ? 1.0 : level === "ok" ? 0.7 : 0.1}
          />
        </mesh>
      </Toy>

      {big && device.hero ? (
        /* 전시 모드의 주인공은 **큰 값 카드** — 멀리서 숫자가 읽혀야 합니다 */
        <Html center portal={portal} position={[0, 1.4 * CHAR, 0]} zIndexRange={[20, 0]}>
          <button
            type="button"
            onClick={onSelect}
            data-device={device.key}
            aria-label={aria}
            className={`pointer-events-auto flex w-max flex-col items-center gap-0.5 rounded-[14px] border bg-slate-950/80 px-4 py-2 text-center shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md ${UI.focus} ${
              LEVEL_CLASS[level]
            } ${stale ? "opacity-60" : ""}`}
          >
            <span className="text-xs font-semibold leading-tight">{device.label}</span>
            <span data-hero-value className="text-4xl font-semibold leading-none tracking-tight tabular-nums">
              {shown}
              <span className="ml-0.5 text-base font-medium">{device.unit ?? ""}</span>
            </span>
          </button>
        </Html>
      ) : (
        <NameTag
          portal={portal}
          deviceKey={device.key}
          ariaLabel={aria}
          onSelect={onSelect}
          danger={level === "danger"}
          ring={selected ? "selected" : ""}
          stale={stale}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: DOT[level] }} />
          {device.label}
          {/* ★ 값을 보여 줍니다. 「정상」만 보이면 디지털 트윈이 아닙니다 */}
          <span className="font-medium tabular-nums text-white/85">
            {has ? `${value}${device.unit ?? ""}` : "—"}
          </span>
          {level !== "ok" && <span className="font-normal text-white/70">{LEVEL_TEXT[level]}</span>}
        </NameTag>
      )}
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
  index,
  calm,
}: {
  device: Device;
  on: boolean;
  pending: boolean;
  stale: boolean;
  hidden: boolean;
  selected: boolean;
  onSelect: () => void;
  portal: RefObject<HTMLElement>;
  index: number;
  calm: boolean;
}) {
  const pos = SPOTS[device.spot];
  if (hidden) return null;
  const tint = CLAY[index % CLAY.length];
  const box = on ? "#F2B33D" : "#334155";

  return (
    <group position={pos}>
      <StatusRing color={on ? "#FBBF24" : "#64748B"} speed={on ? 0.8 : 0} calm={calm} />
      <Toy
        tint={tint}
        hair={HAIR[index % HAIR.length]}
        seed={index * 2.3 + 0.9}
        mood="ok"
        working={on}
        hero={false}
        calm={calm}
      >
        <RoundedBox args={[0.3, 0.26, 0.3]} radius={0.06} smoothness={2} position={[0, 0.13, 0]}>
          <meshLambertMaterial
            color={box}
            emissive={on ? box : "#000000"}
            emissiveIntensity={on ? 0.8 : 0}
          />
        </RoundedBox>
        <mesh position={[0, 0.28, 0]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshLambertMaterial
            color={on ? "#FFF3C4" : "#64748B"}
            emissive={on ? "#FFD666" : "#000000"}
            emissiveIntensity={on ? 1.5 : 0}
          />
        </mesh>
      </Toy>

      <NameTag
        portal={portal}
        deviceKey={device.key}
        ariaLabel={`${device.label} — ${on ? "켜짐" : "꺼짐"}${pending ? ", 승인 기다리는 중" : ""}`}
        onSelect={onSelect}
        danger={false}
        ring={pending ? "pending" : selected ? "selected" : ""}
        stale={stale}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: pending ? "#FB7185" : on ? "#FBBF24" : "#94A3B8" }}
        />
        {device.label}
        <span className="font-normal text-white/70">
          {pending ? "승인 기다리는 중" : on ? "켜짐" : "꺼짐"}
        </span>
      </NameTag>
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
    <ul className="space-y-3">
      {trail.map((t) => {
        /* ③ 은 네 가지로 갈립니다. 「아직 기다리는 중」과 「끝내 안 왔다」는 다릅니다. */
        const waiting = t.sentOk && t.ackAt === null && now - t.at <= ACK_MS;
        /* 기다리는 동안만 막대가 찹니다 — 「멈춘 것」과 「기다리는 것」은 다릅니다 */
        const pct = waiting ? Math.min(100, ((now - t.at) / ACK_MS) * 100) : 0;
        return (
          <li key={t.id} className="rounded-xl border border-white/[0.10] bg-slate-900/90 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold tracking-tight">
                {t.label} → {t.value > 0 ? "켜기" : "끄기"}
              </span>
              <span className="text-[11px] tabular-nums text-slate-400">
                {new Date(t.at).toLocaleTimeString("ko-KR")}
              </span>
            </div>

            {/* 세로 레일 — 명령이 **어디까지 갔는지**가 한눈에 보입니다 */}
            <ol className="relative space-y-3 pl-8">
              <span
                aria-hidden="true"
                className="absolute left-[11px] top-3 bottom-3 w-px bg-slate-200"
              />
              <Row done={t.sentOk} label="① 화면이 보냈다" />
              <Row done={t.aliveAt !== null} label="② 연결은 살아 있다" />

              {t.ackAt !== null ? (
                <Row done label="③ Pico 가 받아서 적용했다" />
              ) : waiting ? (
                <Row done={false} label="③ Pico 가 받아서 적용했다" progress={pct} />
              ) : t.appliedSeen ? (
                <TrailStep rowThree tone="warn" icon="warn">
                  ③ Pico 가 받아서 적용했다 — <b>응답은 왔는데 값이 다릅니다.</b> 보낸 값과
                  되돌아온 값이 어긋납니다. Pico 쪽에서 그 키를 다른 이름으로 읽고 있지 않은지
                  보세요.
                </TrailStep>
              ) : (
                <TrailStep rowThree tone="muted" icon="help">
                  ③ Pico 가 받아서 적용했다 — <b>아직 응답 없음.</b> 이 Pico 는 적용값을
                  되돌려 보내지 않습니다 (<b>10주차</b>에서 고칩니다). <b>고장이 아닙니다.</b>
                </TrailStep>
              )}

              {/* ★ 이 줄은 어떤 상태로도 체크되지 않습니다. 하드코딩입니다.
                  **모양만** 타임라인이 되었을 뿐, 성질은 그대로입니다. */}
              <TrailStep rowFour tone="muted" icon="help">
                ④ 실물이 실제로 움직였다 — <b>이 화면은 알 수 없습니다.</b> ③ 은{" "}
                <i>Pico 안의 값이 바뀌었다</i>는 뜻이지 <i>장치가 돌았다</i>는 뜻이 아닙니다.
                선이 빠져 있어도 ③ 은 체크됩니다. <b>눈과 귀로 확인하세요.</b>
              </TrailStep>
            </ol>
          </li>
        );
      })}
    </ul>
  );
}

/* 타임라인 한 칸. 왼쪽 동그라미가 세로 레일 위에 얹힙니다. */
function TrailStep({
  tone,
  icon,
  children,
  rowThree,
  rowFour,
}: {
  tone: "ok" | "warn" | "muted";
  icon: "check" | "help" | "warn" | "dot";
  children: React.ReactNode;
  rowThree?: boolean;
  rowFour?: boolean;
}) {
  const ring =
    tone === "ok"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
      : tone === "warn"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-600"
        : "border-white/[0.10] bg-slate-900/90 text-slate-400";
  const text =
    tone === "ok" ? "text-slate-200" : tone === "warn" ? "text-amber-300" : "text-slate-400";
  return (
    <li
      {...(rowThree ? { "data-row-three": true } : {})}
      {...(rowFour ? { "data-row-four": true } : {})}
      className="relative text-xs leading-5"
    >
      <span
        aria-hidden="true"
        className={`absolute -left-8 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full border ${ring}`}
      >
        {icon === "check" ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : icon === "warn" ? (
          <AlertTriangle className="h-3 w-3" />
        ) : icon === "dot" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        ) : (
          <CircleHelp className="h-3 w-3" />
        )}
      </span>
      <span className={text}>{children}</span>
    </li>
  );
}

/* ★ 정사영 카메라의 확대 비율을 **캔버스 크기에 맞춥니다.**
 *
 *  정사영은 거리가 아니라 zoom 으로 크기가 정해집니다. 값을 하나로 못박으면
 *  전시 모드처럼 캔버스가 넓어질 때 방이 작게 남거나 잘립니다.
 *  방(흰 단 포함)이 화면에서 차지하는 폭·높이를 대략 10.4 × 7.2 칸으로 보고,
 *  둘 중 빡빡한 쪽에 맞춥니다. drei 의 Bounds 를 쓰지 않고 R3F 코어만 씁니다. */
function FitZoom() {
  const camera = useThree((st) => st.camera);
  const width = useThree((st) => st.size.width);
  const height = useThree((st) => st.size.height);
  useEffect(() => {
    camera.zoom = Math.max(30, Math.min(width / 10.4, height / 7.2));
    camera.updateProjectionMatrix();
  }, [camera, width, height]);
  return null;
}

/* ★ 승인 말풍선을 **그 장치 옆**에 띄웁니다.
 *
 *  화면 아래 고정이면 *무엇을* 승인하는지 눈으로 이어 붙여야 합니다.
 *  장치 옆에 뜨면 「이것을 켠다」가 한눈에 보입니다.
 *
 *  🚨 **보이는 자리만 옮긴 것입니다.** 승인 전에는 여전히 아무것도 보내지 않고,
 *     「나중에」와 ESC 로 취소됩니다. 안전 동작은 한 줄도 바뀌지 않았습니다. */
function PendingBubble({
  device,
  onApprove,
  onCancel,
  portal,
}: {
  device: Device;
  onApprove: () => void;
  onCancel: () => void;
  portal: RefObject<HTMLElement>;
}) {
  const pos = SPOTS[device.spot];
  /* ★ 장치가 화면 **왼쪽**에 있으면 말풍선을 오른쪽으로 펼칩니다 (그 반대도).
     가운데 맞춤으로 두면 가장자리 장치에서 **말풍선이 캔버스 밖으로 잘립니다** —
     실측으로 확인했습니다. */
  /* 정사영에서 화면 가로 위치는 (x − z) 에 비례합니다 */
  const toRight = pos[0] - pos[2] < 0;
  return (
    <Html
      portal={portal}
      position={[pos[0], pos[1] + 1.45 * CHAR, pos[2]]}
      zIndexRange={[40, 30]}
      style={{ transform: toRight ? "translate(-8%, -100%)" : "translate(-92%, -100%)" }}
    >
      <div className="pointer-events-auto w-[17rem] rounded-2xl border border-white/[0.10] bg-slate-900/90 p-3.5 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.35)]">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200">
            <ShieldAlert className="h-3 w-3" aria-hidden="true" /> 승인 필요
          </span>
          <span className={UI.mono}>{device.key}</span>
        </div>
        <b className="block text-sm tracking-tight text-slate-50">
          {device.label}
          {josa(device.label, "을", "를")} 켤까요?
        </b>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          물 · 열 · 움직임이 있는 장치입니다. <b className="text-slate-200">승인하기 전에는
          아무것도 보내지 않습니다.</b>
        </p>
        <div className="mt-3 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className={`inline-flex items-center gap-1 rounded-lg border border-white/[0.10] bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.08] ${UI.focus}`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> 나중에
          </button>
          <button
            type="button"
            onClick={onApprove}
            className={`inline-flex items-center gap-1 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 ${UI.focus}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> 승인
          </button>
        </div>
      </div>
    </Html>
  );
}

function Row({
  done,
  label,
  progress,
}: {
  done: boolean;
  label: string;
  progress?: number;
}) {
  return (
    <TrailStep
      tone={done ? "ok" : "muted"}
      icon={done ? "check" : progress === undefined ? "help" : "dot"}
    >
      {label} {done ? "✓" : "— 아직"}
      {!done && progress !== undefined && (
        <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <span
            className="block h-full rounded-full bg-slate-300 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </span>
      )}
    </TrailStep>
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
  /* 마지막으로 값이 **실제로 도착한** 시각. 시계보다 정직합니다 */
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [applied, setApplied] = useState<AppliedMap | null>(null);
  const [actuator, setActuator] = useState<Record<string, number>>({});
  /* 처음부터 **주인공 장치**를 골라 둡니다 — 오른쪽 패널이 빈 문장으로 시작하지 않게 */
  const [selected, setSelected] = useState<string | null>(
    TWIN.devices.find((d) => d.hero)?.key ?? TWIN.devices[0]?.key ?? null,
  );
  const [tab, setTab] = useState<"detail" | "control" | "trail">("detail");
  const [pending, setPending] = useState<{ device: Device; value: number } | null>(null);
  const [trail, setTrail] = useState<TrailItem[]>([]);
  const [kiosk, setKiosk] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  /* 움직임 줄이기 설정이면 숨쉬기·맥박·떠다니기를 모두 멈춥니다 */
  const calm = useReducedMotion();

  const wsRef = useRef<WebSocket | null>(null);
  /* ★ 11주차 — 모든 3D 라벨이 함께 쓰는 포털 그릇 (위 🚨 주석 참고) */
  const labelRef = useRef<HTMLElement>(null!);
  const trailId = useRef(0);
  /* ★ 센서마다 최근 40개 값 — 추세선용. 메시지가 올 때마다 채웁니다 */
  const historyRef = useRef<Record<string, number[]>>({});

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
      setLastAt(now);
      for (const d of TWIN.devices) {
        const v = (rest as Record<string, unknown>)[d.key];
        if (d.kind !== "sensor" || typeof v !== "number") continue;
        const arr = historyRef.current[d.key] ?? (historyRef.current[d.key] = []);
        arr.push(v);
        if (arr.length > 40) arr.shift();
      }
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

  /* ★ 켜짐/꺼짐을 **한 출처**에서 읽습니다 — Pico 가 적용값을 보고하면 그 값, 아니면 화면이 보낸 값.
     예전엔 3D 는 보고값, 목록은 보낸 값을 봐서 「3D 는 켜짐 · 목록은 꺼짐」이 동시에 떴습니다 (실측).
     🚨 **보내는 묶음(sendAll)에는 보고값을 섞지 않습니다.** 보고값이 낡았으면(Pico 재부팅 등)
        승인 없이 위험한 장치를 다시 켜는 명령이 나갈 수 있습니다. */
  const isOn = (key: string) => (applied?.[key] ?? actuator[key] ?? 0) > 0;

  const requestToggle = (device: Device) => {
    const on = isOn(device.key);
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
      <header className="border-b border-white/[0.06] bg-[#0B1120]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* 트윈 로고 마크 — 겹친 두 칸 (실물과 쌍둥이). 이모지 대신 SVG */}
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" className="shrink-0">
              <rect x="2" y="7" width="17" height="17" rx="5" fill="#22D3EE" fillOpacity="0.18" stroke="#22D3EE" strokeOpacity="0.7" />
              <rect x="11" y="4" width="17" height="17" rx="5" fill="#0B1120" stroke="#A5F3FC" strokeOpacity="0.9" />
              <circle cx="19.5" cy="12.5" r="2.6" fill="#22D3EE" />
            </svg>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-50">
                {TWIN.teamName}
              </h1>
              <p className="text-xs text-slate-400">
                디지털 트윈 · {room.name} · 장치 {TWIN.devices.length} · 센서 {sensors.length} ·
                액추에이터 {actuators.length}
              </p>
            </div>
          </div>

          {/* 연결 상태 — 맥박 점 + 한국어 + 마지막 수신 시각 */}
          <div className="flex items-center gap-3">
            <span
              data-status={status}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                status === "online"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : status === "connecting"
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                    : "border-white/[0.12] bg-white/[0.04] text-slate-300"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {status !== "offline" && (
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${
                      status === "online" ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    status === "online" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-slate-400"
                  }`}
                />
              </span>
              {status === "online" ? "실시간" : status === "connecting" ? "재연결 중" : "오프라인"}
            </span>
            {lastAt !== null && status !== "offline" && (
              <span className="text-xs tabular-nums text-slate-400">
                마지막 수신 {new Date(lastAt).toLocaleTimeString("ko-KR")}
              </span>
            )}
          </div>

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
                  className={`w-36 rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-500 ${UI.focus}`}
                  placeholder="192.168.0.51"
                />
                {status === "offline" ? (
                  <button type="button" onClick={connect} className={`${UI.primaryButton} ${UI.focus}`}>
                    <Plug className="h-4 w-4" aria-hidden="true" /> 연결
                  </button>
                ) : (
                  <button type="button" onClick={disconnect} className={`${UI.secondaryButton} ${UI.focus}`}>
                    <PlugZap className="h-4 w-4" aria-hidden="true" /> 끊기
                  </button>
                )}
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
          kiosk ? "lg:grid-cols-1" : "lg:grid-cols-[276px_minmax(0,1fr)_320px]"
        }`}
      >
        {/* ── 왼쪽 · 장치 목록 ──────────────────────────────── */}
        {!kiosk && (
          <aside className={`${UI.card} space-y-3 p-4`}>
            <div className="flex items-baseline justify-between px-1">
              <h2 className={UI.eyebrow}>우리 팀 장치</h2>
              <span className="text-xs tabular-nums text-slate-400">{TWIN.devices.length}</span>
            </div>
            <ul className="space-y-1">
              {TWIN.devices.map((d) => {
                const lvl =
                  d.kind === "sensor" ? sensorLevel(d, sensor?.[d.key], sensor) : "ok";
                const on = isOn(d.key);
                /* 3D 안의 캐릭터와 **같은 색** — 목록과 방을 눈으로 잇는 끈 */
                const tint = CLAY[TWIN.devices.indexOf(d) % CLAY.length];
                const Icon = iconFor(d);
                const v = sensor?.[d.key];
                return (
                  <li key={d.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(d.key);
                        setTab(d.kind === "sensor" ? "detail" : "control");
                      }}
                      className={`group flex w-full items-center gap-3 rounded-[10px] border px-2.5 py-2 text-left transition-colors ${UI.focus} ${
                        selected === d.key
                          ? "border-cyan-400/30 bg-cyan-400/[0.06]"
                          : "border-transparent hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset ring-white/[0.06]"
                        style={{ backgroundColor: `${tint}1F`, color: tint }}
                      >
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-slate-100">{d.label}</span>
                          {d.risk === "high" && (
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" aria-label="위험한 장치" />
                          )}
                          <span
                            className={`ml-auto shrink-0 rounded-full border px-2 py-px text-[11px] font-semibold ${
                              d.kind === "sensor"
                                ? LEVEL_CLASS[lvl]
                                : on
                                  ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                                  : "border-white/[0.12] bg-white/[0.04] text-slate-300"
                            }`}
                          >
                            {d.kind === "sensor" ? LEVEL_TEXT[lvl] : on ? "켜짐" : "꺼짐"}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          {/* ★ JSON 키를 같이 보여 줍니다 — 「key 를 한글로 적음」을 스스로 발견하는 자리 */}
                          <span className={`min-w-0 flex-1 truncate ${UI.mono}`}>{d.key}</span>
                          {d.kind === "sensor" && (
                            <>
                              <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-300">
                                {v === null || v === undefined ? "—" : `${v}${d.unit ?? ""}`}
                              </span>
                              <Spark data={historyRef.current[d.key] ?? []} color={LEVEL_LINE[lvl]} w={40} h={14} />
                            </>
                          )}
                        </span>
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
          <div className="absolute inset-0" data-motion={calm ? "reduced" : "full"}>
            {webgl === null ? null : (
              <Canvas
                /* ★ 정사영(orthographic) — 원근 왜곡 없이 **도면 같은 아이소메트릭**.
                   원근 카메라는 앞쪽 바닥을 크게, 뒤쪽 장치를 작게 그려
                   방 앞이 휑해 보였습니다. */
                orthographic
                camera={{ position: [10, 9, 10], zoom: 80, near: 0.1, far: 100 }}
                /* ★ 픽셀 비율 상한. 레티나 화면에서 이게 없으면 픽셀을 4배로 그립니다 —
                   성능에서 가장 크게 손해 보는 자리입니다. */
                dpr={[1, 1.5]}
              >
                {/* ★ 조명은 **카메라 쪽**에서 비춰야 합니다. 반대편([-4,7,-4])에 두면
                    우리가 보는 면이 전부 그늘이라, 흰 벽(#eef6ef)도 **짙은 회색**으로
                    나옵니다. groundColor 도 너무 어두우면(#1e293b) 옆면을 끌어내립니다. */}
                {/* ★ 다크 관제실 조명 — 주변광은 낮게, 차가운 주광 + 반대편 **청록 테두리광**.
                    분위기는 발광 재질(화면·띠·전구)이 만듭니다. 그림자는 던지지 않습니다
                    (castShadow 는 프레임을 깎고 바닥에 검은 사각형을 만듭니다 — 규칙 §13). */}
                <hemisphereLight intensity={0.55} color="#C7D2FE" groundColor="#0B1120" />
                <ambientLight intensity={0.35} />
                <directionalLight position={[4, 9, 4]} intensity={1.25} color="#F1F5F9" />
                <directionalLight position={[-6, 4, -6]} intensity={0.55} color="#22D3EE" />

                {/* 🐞 여기에 한때 `<Environment>` + `<Lightformer>` 가 있었습니다.
                    점토 느낌의 반사를 주려던 것인데, **실측해 보니 프레임이 2.4배 느려지면서
                    그림은 사실상 똑같았습니다** (4.9fps → 11.6fps, 캡처 비교 차이 없음).
                    모든 재질이 픽셀마다 큐브맵을 뒤지기 때문입니다.
                    위 조명만으로 충분합니다. **다시 넣지 마세요.** */}

                {/* 물체가 바닥에 **붙어** 보이게 하는 접지 그림자.
                    평행광 그림자만으로는 장치가 떠 보입니다. */}
                <ContactShadows
                  position={[0, 0.012, 0]}
                  opacity={0.55}
                  scale={11}
                  blur={2.6}
                  far={3.2}
                  /* ★ 기본값이 frames=Infinity 라 **매 프레임 장면을 한 번 더** 그립니다.
                     방은 가만히 있으므로 처음 몇 장만 구우면 충분합니다. */
                  frames={1}
                  resolution={256}
                  color="#000000"
                />
                <RoomShell room={room} />
                {sensors.map((d) => (
                  <SensorNode
                    key={d.key}
                    index={TWIN.devices.indexOf(d)}
                    device={d}
                    value={sensor?.[d.key]}
                    level={sensorLevel(d, sensor?.[d.key], sensor)}
                    stale={stale}
                    big={kiosk}
                    portal={labelRef}
                    calm={calm}
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
                    index={TWIN.devices.indexOf(d)}
                    device={d}
                    on={isOn(d.key)}
                    pending={pending?.device.key === d.key}
                    stale={stale}
                    hidden={kiosk && d.risk === "high"}
                    portal={labelRef}
                    calm={calm}
                    selected={selected === d.key}
                    onSelect={() => {
                      setSelected(d.key);
                      setTab("control");
                    }}
                  />
                ))}
                {pending && (
                  <PendingBubble
                    device={pending.device}
                    onApprove={approvePending}
                    onCancel={() => setPending(null)}
                    portal={labelRef}
                  />
                )}
                <OrbitControls
                  enablePan={false}
                  /* 바닥(y=0)이 아니라 **사람 눈높이**를 봅니다. 원점을 보면 바닥이
                     화면 아래 2/3 를 먹고 장치가 작아집니다. */
                  target={[0, 0.35, 0]}
                  /* 확대·축소는 끕니다 — 크기는 FitZoom 이 화면에 맞춥니다.
                     돌려 보기만 됩니다. */
                  enableZoom={false}
                  minPolarAngle={0.6}
                  maxPolarAngle={1.2}
                />
              </Canvas>
            )}
          </div>

          {/* 방 아래 떠 있는 알약 — 레퍼런스의 「← Lounge」 · 「Manage team」 자리.
              전시 모드에서는 숨깁니다 (관람객이 누를 곳이 아닙니다). */}
          {!kiosk && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 p-3">
              <a
                href="/dashboard"
                className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-sm backdrop-blur hover:bg-slate-800 ${UI.focus}`}
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                2D 로 돌아가기
              </a>
              <a
                href="/office"
                className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-sm backdrop-blur hover:bg-slate-800 ${UI.focus}`}
              >
                3D 없는 화면
              </a>
            </div>
          )}
        </section>

        {/* ── 오른쪽 · 상세 / 제어 / 기록 ───────────────────── */}
        {!kiosk && (
          <aside className={`${UI.card} ${UI.cardPadding} space-y-4`}>
            {/* 레퍼런스의 「NEEDS YOU」. 🚨 **버튼은 넣지 않습니다** — 같은 이름의
                「승인」 버튼이 두 곳에 있으면 무엇을 눌러야 할지 헷갈립니다.
                승인은 방 안 말풍선 **한 곳에서만** 합니다. */}
            {pending && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" /> 승인이 필요해요
                </span>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  <b>{pending.device.label}</b>
                  {josa(pending.device.label, "을", "를")} 켤지 묻고 있습니다.{" "}
                  <span className="text-slate-400">방 안 말풍선에서 정하세요.</span>
                </p>
              </div>
            )}
            <div className="flex gap-1 rounded-full bg-white/[0.05] p-1">
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
                  className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${UI.focus} ${
                    tab === k ? "bg-white/[0.10] text-white shadow-sm ring-1 ring-inset ring-white/10" : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {tab === "detail" && (
              <div className="space-y-4">
                {selectedDevice === null ? (
                  <p className={UI.description}>장치를 고르면 자세한 값이 나옵니다.</p>
                ) : selectedDevice.kind === "sensor" ? (
                  (() => {
                    const v = sensor?.[selectedDevice.key];
                    const lvl = sensorLevel(selectedDevice, v, sensor);
                    const hist = historyRef.current[selectedDevice.key] ?? [];
                    const DIcon = iconFor(selectedDevice);
                    return (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`${UI.eyebrow} flex items-center gap-1.5`}>
                              <DIcon className="h-3.5 w-3.5" aria-hidden="true" /> 센서
                            </p>
                            <h2 className={`${UI.sectionTitle} mt-1`}>{selectedDevice.label}</h2>
                            <p className={UI.mono}>{selectedDevice.key}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${LEVEL_CLASS[lvl]}`}>
                            {LEVEL_TEXT[lvl]}
                          </span>
                        </div>
                        <p data-detail-value className="text-5xl font-semibold tracking-tight tabular-nums text-slate-50">
                          {v === null || v === undefined ? "—" : v}
                          <span className="ml-1 text-lg font-medium text-slate-400">{selectedDevice.unit ?? ""}</span>
                        </p>
                        {/* 큰 추세선 + 주의·위험 기준선 (기준선에는 글자를 붙입니다 — 색만으로 알리지 않게) */}
                        <div className="rounded-[10px] border border-white/[0.06] bg-black/20 p-3">
                          <p className={`${UI.eyebrow} mb-2`}>최근 {hist.length}개 값</p>
                          <Spark
                            data={hist}
                            color={LEVEL_LINE[lvl]}
                            w={268}
                            h={84}
                            warn={selectedDevice.warn}
                            danger={selectedDevice.danger}
                            labels
                          />
                        </div>
                        <dl className="grid grid-cols-3 gap-2 text-center">
                          {[
                            ["최소", hist.length ? Math.min(...hist) : "—"],
                            ["최대", hist.length ? Math.max(...hist) : "—"],
                            ["갱신", lastAt ? new Date(lastAt).toTimeString().slice(0, 8) : "—"],
                          ].map(([k, val]) => (
                            <div key={k as string} className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-2 py-2">
                              <dt className="text-[11px] text-slate-400">{k}</dt>
                              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-100">{val}</dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    );
                  })()
                ) : (
                  (() => {
                    const on = isOn(selectedDevice.key);
                    const DIcon = iconFor(selectedDevice);
                    return (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`${UI.eyebrow} flex items-center gap-1.5`}>
                              <DIcon className="h-3.5 w-3.5" aria-hidden="true" /> 액추에이터
                            </p>
                            <h2 className={`${UI.sectionTitle} mt-1`}>{selectedDevice.label}</h2>
                            <p className={UI.mono}>{selectedDevice.key}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              on
                                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                                : "border-white/[0.12] bg-white/[0.04] text-slate-300"
                            }`}
                          >
                            {on ? "켜짐" : "꺼짐"}
                          </span>
                        </div>
                        {selectedDevice.risk === "high" && (
                          <p className="rounded-[10px] border border-rose-400/30 bg-rose-500/10 p-3 text-sm leading-6 text-rose-100">
                            <b>위험한 장치</b> — 누르면 먼저 묻고, 전시 모드에서는 숨깁니다.
                          </p>
                        )}
                        <p className={UI.description}>켜고 끄기는 「제어」 탭에서 합니다.</p>
                      </>
                    );
                  })()
                )}
              </div>
            )}

            {tab === "control" && (
              <div className="space-y-2">
                {visibleActuators.length === 0 ? (
                  <p className={UI.description}>지금 만질 수 있는 장치가 없습니다.</p>
                ) : (
                  visibleActuators.map((d) => {
                    const on = isOn(d.key);
                    return (
                      <div
                        key={d.key}
                        data-control={d.key}
                        className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.08] bg-white/[0.03] p-3"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
                          {d.label}
                          {d.risk === "high" && (
                            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" aria-label="위험한 장치" />
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
