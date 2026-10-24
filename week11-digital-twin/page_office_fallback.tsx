// src/app/office/page.tsx ── 11주차 3D 장치 사무실 모범답안 (선생님용)
//
// ⚠️ 이 파일은 **학생이 고치지 않습니다.** 학생이 고치는 것은 `team-twin.ts` 하나뿐이고,
//    이 화면과 /twin 이 **그 한 파일을 같이 읽습니다.**
//    그대로 나눠 주고, 학생에게는 「열지 마세요」라고 말해 주세요.
//
// ─────────────────────────────────────────────────────────────
// 이 화면이 무엇인가
//   센서와 액추에이터가 **캐릭터로 책상에 앉아 있는** 아이소메트릭 사무실입니다.
//   기존 2D 대시보드(src/app/dashboard/page.tsx)는 **한 줄도 건드리지 않습니다.**
//   여기는 /office 라는 **새 주소**이고, 언제든 2D 로 돌아갈 수 있습니다.
//
// ★ 8주차 블록 — 자동 재연결. dashboard/page.tsx 의 것과 **똑같습니다.**
// ★ 9주차 블록 — 전시 모드(WakeLock · 전체화면 · ESC 복귀). 역시 똑같습니다.
// ★ 11주차 블록 — 3D 사무실 · 승인 게이트 · 「이 명령이 실제로 간 길」
//
// ─────────────────────────────────────────────────────────────
// 🚨 3D 를 어떻게 그리는가 — WebGL 을 쓰지 않습니다
//
//   Three.js 도 react-three-fiber 도 쓰지 않습니다. `npm install` 이 **0건**입니다.
//   CSS transform(rotateX · rotateZ · translate3d)만으로 그립니다.
//
//   왜: 학교 노트북에서 WebGL 이 막혀 있어도 **똑같이 보입니다.**
//       실측 — GPU 를 끄고(webgl:false) 재어도 타일 118.8×63, 캐릭터 34×34 로 동일.
//       같은 조건에서 WebGL 기반 3D 는 아무것도 못 그립니다.
//
//   좌표 계산 때문에 style={{ transform: ... }} 를 씁니다. 이것은 규칙 §13 이
//   11주차에 한해 허용한 예외입니다. **색과 간격은 여전히 Tailwind 와 const UI** 입니다.
// ─────────────────────────────────────────────────────────────
"use client";

import {
  useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentType,
} from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Cpu, CloudSun, Droplets, HelpCircle,
  Fan, Gauge, LayoutDashboard, Lightbulb, Loader2, Maximize2, Minimize2, Power,
  ShieldAlert, Sprout, Sun, Thermometer, Waves, Wifi, WifiOff,
} from "lucide-react";

// ★ 11주차 — **트윈과 같은 파일**을 읽습니다.
//    학생이 고치는 파일은 `team-twin.ts` 하나뿐이어야 합니다. 폴백이 따로
//    자기 설정 파일을 읽으면, 3D 가 깨져 여기로 넘어온 순간에 **남의 팀 작품**이 뜹니다.
//    이 파일은 `src/app/office/` 에 있고 설정 파일은 `src/app/twin/` 에 있으므로
//    경로가 `../twin/team-twin` 입니다. **이 줄을 `./team-twin` 으로 바꾸지 마세요** —
//    빌드가 `Cannot find module` 로 실패하고, 그러면 2D 대시보드까지 안 뜹니다.
import { TWIN, type Device, type Spot } from "../twin/team-twin";

// ── 기존 계약 (바꾸지 않습니다) ──────────────────────────────
/** 「산소 펌프 을(를)」처럼 쓰지 않습니다 — 받침을 계산해 조사를 고릅니다.
 *  (3D 화면 `twin/page.tsx` 의 같은 함수와 똑같이 동작해야 합니다) */
function josa(word: string, withBatchim: string, without: string) {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return without;
  return (code - 0xac00) % 28 === 0 ? without : withBatchim;
}

type SensorData = Record<string, number | null>;
type ConnectionStatus = "offline" | "connecting" | "online";

// ★ 8주차 — 끊겼을 때 다시 시도하는 간격
const RETRY_MS = 3000;

// ★ 11주차 — 보낸 뒤 이 시간 안에 센서 메시지가 또 오면 「연결은 살아 있다」
const ALIVE_MS = 2000;

// 🚨 액추에이터는 **늘 전체를 함께 보냅니다.**
//    진짜 Pico 는 command.get("led_r", 0) 으로 받습니다. {"pump":255} 만 보내면
//    led_r·led_g·led_b 가 0 이 되고 서보가 90 도로 돌아갑니다 — **LED 가 꺼집니다.**
//    2D 화면의 sendCommand 가 하던 것과 똑같이, 바뀐 키 하나가 아니라 **묶음 전체**를 보냅니다.
//
//    ⚠️ 그래서 가상 Pico 가 이런 줄을 찍습니다 — **고장이 아닙니다.**
//       (!) 'pump' 이(가) 이미 그 상태인데 또 명령이 왔습니다
//       묶음에 안 바뀐 팀 액추에이터가 같이 실려 가기 때문입니다.
//       실측 — 명령 1회 0건 / 2회 1건 / 3회 2건씩 누적됩니다.
//       가상 Pico 가 경고하는 진짜 위험은 **1초마다 같은 명령을 되풀이하는 것**인데,
//       이 화면은 **사람이 누를 때만** 보냅니다. 기존 2D 화면도 valve 로 똑같습니다.
const BASE_ACTUATOR: Record<string, number> = {
  led_r: 0, led_g: 0, led_b: 0, servo_angle: 90,
};

/* 🚨 3D 화면(`twin/page.tsx`)의 CLAY 와 **같은 배열**이어야 합니다 —
   두 화면에서 같은 장치가 다른 색이면 관람객이 다른 작품으로 느낍니다. */
const CLAY = ["#7FC8E8", "#F2A3B3", "#F2CE7A", "#A7B6F2", "#8FD9B6", "#F2B289"];

/* 3D 화면과 **같은 규칙** — 전체 장치 순번으로 색을 고릅니다 (자리가 최대 여섯이라 안 겹침) */
function tintOf(d: Device) {
  return CLAY[TWIN.devices.indexOf(d) % CLAY.length];
}

const UI = {
  /* 🚨 3D 화면(`twin/page.tsx`)의 const UI 와 **같은 값**이어야 합니다 (형제) */
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

// ── ★ 11주차 — 아이소메트릭 좌표 ─────────────────────────────
// 바닥은 **자리 수와 정확히 같게** 둡니다 (3 × 2 = 6칸).
// 바닥이 자리보다 크면 자리 무리가 한쪽으로 치우쳐 보입니다.
const TILE = 150;       // 타일 한 칸 (px)
const ROOM_COLS = 3;
const ROOM_ROWS = 2;
const ROT_X = 52;       // 방을 눕히는 각도 (작을수록 앞뒤 줄이 더 벌어집니다)
const ROT_Z = -45;      // 방을 돌리는 각도
const DESK_H = 24;      // 책상 높이

/** ★ 11주차 — `spot` 이름 여섯 개를 이 화면의 자리 번호로 옮깁니다.
 *  트윈은 3D 좌표를, 이 화면은 바닥 격자를 씁니다. 학생이 적는 것은 `spot` 하나이고
 *  두 화면이 각자 알아서 자기 방식으로 놓습니다. */
const SPOT_SEAT: Record<Spot, number> = {
  shelf: 1, desk: 2, wall: 3,
  corner: 4, ground: 5, ceiling: 6,
};

/** 자리마다 캐릭터 색을 정해 둡니다 — 학생이 색까지 고르지 않아도 되게 */
const SPOT_COLOR: Record<Spot, string> = {
  shelf: "amber", desk: "pink", wall: "sky",
  corner: "robot", ground: "mint", ceiling: "sky",
};

/** 자리 번호 1~6 → 바닥 칸 (가로 3 × 세로 2) */
function seatCell(seat: number): { c: number; r: number } {
  const i = Math.min(6, Math.max(1, seat)) - 1;
  return { c: i % 3, r: Math.floor(i / 3) };
}

/** 방 가운데를 원점으로 두기 위한 오프셋 */
const OX = -(ROOM_COLS * TILE) / 2;
const OY = -(ROOM_ROWS * TILE) / 2;

function at(c: number, r: number, z = 0) {
  return `translate3d(${OX + c * TILE}px, ${OY + r * TILE}px, ${z}px)`;
}

/** 방 회전을 되돌려 **정면을 보게** 합니다 (빌보드) */
const FACE_CAMERA = `rotateZ(${-ROT_Z}deg) rotateX(${-ROT_X}deg)`;

// ── 캐릭터 색 ────────────────────────────────────────────────
const PALETTE: Record<string, { head: string; body: string; ring: string }> = {
  pink:  { head: "bg-pink-300",    body: "bg-pink-200",    ring: "ring-pink-400" },
  mint:  { head: "bg-emerald-300", body: "bg-emerald-200", ring: "ring-emerald-400" },
  sky:   { head: "bg-sky-300",     body: "bg-sky-200",     ring: "ring-sky-400" },
  amber: { head: "bg-amber-300",   body: "bg-amber-200",   ring: "ring-amber-400" },
  robot: { head: "bg-slate-400",   body: "bg-slate-300",   ring: "ring-slate-500" },
};

const ROOM_SKIN: Record<string, { a: string; b: string; name: string }> = {
  farm:    { a: "bg-[#14262B]", b: "bg-[#18303A]", name: "온실" },
  home:    { a: "bg-[#1C2133]", b: "bg-[#232A42]", name: "거실" },
  factory: { a: "bg-[#1A202C]", b: "bg-[#222937]", name: "공장" },
  park:    { a: "bg-[#14281F]", b: "bg-[#1A3327]", name: "공원" },
};

const DEVICE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  temperature: Thermometer, humidity: Droplets, light_percent: Sun,
  cpu_temp: Cpu, discomfort: CloudSun, soil: Sprout,
  pump: Waves, led_r: Lightbulb, led_g: Lightbulb, led_b: Lightbulb,
};
/* ★ 추세선 (스파크라인) — 🚨 3D 화면의 Spark 와 같은 코드 (형제) — 라이브러리 없이 SVG 한 장.
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

/* 🚨 3D 화면의 iconFor 와 **같은 규칙**입니다 (두 화면은 형제) */
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

// ── 장치 상태 — 색 · 아이콘 · 글자 **셋 다** ─────────────────
type DeviceState = {
  tone: string; dot: string; text: string;
  icon: ComponentType<{ className?: string }>;
};

function deskState(
  desk: Device, sensor: SensorData | null, actuator: Record<string, number>,
): DeviceState {
  // ① 아직 한 번도 못 받았다
  if (sensor === null) {
    return { tone: "text-slate-400", dot: "bg-slate-300", text: "연결 대기", icon: Clock };
  }
  if (desk.kind === "actuator") {
    const on = (actuator[desk.key] ?? 0) > 0;
    return on
      ? { tone: "text-emerald-300", dot: "bg-emerald-500", text: "켜짐", icon: CheckCircle2 }
      : { tone: "text-slate-400", dot: "bg-slate-300", text: "꺼짐", icon: Power };
  }
  const v = sensor[desk.key];
  // ② 받았는데 그 센서만 없다
  if (v === null || v === undefined) {
    return { tone: "text-slate-400", dot: "bg-slate-300", text: "데이터 없음", icon: HelpCircle };
  }
  // 팀이 기준을 안 적었으면 늘 「정상」입니다 (지어내지 않습니다)
  const { warn, danger } = desk;
  const low = (danger ?? Infinity) < (warn ?? Infinity);   // 낮을수록 위험한 센서인가
  const isDanger = danger !== undefined && (low ? v <= danger : v >= danger);
  const isWarn = warn !== undefined && (low ? v <= warn : v >= warn);
  if (isDanger) return { tone: "text-rose-300", dot: "bg-rose-500", text: "위험", icon: AlertTriangle };
  if (isWarn) return { tone: "text-amber-300", dot: "bg-amber-500", text: "주의", icon: AlertTriangle };
  return { tone: "text-emerald-300", dot: "bg-emerald-500", text: "정상", icon: CheckCircle2 };
}

// ── ★ 11주차 — 「이 명령이 실제로 간 길」 한 줄 ──────────────
type Trail = {
  id: number;
  key: string;
  label: string;
  value: number;
  at: number;
  sentOk: boolean;        // readyState 가 OPEN 이었고 send() 가 예외 없이 끝남
  aliveAt: number | null; // 보낸 뒤 ALIVE_MS 안에 센서 메시지가 또 왔는가
};

// ─────────────────────────────────────────────────────────────
//  3D 조각들
// ─────────────────────────────────────────────────────────────

/** 책상 — 윗면 하나 + 옆면 두 장 */
function DeskBox({ c, r }: { c: number; r: number }) {
  const w = 118, d = 94, h = DESK_H;
  return (
    <div className="absolute" style={{ transform: at(c + 0.1, r + 0.1), transformStyle: "preserve-3d" }}>
      <div
        className="absolute bg-[#1E2738]"
        style={{ width: w, height: h, transform: `translate3d(0, ${d}px, 0) rotateX(90deg)`, transformOrigin: "0 0" }}
      />
      <div
        className="absolute bg-[#161E2D]"
        style={{ width: h, height: d, transform: `translate3d(${w}px, 0, 0) rotateY(-90deg)`, transformOrigin: "0 0" }}
      />
      <div
        className="absolute rounded-sm bg-[#2A3448] ring-1 ring-inset ring-cyan-300/20"
        style={{ width: w, height: d, transform: `translateZ(${h}px)` }}
      />
    </div>
  );
}

/** 장치 캐릭터 — 방 회전을 되돌려 정면을 봅니다 */
function DeskCharacter({
  desk, state, value, selected, stale, big, onSelect,
}: {
  desk: Device;
  state: DeviceState;
  value: number | null | undefined;
  selected: boolean;
  stale: boolean;
  big: boolean;
  onSelect: () => void;
}) {
  const { c, r } = seatCell(SPOT_SEAT[desk.spot] ?? 1);
  const p = PALETTE[SPOT_COLOR[desk.spot]] ?? PALETTE.sky;
  const StatusIcon = state.icon;

  // 바깥 div 는 **크기 0 인 기준점**입니다. 안쪽 버튼을 translate(-50%,-100%) 로
  // 옮겨야 캐릭터의 **발바닥 한가운데**가 자리에 놓입니다.
  // (이걸 안 하면 캐릭터가 자기 너비의 절반만큼 오른쪽으로 밀립니다 — 실측 75px)
  return (
    <div
      className="absolute"
      style={{
        width: 0, height: 0,
        transform: `${at(c + 0.5, r + 0.5, DESK_H + 2)} ${FACE_CAMERA}`,
        transformStyle: "preserve-3d",
      }}
    >
    <button
      type="button"
      onClick={onSelect}
      data-device={desk.key}
      aria-label={`${desk.label} — ${state.text}`}
      className={`absolute left-0 top-0 flex flex-col items-center ${UI.focus} ${stale ? "opacity-60" : ""} transition-opacity`}
      style={{ transform: "translate(-50%, -100%)" }}
    >
      {/* 상태 — 색 + 아이콘 + 글자 셋 다 */}
      <span
        className={`mb-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-950/75 px-2 py-0.5
                    text-[11px] font-semibold shadow-sm ring-1 ring-white/10 backdrop-blur ${state.tone}`}
      >
        <StatusIcon className="h-3 w-3" aria-hidden="true" />
        {state.text}
      </span>

      {/* 머리 · 몸 */}
      <span
        className={`block h-9 w-9 rounded-full ring-2 ${p.head} ${selected ? p.ring : "ring-white"}`}
        aria-hidden="true"
      />
      <span
        className={`-mt-1 block h-9 w-11 rounded-[14px_14px_10px_10px] ring-2 ${p.body} ${selected ? p.ring : "ring-white"}`}
        aria-hidden="true"
      />

      {/* 이름표 — 전시 모드에서는 주인공만 값까지 크게 */}
      <span className="mt-1 whitespace-nowrap rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">
        {desk.label}
      </span>
      {/* ★ 9주차 — 1m 밖에서 읽히게. 전시 모드의 주인공만 값을 크게 답니다.
          평소에는 왼쪽 목록과 오른쪽 상세에 값이 있으므로 캐릭터는 깔끔하게 둡니다. */}
      {desk.kind === "sensor" && big && (
        <span className="mt-0.5 font-mono text-4xl font-semibold tabular-nums text-slate-50">
          {value === null || value === undefined ? "--" : value.toFixed(1)}
          <span className="ml-0.5 text-base font-medium text-slate-400">{desk.unit ?? ""}</span>
        </span>
      )}
    </button>
    </div>
  );
}

/** 아이소메트릭 방 */
function IsoRoom({
  sensor, actuator, selectedKey, stale, kiosk, onSelect,
}: {
  sensor: SensorData | null;
  actuator: Record<string, number>;
  selectedKey: string | null;
  stale: boolean;
  kiosk: boolean;
  onSelect: (key: string) => void;
}) {
  const skin = ROOM_SKIN[TWIN.room] ?? ROOM_SKIN.farm;
  // 뒷줄(자리 1·2·3)을 먼저 그려야 앞줄이 위에 겹칩니다
  const ordered = [...TWIN.devices].sort(
    (a, b) => (SPOT_SEAT[a.spot] ?? 1) - (SPOT_SEAT[b.spot] ?? 1),
  );
  const tiles = [];
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      tiles.push(
        <div
          key={`t${c}-${r}`}
          className={`absolute border border-cyan-300/[0.08] ${(c + r) % 2 ? skin.b : skin.a}`}
          style={{ width: TILE, height: TILE, transform: at(c, r) }}
        />,
      );
    }
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.02] ${
        kiosk ? "h-[72vh]" : "h-[520px]"
      }`}
    >
      <div
        className="absolute left-1/2 top-[54%]"
        style={{ width: 0, height: 0, transform: "translate(-50%, -50%)", transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute"
          style={{ transformStyle: "preserve-3d", transform: `rotateX(${ROT_X}deg) rotateZ(${ROT_Z}deg)` }}
        >
          {tiles}
          {ordered.map((d) => {
            const { c, r } = seatCell(SPOT_SEAT[d.spot] ?? 1);
            return <DeskBox key={`d${d.key}`} c={c} r={r} />;
          })}
          {ordered.map((d) => (
            <DeskCharacter
              key={d.key}
              desk={d}
              state={deskState(d, sensor, actuator)}
              value={sensor ? sensor[d.key] : null}
              selected={selectedKey === d.key}
              stale={stale}
              big={kiosk && !!d.hero}
              onSelect={() => onSelect(d.key)}
            />
          ))}
        </div>
      </div>

      <span className="absolute left-4 top-4 rounded-full bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300 ring-1 ring-white/10">
        {skin.name}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ★ 11주차 — 「이 명령이 실제로 간 길」
//
//  🚨 ③번 줄은 **어떤 경우에도 체크되지 않습니다.** 버그가 아니라 설계입니다.
//     지금 JSON 계약에는 **명령에 대한 응답이 없습니다.** Pico 는 1초마다
//     센서값만 보냅니다. 화면이 「적용됨 ✓」 이라고 쓰면 그것은 거짓말입니다.
// ─────────────────────────────────────────────────────────────
function CommandTrail({ trail }: { trail: Trail[] }) {
  if (trail.length === 0) {
    return (
      <p className={UI.description}>
        아직 보낸 명령이 없습니다. 액추에이터를 켜 보면 여기에 기록이 남습니다.
      </p>
    );
  }
  return (
    <ol className="space-y-4">
      {trail.map((t) => (
        <li key={t.id} className="rounded-xl border border-white/[0.10] p-3">
          <div className="flex items-center gap-2">
            <span className={UI.cardTitle}>{t.label}</span>
            <span className="font-mono text-xs text-slate-400">{t.value}</span>
            <span className="ml-auto text-xs text-slate-400">
              {new Date(t.at).toLocaleTimeString("ko-KR")}
            </span>
          </div>

          <ul className="mt-2 space-y-1.5 text-xs">
            {/* ① 화면이 보냈다 — 코드가 직접 아는 사실 */}
            <li className="flex items-start gap-2">
              {t.sentOk
                ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden="true" />}
              <span className={t.sentOk ? "text-slate-200" : "text-rose-200"}>
                {t.sentOk ? "화면이 보냈습니다" : "보내지 못했습니다 — 연결이 열려 있지 않습니다"}
              </span>
            </li>

            {/* ② 연결은 아직 살아 있다 */}
            <li className="flex items-start gap-2">
              {t.aliveAt
                ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                : <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" aria-hidden="true" />}
              <span className="text-slate-200">
                {t.aliveAt ? "보낸 뒤에도 센서값이 또 왔습니다 — 연결은 살아 있습니다"
                           : "센서값이 또 오기를 기다리는 중"}
              </span>
            </li>

            {/* ③ Pico 가 적용했다 — 화면은 알 수 없습니다. 영원히 ◌ 입니다. */}
            <li className="flex items-start gap-2">
              <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="text-slate-400">
                <b className="font-semibold text-slate-200">Pico 가 실제로 적용했는지는 이 화면이 알 수 없습니다.</b>
                {" "}지금 통신 규약에 <b>명령에 대한 답장이 없습니다.</b>
                <br />
                눈으로 확인하세요 — 실물이면 장치가 움직이는지, 가상 Pico 면 창에
                {" "}<code className="rounded bg-white/[0.06] px-1">-&gt; 우리 팀 액추에이터 … 적용</code> 줄이 찍히는지.
              </span>
            </li>
          </ul>
        </li>
      ))}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────
export default function OfficePage() {
  const [picoIp, setPicoIp] = useState("127.0.0.1");
  const [status, setStatusState] = useState<ConnectionStatus>("offline");
  const [sensor, setSensor] = useState<SensorData | null>(null);
  /* 3D 화면과 같게 — 값이 **실제로 도착한** 시각 */
  const [lastAt, setLastAt] = useState<number | null>(null);
  /* 3D 화면과 같게 — 센서마다 최근 40개 값 (추세선용) */
  const historyRef = useRef<Record<string, number[]>>({});
  const [kiosk, setKiosk] = useState(false);

  // ★ 11주차
  const actuatorDesks = useMemo(() => TWIN.devices.filter((d) => d.kind === "actuator"), []);
  const [actuator, setActuator] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = { ...BASE_ACTUATOR };
    for (const d of actuatorDesks) if (!(d.key in o)) o[d.key] = 0;
    return o;
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(TWIN.devices[0]?.key ?? null);
  const [tab, setTab] = useState<"detail" | "control" | "trail">("detail");
  const [pending, setPending] = useState<{ desk: Device; value: number } | null>(null);
  const [trail, setTrail] = useState<Trail[]>([]);
  const trailId = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);

  // ★ 8주차 — 재연결에 필요한 것 네 가지 (dashboard/page.tsx 와 똑같습니다)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantConnectedRef = useRef(false);
  const picoIpRef = useRef(picoIp);
  const statusRef = useRef<ConnectionStatus>("offline");

  useEffect(() => { picoIpRef.current = picoIp; }, [picoIp]);

  const setStatus = useCallback((next: ConnectionStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const openSocket = useCallback(() => {
    setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${picoIpRef.current}:5000/connect-websocket`);
    } catch {
      if (wantConnectedRef.current) scheduleRetryRef.current?.();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => setStatus("online");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSensor(data);
        setLastAt(Date.now());
        for (const d of TWIN.devices) {
          const v = data?.[d.key];
          if (d.kind !== "sensor" || typeof v !== "number") continue;
          const arr = historyRef.current[d.key] ?? (historyRef.current[d.key] = []);
          arr.push(v);
          if (arr.length > 40) arr.shift();
        }
      } catch {
        console.warn("잘못된 메시지 형식:", event.data);
        return;
      }
      // ★ 11주차 — 방금 보낸 명령들에 「연결은 살아 있다」 표시
      const now = Date.now();
      setTrail((prev) =>
        prev.map((t) =>
          t.aliveAt === null && t.sentOk && now - t.at <= ALIVE_MS ? { ...t, aliveAt: now } : t,
        ),
      );
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (wantConnectedRef.current) scheduleRetryRef.current?.();
      else setStatus("offline");
    };
  }, [setStatus]);

  const scheduleRetryRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    scheduleRetryRef.current = () => {
      setStatus("connecting");
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(openSocket, RETRY_MS);
    };
  }, [openSocket, setStatus]);

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
    setStatus("offline");
  };

  useEffect(() => {
    return () => {
      wantConnectedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  // ★ 9주차 — 전시 모드: 화면이 꺼지지 않게 막습니다
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
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [kiosk]);

  // ★ 9주차 — ESC 로 전체화면을 빠져나와도 전시 모드가 같이 꺼지게
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setKiosk(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleKiosk = async () => {
    const next = !kiosk;
    setKiosk(next);
    setPending(null);   // ★ 11주차 — 전시 모드로 들어가면 대기 중인 승인은 버립니다
    try {
      if (next) await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* 전체화면이 막혀도 전시 모드 자체는 동작합니다 */ }
  };

  const online = status === "online";
  const connecting = status === "connecting";
  // ★ 8주차 — 재연결 중이면 마지막 값을 지우지 않고 흐리게 둡니다
  const stale = connecting && sensor !== null;

  // ── ★ 11주차 — 명령 보내기 ─────────────────────────────────
  /** 🚨 바뀐 키 하나가 아니라 **액추에이터 묶음 전체**를 보냅니다 (위 BASE_ACTUATOR 주석) */
  const sendAll = (next: Record<string, number>, desk: Device, value: number) => {
    const ws = wsRef.current;
    let sentOk = false;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(next)); sentOk = true; } catch { sentOk = false; }
    }
    if (sentOk) setActuator(next);     // 보내지 못했으면 화면 상태도 바꾸지 않습니다
    trailId.current += 1;
    setTrail((prev) => [
      { id: trailId.current, key: desk.key, label: desk.label, value, at: Date.now(), sentOk, aliveAt: null },
      ...prev,
    ].slice(0, 8));
  };

  /** 위험한 장치는 바로 보내지 않고 **승인을 먼저** 받습니다 */
  const requestToggle = (desk: Device) => {
    const on = (actuator[desk.key] ?? 0) > 0;
    const value = on ? 0 : (desk.onValue ?? 255);
    if (desk.risk === "high" && value > 0) { setPending({ desk, value }); return; }
    sendAll({ ...actuator, [desk.key]: value }, desk, value);
  };

  const approvePending = () => {
    if (!pending) return;
    sendAll({ ...actuator, [pending.desk.key]: pending.value }, pending.desk, pending.value);
    setPending(null);
  };

  const selected = TWIN.devices.find((d) => d.key === selectedKey) ?? null;
  const selectedState = selected ? deskState(selected, sensor, actuator) : null;
  const selectedValue = selected && sensor ? sensor[selected.key] : null;

  /** 전시 모드에서는 위험한 장치를 아예 숨깁니다 (9주차 J3 과 같은 기준) */
  const visibleActuators = actuatorDesks.filter((d) => !(kiosk && d.risk === "high"));

  return (
    <main className={UI.page}>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">
        {/* ── 위쪽 띠 ─────────────────────────────────────── */}
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h1 className={UI.sectionTitle}>{TWIN.teamName}</h1>
            <p className="text-xs text-slate-400">
              3D 없는 화면 · 장치 {TWIN.devices.length} · 센서{" "}
              {TWIN.devices.filter((d) => d.kind === "sensor").length} · 액추에이터{" "}
              {TWIN.devices.filter((d) => d.kind === "actuator").length}
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              online ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : connecting ? "border border-amber-400/30 bg-amber-400/10 text-amber-300"
              : "border border-white/[0.12] bg-white/[0.04] text-slate-300"
            }`}
          >
            {online ? <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
              : connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
            {online ? "실시간" : connecting ? "재연결 중…" : "오프라인"}
          </span>
          {lastAt !== null && !(!online && !connecting) && (
            <span className="text-xs tabular-nums text-slate-400">
              마지막 수신 {new Date(lastAt).toLocaleTimeString("ko-KR")}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* ★ 11주차 — 3D 가 이상하면 관람객 앞에서 1초에 되돌립니다 */}
            <a href="/dashboard" className={`${UI.secondaryButton} ${UI.focus}`}>
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              2D 로 돌아가기
            </a>
            <button type="button" onClick={toggleKiosk} className={`${UI.primaryButton} ${UI.focus}`}>
              {kiosk ? <Minimize2 className="h-4 w-4" aria-hidden="true" />
                     : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
              {kiosk ? "전시 모드 끄기" : "전시 모드"}
            </button>
          </div>
        </header>

        {/* ★ 9주차 — 전시 모드에서는 개발용 설정을 숨깁니다 */}
        {!kiosk && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label htmlFor="picoIp" className="text-sm font-medium text-slate-300">Pico 주소</label>
            <input
              id="picoIp"
              value={picoIp}
              onChange={(e) => setPicoIp(e.target.value)}
              className={`w-44 rounded-xl border border-white/[0.15] px-3 py-2 font-mono text-sm ${UI.focus}`}
            />
            <button type="button" onClick={connect} disabled={status !== "offline"}
                    className={`${UI.primaryButton} ${UI.focus}`}>
              장치 연결
            </button>
            <button type="button" onClick={disconnect} disabled={status === "offline"}
                    className={`${UI.secondaryButton} ${UI.focus}`}>
              연결 끊기
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_330px]">
          {/* ── 왼쪽 · 장치 목록 ──────────────────────────── */}
          <aside className={`${UI.card} p-3`}>
            <div className="flex items-baseline justify-between px-2 pb-2">
              <h2 className={UI.eyebrow}>우리 팀 장치</h2>
              <span className="text-xs tabular-nums text-slate-400">{TWIN.devices.length}</span>
            </div>
            <ul className="space-y-1">
              {TWIN.devices.map((d) => {
                const st = deskState(d, sensor, actuator);
                const Icon = iconFor(d);
                const on = selectedKey === d.key;
                return (
                  <li key={d.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(d.key)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${UI.focus} ${
                        on
                          ? "border-cyan-400/30 bg-cyan-400/[0.06]"
                          : "border-transparent hover:bg-white/[0.04]"
                      }`}
                    >
                      {/* 아이콘 칩 — 3D 화면의 장치 색과 같습니다 */}
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                        /* 아이콘은 lucide 라 `currentColor` 를 물려받습니다 —
                           색을 감싼 칩에 두면 아이콘 쪽에 style 을 줄 필요가 없습니다
                           (iconFor 가 돌려주는 타입은 style 을 안 받습니다). */
                        style={{
                          backgroundColor: `${tintOf(d)}33`,
                          color: tintOf(d),
                        }}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-50">
                          {d.label}
                        </span>
                        <span className={`block truncate ${UI.mono}`}>{d.key}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} aria-hidden="true" />
                          <span className={`text-[11px] font-semibold ${st.tone}`}>{st.text}</span>
                        </span>
                        {d.kind === "sensor" && (
                          <Spark
                            data={historyRef.current[d.key] ?? []}
                            color={st.text === "위험" ? "#FB7185" : st.text === "주의" ? "#FBBF24" : "#34D399"}
                            w={44}
                            h={14}
                          />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* ── 가운데 · 3D 사무실 ────────────────────────── */}
          <section className="relative">
            <IsoRoom
              sensor={sensor}
              actuator={actuator}
              selectedKey={selectedKey}
              stale={stale}
              kiosk={kiosk}
              onSelect={(k) => setSelectedKey(k)}
            />

            {/* ★ 11주차 — 승인 말풍선 (화면 좌표에 띄웁니다) */}
            {pending && (
              <div
                role="alertdialog"
                aria-label={`${pending.desk.label} 승인 필요`}
                className="absolute right-4 top-4 w-72 rounded-2xl border border-white/[0.10] bg-slate-900/90 p-4 shadow-xl"
              >
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-200">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  승인이 필요합니다 · {pending.desk.label}
                </span>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  <b>{pending.desk.label}</b>
                  {josa(pending.desk.label, "을", "를")} 켜려고 합니다.
                  물 · 열 · 움직임이 있는 장치라 <b>아직 보내지 않았습니다.</b>
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setPending(null)}
                          className={`flex-1 ${UI.secondaryButton} ${UI.focus}`}>
                    나중에
                  </button>
                  <button type="button" onClick={approvePending}
                          className={`flex-1 ${UI.primaryButton} ${UI.focus}`}>
                    승인하고 보내기
                  </button>
                </div>
              </div>
            )}

            {/* 아직 한 번도 못 받았다 */}
            {sensor === null && !kiosk && (
              <p className="mt-3 rounded-xl border border-dashed border-white/[0.15] p-4 text-center text-sm text-slate-400">
                아직 센서 데이터가 없습니다. 위에서 <b>장치 연결</b>을 눌러 주세요.
              </p>
            )}
          </section>

          {/* ── 오른쪽 · 인스펙터 ─────────────────────────── */}
          <aside className={`${UI.card} p-4`}>
            <div className="mb-3 flex gap-1 rounded-full bg-white/[0.05] p-1">
              {([["detail", "상세"], ["control", "제어"], ["trail", "기록"]] as const).map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors ${UI.focus}
                              ${tab === k ? "bg-white/[0.10] text-white shadow-sm ring-1 ring-inset ring-white/10" : "text-slate-400 hover:text-slate-100"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "detail" && (
              selected && selectedState ? (
                <div>
                  <h3 className={UI.cardTitle}>{selected.label}</h3>
                  <p className="font-mono text-[11px] text-slate-400">{selected.key}</p>
                  <p className={`mt-3 font-mono text-4xl font-semibold tabular-nums ${
                    selectedValue === null || selectedValue === undefined ? "text-slate-400" : "text-slate-50"
                  }`}>
                    {selected.kind === "actuator"
                      ? ((actuator[selected.key] ?? 0) > 0 ? "켜짐" : "꺼짐")
                      : selectedValue === null || selectedValue === undefined ? "--" : selectedValue.toFixed(1)}
                    {selected.kind === "sensor" && (
                      <span className="ml-1 text-base font-medium text-slate-400">{selected.unit ?? ""}</span>
                    )}
                  </p>
                  <p className={`mt-1 inline-flex items-center gap-1 text-sm font-semibold ${selectedState.tone}`}>
                    <selectedState.icon className="h-4 w-4" aria-hidden="true" />
                    {selectedState.text}
                  </p>
                  {stale && (
                    <p className="mt-3 rounded-lg bg-amber-400/10 p-2 text-xs text-amber-200">
                      재연결 중입니다. 위 값은 <b>마지막으로 받은 값</b>이고 지금 값이 아닙니다.
                    </p>
                  )}
                </div>
              ) : <p className={UI.description}>왼쪽에서 장치를 고르세요.</p>
            )}

            {tab === "control" && (
              <div className="space-y-2">
                {visibleActuators.length === 0 ? (
                  <p className={UI.description}>
                    {kiosk ? "전시 모드에서는 위험한 장치를 숨깁니다." : "액추에이터가 없는 팀입니다."}
                  </p>
                ) : visibleActuators.map((d) => {
                  const on = (actuator[d.key] ?? 0) > 0;
                  return (
                    <div key={d.key} className="flex items-center gap-2 rounded-xl border border-white/[0.10] p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-50">{d.label}</span>
                        {d.risk === "high" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300">
                            <ShieldAlert className="h-3 w-3" aria-hidden="true" />승인 필요
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => requestToggle(d)}
                        disabled={!online}
                        className={`${on ? UI.primaryButton : UI.secondaryButton} ${UI.focus} px-3 py-1.5 text-xs`}
                      >
                        {on ? "끄기" : "켜기"}
                      </button>
                    </div>
                  );
                })}
                {!online && (
                  <p className="text-xs text-slate-400">연결되어 있지 않아 명령을 보낼 수 없습니다.</p>
                )}
              </div>
            )}

            {tab === "trail" && (
              <div>
                <h3 className={`${UI.cardTitle} mb-2`}>이 명령이 실제로 간 길</h3>
                <CommandTrail trail={trail} />
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
