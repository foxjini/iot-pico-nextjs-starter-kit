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
import { Canvas, useThree } from "@react-three/fiber";
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
  /* 찬 회색(bg-slate-50) 대신 **따뜻한 종이색**. 흰 카드가 떠 보입니다. */
  page:
    "min-h-screen bg-[#F6F5F2] bg-[radial-gradient(1100px_520px_at_50%_-8%,#FFFFFF,transparent_70%)] text-[#141414]",
  /* 테두리는 머리카락처럼 얇게, 그림자는 2단으로 아주 옅게.
     진한 테두리 하나보다 이쪽이 훨씬 비싸 보입니다. */
  card:
    "rounded-2xl border border-black/[0.06] bg-white " +
    "shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-18px_rgba(16,24,40,0.28)]",
  cardPadding: "p-5",
  sectionTitle: "text-lg font-semibold tracking-tight text-[#141414]",
  cardTitle: "text-sm font-semibold tracking-tight text-[#141414]",
  /* 구역 머리에 붙이는 아주 작은 대문자 라벨. 밀도를 만드는 값싼 장치입니다. */
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400",
  /* JSON 키처럼 **코드인 것**은 코드처럼 보여야 합니다 */
  mono: "font-mono text-[11px] tracking-tight text-slate-400",
  description: "text-sm leading-6 text-slate-500",
  focus:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
  primaryButton:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-[#141414] px-4 py-2.5 " +
    "text-sm font-semibold text-white transition-colors hover:bg-[#2a2a2a] " +
    "disabled:cursor-not-allowed disabled:opacity-50",
  secondaryButton:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-black/[0.08] " +
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

/* 바닥을 **밝게** 잡았습니다. 어두운 흙색은 화면의 절반을 차지하면서
   전체를 무겁게 눌렀습니다 (실측: 바닥이 화면의 44%). */
const ROOMS: Record<RoomKind, RoomPreset> = {
  farm: { name: "온실", floor: "#C8A882", wall: "#F2F7F2", accent: "#4FC48D" },
  home: { name: "집", floor: "#E2C7A0", wall: "#FAFAFA", accent: "#5BAEE0" },
  factory: { name: "공장", floor: "#B4BDC8", wall: "#EDF1F5", accent: "#F2B33D" },
  park: { name: "공원", floor: "#A8D08A", wall: "#F2F7FF", accent: "#5BAEE0" },
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

function RoomShell({ room }: { room: RoomPreset }) {
  /* 점토처럼 보이게 하는 재질. 거칠기를 높이고 금속성을 0 으로 두면
     빛이 뭉개져 플라스틱이 아니라 점토가 됩니다. */
  const clay = { roughness: 0.62, metalness: 0 };
  /* ★ 벽은 **낮게**. 높은 벽은 화면 위쪽을 회색으로 눌렀습니다.
     레퍼런스처럼 허리 높이 반벽이면 방 안이 다 보입니다. */
  const WALL_H = 1.1;

  return (
    <group>
      {/* 방이 **떠 있는 둥근 단** 위에 놓입니다 — 방이 하나의 「작품」으로 보입니다 */}
      <RoundedBox args={[6.7, 0.44, 6.7]} radius={0.2} smoothness={2} position={[0, -0.24, 0]}>
        <meshStandardMaterial color="#FFFFFF" roughness={0.78} metalness={0} />
      </RoundedBox>

      {/* 바닥 — 단보다 아주 조금 위에 둬서 z-fighting 을 피합니다 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color={room.floor} roughness={0.92} metalness={0} />
      </mesh>

      {/* 가운데 러그 — 주인공 자리를 받쳐 줍니다 */}
      <mesh position={[-0.2, 0.012, 0.55]}>
        <cylinderGeometry args={[1.3, 1.3, 0.02, 40]} />
        <meshStandardMaterial color={mix(room.accent, "#FFFFFF", 0.55)} roughness={0.95} metalness={0} />
      </mesh>

      {/* 뒷벽 · 왼쪽 벽 — 카메라가 앞·오른쪽에 있으므로 벽은 **뒤와 왼쪽**에만 섭니다 */}
      <RoundedBox args={[6, WALL_H, 0.14]} radius={0.05} smoothness={2} position={[0, WALL_H / 2, -3]}>
        <meshStandardMaterial color="#FFFFFF" {...clay} />
      </RoundedBox>
      <RoundedBox args={[0.14, WALL_H, 6]} radius={0.05} smoothness={2} position={[-3, WALL_H / 2, 0]}>
        <meshStandardMaterial color="#FFFFFF" {...clay} />
      </RoundedBox>
      {/* 벽 위 모서리 띠 — 흰 벽이 바닥과 섞이지 않게 테두리를 줍니다 */}
      <mesh position={[0, WALL_H + 0.005, -3]}>
        <boxGeometry args={[6, 0.01, 0.15]} />
        <meshStandardMaterial color={room.wall} roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[-3, WALL_H + 0.005, 0]}>
        <boxGeometry args={[0.15, 0.01, 6]} />
        <meshStandardMaterial color={room.wall} roughness={0.8} metalness={0} />
      </mesh>

      {/* 화이트보드 — 막대그래프 장식 */}
      <group position={[0.55, 0, -2.72]}>
        <RoundedBox args={[1.5, 0.85, 0.06]} radius={0.03} smoothness={2} position={[0, 1.15, 0]}>
          <meshStandardMaterial color="#FFFFFF" {...clay} />
        </RoundedBox>
        <RoundedBox args={[1.58, 0.93, 0.04]} radius={0.03} smoothness={2} position={[0, 1.15, -0.03]}>
          <meshStandardMaterial color="#C9CFD8" {...clay} />
        </RoundedBox>
        {[0.22, 0.38, 0.3, 0.5, 0.42].map((h, k) => (
          <mesh key={k} position={[-0.5 + k * 0.25, 0.86 + h / 2, 0.04]}>
            <boxGeometry args={[0.14, h, 0.02]} />
            <meshStandardMaterial color={CLAY[k % CLAY.length]} roughness={0.6} metalness={0} />
          </mesh>
        ))}
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} position={[x, 0.36, 0.02]}>
            <cylinderGeometry args={[0.025, 0.025, 0.72, 8]} />
            <meshStandardMaterial color="#AEB6C2" roughness={0.6} metalness={0} />
          </mesh>
        ))}
      </group>

      {/* 뒤쪽 낮은 선반 + 책 */}
      <RoundedBox args={[1.4, 0.56, 0.36]} radius={0.04} smoothness={2} position={[-1.85, 0.28, -2.72]}>
        <meshStandardMaterial color="#F3ECE2" {...clay} />
      </RoundedBox>
      {[
        { x: -2.3, h: 0.24, c: "#F2A3B3" },
        { x: -2.18, h: 0.3, c: "#9BC6F2" },
        { x: -2.06, h: 0.2, c: "#F2CE7A" },
      ].map((b) => (
        <mesh key={b.x} position={[b.x, 0.56 + b.h / 2, -2.72]}>
          <boxGeometry args={[0.09, b.h, 0.26]} />
          <meshStandardMaterial color={b.c} roughness={0.6} metalness={0} />
        </mesh>
      ))}

      {/* 오른쪽 뒤 책상 무리 — 모니터 둘 · 의자 둘 */}
      <RoundedBox args={[1.5, 0.08, 0.75]} radius={0.03} smoothness={2} position={[2.0, 0.62, -2.35]}>
        <meshStandardMaterial color="#F7EDE0" {...clay} />
      </RoundedBox>
      {[1.35, 2.65].map((x) => (
        <mesh key={x} position={[x, 0.3, -2.35]}>
          <boxGeometry args={[0.06, 0.6, 0.65]} />
          <meshStandardMaterial color="#E9DCCB" roughness={0.65} metalness={0} />
        </mesh>
      ))}
      {[1.65, 2.35].map((x) => (
        <group key={x}>
          <RoundedBox args={[0.5, 0.32, 0.04]} radius={0.02} smoothness={2} position={[x, 0.86, -2.5]}>
            <meshStandardMaterial color="#3C4453" {...clay} />
          </RoundedBox>
          <mesh position={[x, 0.86, -2.475]}>
            <boxGeometry args={[0.44, 0.26, 0.005]} />
            <meshStandardMaterial color="#AFC9E8" roughness={0.35} metalness={0} />
          </mesh>
          <mesh position={[x, 0.68, -2.5]}>
            <boxGeometry args={[0.16, 0.04, 0.12]} />
            <meshStandardMaterial color="#3C4453" roughness={0.6} metalness={0} />
          </mesh>
          {/* 의자 */}
          <RoundedBox args={[0.38, 0.07, 0.38]} radius={0.04} smoothness={2} position={[x, 0.42, -1.85]}>
            <meshStandardMaterial color="#DCE3EF" {...clay} />
          </RoundedBox>
          <RoundedBox args={[0.38, 0.36, 0.07]} radius={0.04} smoothness={2} position={[x, 0.62, -1.68]}>
            <meshStandardMaterial color="#DCE3EF" {...clay} />
          </RoundedBox>
          <mesh position={[x, 0.2, -1.85]}>
            <cylinderGeometry args={[0.04, 0.12, 0.4, 10]} />
            <meshStandardMaterial color="#AEB6C2" roughness={0.6} metalness={0} />
          </mesh>
        </group>
      ))}

      {/* 왼쪽 벽 소파 */}
      <group position={[-2.45, 0, -0.25]}>
        <RoundedBox args={[0.75, 0.26, 1.6]} radius={0.08} smoothness={2} position={[0, 0.2, 0]}>
          <meshStandardMaterial color="#EDE7DE" {...clay} />
        </RoundedBox>
        <RoundedBox args={[0.22, 0.5, 1.6]} radius={0.08} smoothness={2} position={[-0.3, 0.42, 0]}>
          <meshStandardMaterial color="#E6DED3" {...clay} />
        </RoundedBox>
        {[-0.74, 0.74].map((z) => (
          <RoundedBox key={z} args={[0.75, 0.36, 0.16]} radius={0.06} smoothness={2} position={[0, 0.27, z]}>
            <meshStandardMaterial color="#E6DED3" {...clay} />
          </RoundedBox>
        ))}
        <RoundedBox args={[0.3, 0.3, 0.3]} radius={0.08} smoothness={2} position={[0.05, 0.45, 0.25]}>
          <meshStandardMaterial color="#F2B289" {...clay} />
        </RoundedBox>
      </group>

      {/* 화분 셋 — 레퍼런스의 초록이 방을 살립니다 */}
      {[
        { p: [-2.55, 0, 1.0] as const, s: 0.9 },
        { p: [2.6, 0, 0.1] as const, s: 1.1 },
        { p: [2.55, 0, 2.55] as const, s: 0.8 },
      ].map((pl, k) => (
        <group key={k} position={pl.p as unknown as [number, number, number]} scale={pl.s}>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.2, 0.15, 0.34, 18]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.75} metalness={0} />
          </mesh>
          {[
            { p: [0, 0.55, 0], r: 0.22 },
            { p: [0.14, 0.45, 0.08], r: 0.15 },
            { p: [-0.13, 0.47, -0.06], r: 0.14 },
            { p: [0.02, 0.76, 0.02], r: 0.13 },
          ].map((l, m) => (
            <mesh key={m} position={l.p as [number, number, number]}>
              <sphereGeometry args={[l.r, 14, 12]} />
              <meshStandardMaterial color={m % 2 ? "#7CC797" : "#5DB27F"} roughness={0.75} metalness={0} />
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
   3D — 장치를 돌보는 점토 캐릭터
   ════════════════════════════════════════════════════════════

   장치 하나마다 캐릭터 하나가 자기 자리에서 장치를 돌봅니다.
   색의 역할을 **둘로 나눕니다**.

     머리카락  = 누구인지 (장치 고유색, CLAY)
     전구·상자 = 지금 상태 (정상 초록 · 주의 호박 · 위험 장미색 / 켜짐 호박)

   한 가지 색으로 둘 다 하려 하면 평소에 온 방이 초록 한 가지가 되거나,
   위험 신호가 고유색에 묻힙니다. 기본 도형(구·캡슐·상자)만 씁니다.
   ════════════════════════════════════════════════════════════ */

const SKIN = "#F5D3BA";

/* 캐릭터 크기 배율. 이름표·말풍선 높이가 여기에 맞춰져 있습니다 */
const CHAR = 1.45;

/* 이름표의 상태 점 색 */
const DOT: Record<Level, string> = {
  none: "#94A3B8",
  waiting: "#94A3B8",
  ok: "#4ADE80",
  warn: "#FBBF24",
  danger: "#FFFFFF",
};

function Caretaker({ tint, hero, children }: { tint: string; hero: boolean; children: React.ReactNode }) {
  return (
    /* ★ 주인공 하나만 아주 약하게 떠 있게 합니다. 전부 움직이면 산만해집니다. */
    <Float enabled={hero} speed={1.1} rotationIntensity={0.08} floatIntensity={0.18} floatingRange={[0, 0.05]}>
      {/* 카메라가 [+x, +z] 쪽에 있으므로 45° 돌려 얼굴이 관람객을 보게 합니다.
          CHAR 배로 키웁니다 — 레퍼런스처럼 캐릭터가 **방의 주인공**이어야 합니다. */}
      <group rotation={[0, Math.PI / 4, 0]} scale={CHAR}>
        {/* 몸통 — 고유색을 옅게 */}
        <mesh position={[0, 0.3, 0]}>
          <capsuleGeometry args={[0.15, 0.2, 4, 12]} />
          <meshStandardMaterial color={mix(tint, "#FFFFFF", 0.35)} roughness={0.62} metalness={0} />
        </mesh>
        {/* 머리 */}
        <mesh position={[0, 0.67, 0]}>
          <sphereGeometry args={[0.16, 18, 14]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} metalness={0} />
        </mesh>
        {/* 머리카락 — 윗반구. 이게 「누구인지」를 알려 주는 색입니다 */}
        <mesh position={[0, 0.69, -0.015]} scale={[1.07, 1, 1.07]}>
          <sphereGeometry args={[0.165, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color={tint} roughness={0.5} metalness={0} />
        </mesh>
        {/* 눈 */}
        {[-0.055, 0.055].map((x) => (
          <mesh key={x} position={[x, 0.655, 0.152]}>
            <sphereGeometry args={[0.017, 8, 6]} />
            <meshStandardMaterial color="#2B2B33" roughness={0.4} metalness={0} />
          </mesh>
        ))}
        {/* 돌보는 장치 — 캐릭터 오른편 */}
        <group position={[0.34, 0, 0.02]}>{children}</group>
      </group>
    </Float>
  );
}

/* 이름표 — 캐릭터 머리 위의 작은 검은 알약 (레퍼런스의 `Ara AGENT 1`) */
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
    <Html center portal={portal} position={[0, 1.08 * CHAR, 0]} zIndexRange={[20, 0]}>
      <button
        type="button"
        onClick={onSelect}
        data-device={deviceKey}
        aria-label={ariaLabel}
        className={`pointer-events-auto inline-flex w-max items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(16,24,40,0.45)] ${UI.focus} ${
          danger ? "bg-rose-600" : "bg-[#141414]/90"
        } ${stale ? "opacity-60" : ""} ${
          ring === "pending"
            ? "ring-2 ring-rose-400 ring-offset-2"
            : ring === "selected"
              ? "ring-2 ring-blue-400 ring-offset-2"
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
}) {
  const pos = SPOTS[device.spot];
  const bulb = LEVEL_3D[level];
  const shown = value === null || value === undefined ? "—" : String(value);
  const aria = `${device.label} — ${LEVEL_TEXT[level]}${
    value === null || value === undefined ? "" : ` ${value}${device.unit ?? ""}`
  }`;

  return (
    <group position={pos}>
      <Caretaker tint={CLAY[index % CLAY.length]} hero={device.hero === true}>
        {/* 센서 기둥 + 전구. **전구 색이 상태**입니다 */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.11, 0.12, 0.04, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.8} metalness={0} />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.5, 8]} />
          <meshStandardMaterial color="#AEB6C2" roughness={0.6} metalness={0} />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
          <sphereGeometry args={[0.095, 16, 12]} />
          <meshStandardMaterial
            color={bulb}
            emissive={bulb}
            /* 위험할 때만 확실히 빛납니다 — 1m 밖에서 읽히는 신호 */
            emissiveIntensity={level === "danger" ? 0.9 : level === "warn" ? 0.45 : 0.18}
            roughness={0.45}
            metalness={0}
          />
        </mesh>
      </Caretaker>

      {big && device.hero ? (
        /* 전시 모드의 주인공은 **큰 값 카드** — 멀리서 숫자가 읽혀야 합니다 */
        <Html center portal={portal} position={[0, 1.3 * CHAR, 0]} zIndexRange={[20, 0]}>
          <button
            type="button"
            onClick={onSelect}
            data-device={device.key}
            aria-label={aria}
            className={`pointer-events-auto flex w-max flex-col items-center gap-0.5 rounded-2xl border bg-white/95 px-4 py-2 text-center shadow-[0_12px_32px_-12px_rgba(16,24,40,0.35)] ${UI.focus} ${
              LEVEL_CLASS[level]
            } ${stale ? "opacity-60" : ""}`}
          >
            <span className="text-xs font-semibold leading-tight">{device.label}</span>
            <span data-hero-value className="text-4xl font-bold leading-none tabular-nums">
              {shown}
              <span className="ml-0.5 text-base font-semibold">{device.unit ?? ""}</span>
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
          <span className="font-normal text-white/65">{LEVEL_TEXT[level]}</span>
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
}) {
  const pos = SPOTS[device.spot];
  if (hidden) return null;
  const tint = CLAY[(index + 3) % CLAY.length];
  /* 켜짐이 가장 중요한 신호라 켜지면 호박색으로 덮고 빛납니다 */
  const box = on ? "#F2B33D" : mix(tint, "#FFFFFF", 0.45);

  return (
    <group position={pos}>
      <Caretaker tint={tint} hero={false}>
        <RoundedBox args={[0.3, 0.26, 0.3]} radius={0.06} smoothness={2} position={[0, 0.13, 0]}>
          <meshStandardMaterial
            color={box}
            emissive={box}
            emissiveIntensity={on ? 0.55 : 0.02}
            roughness={0.55}
            metalness={0}
          />
        </RoundedBox>
        {/* 상자 위 표시등 */}
        <mesh position={[0, 0.28, 0]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshStandardMaterial
            color={on ? "#FFF3C4" : "#9AA4B2"}
            emissive={on ? "#FFD666" : "#000000"}
            emissiveIntensity={on ? 1 : 0}
            roughness={0.4}
            metalness={0}
          />
        </mesh>
      </Caretaker>

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
        <span className="font-normal text-white/65">
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
          <li key={t.id} className="rounded-xl border border-black/[0.06] bg-white p-3">
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-600"
        : "border-slate-200 bg-white text-slate-400";
  const text =
    tone === "ok" ? "text-slate-700" : tone === "warn" ? "text-amber-700" : "text-slate-500";
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
 *  방(흰 단 포함)이 화면에서 차지하는 폭·높이를 대략 9.8 × 7.2 칸으로 보고,
 *  둘 중 빡빡한 쪽에 맞춥니다. drei 의 Bounds 를 쓰지 않고 R3F 코어만 씁니다. */
function FitZoom() {
  const camera = useThree((st) => st.camera);
  const width = useThree((st) => st.size.width);
  const height = useThree((st) => st.size.height);
  useEffect(() => {
    camera.zoom = Math.max(30, Math.min(width / 9.8, height / 7.2));
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
      <div className="pointer-events-auto w-[17rem] rounded-2xl border border-black/[0.08] bg-white p-3.5 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.35)]">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
            <ShieldAlert className="h-3 w-3" aria-hidden="true" /> 승인 필요
          </span>
          <span className={UI.mono}>{device.key}</span>
        </div>
        <b className="block text-sm tracking-tight text-[#141414]">
          {device.label}
          {josa(device.label, "을", "를")} 켤까요?
        </b>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          물 · 열 · 움직임이 있는 장치입니다. <b className="text-slate-700">승인하기 전에는
          아무것도 보내지 않습니다.</b>
        </p>
        <div className="mt-3 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className={`inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${UI.focus}`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> 나중에
          </button>
          <button
            type="button"
            onClick={onApprove}
            className={`inline-flex items-center gap-1 rounded-lg bg-[#141414] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2a2a] ${UI.focus}`}
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
        <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-slate-100">
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
      setLastAt(now);
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
      <header className="border-b border-black/[0.05] bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight">{TWIN.teamName}</h1>
            {/* 레퍼런스의 「4 agents · 9 outputs」 자리 */}
            <p className="text-xs text-slate-400">
              {room.name} · 장치 {TWIN.devices.length} · 센서 {sensors.length} · 액추에이터{" "}
              {actuators.length}
            </p>
          </div>

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
          {lastAt !== null && status !== "offline" && (
            <span className="text-xs tabular-nums text-slate-400">
              마지막 수신 {new Date(lastAt).toLocaleTimeString("ko-KR")}
            </span>
          )}

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
          kiosk ? "lg:grid-cols-1" : "lg:grid-cols-[248px_minmax(0,1fr)_328px]"
        }`}
      >
        {/* ── 왼쪽 · 장치 목록 ──────────────────────────────── */}
        {!kiosk && (
          <aside className={`${UI.card} ${UI.cardPadding} space-y-3`}>
            <div className="flex items-baseline justify-between">
              <h2 className={UI.eyebrow}>우리 팀 장치</h2>
              <span className="text-xs tabular-nums text-slate-400">{TWIN.devices.length}</span>
            </div>
            <ul className="space-y-1.5">
              {TWIN.devices.map((d, i) => {
                const lvl =
                  d.kind === "sensor" ? sensorLevel(d, sensor?.[d.key], sensor) : "ok";
                const on = (actuator[d.key] ?? 0) > 0;
                /* 3D 안의 덩어리와 **같은 색**을 칩에 씁니다 — 목록과 방을 눈으로 잇는 끈입니다 */
                const tint =
                  d.kind === "sensor"
                    ? CLAY[sensors.indexOf(d) % CLAY.length]
                    : CLAY[(actuators.indexOf(d) + 3) % CLAY.length];
                return (
                  <li key={d.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(d.key);
                        setTab(d.kind === "sensor" ? "detail" : "control");
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left ${UI.focus} ${
                        selected === d.key
                          ? "border-[#141414]/15 bg-[#F6F5F2]"
                          : "border-transparent hover:bg-[#F6F5F2]"
                      }`}
                    >
                      {/* 아이콘 칩 — 장치 고유색을 옅게 깔아 둡니다 */}
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                        style={{ backgroundColor: `${tint}33` }}
                      >
                        {d.kind === "sensor" ? (
                          <Thermometer className="h-4 w-4" style={{ color: tint }} aria-hidden="true" />
                        ) : (
                          <Boxes className="h-4 w-4" style={{ color: tint }} aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-[#141414]">
                            {d.label}
                          </span>
                          {d.risk === "high" && (
                            <ShieldAlert
                              className="h-3.5 w-3.5 shrink-0 text-rose-500"
                              aria-label="위험한 장치"
                            />
                          )}
                        </span>
                        {/* ★ JSON 키를 같이 보여 줍니다. 「key 를 한글로 적음」이라는
                            가장 흔한 실수를 학생이 **스스로** 발견하는 자리입니다. */}
                        <span className={`block truncate ${UI.mono}`}>{d.key}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          d.kind === "sensor"
                            ? LEVEL_CLASS[lvl]
                            : on
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
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
              <Canvas
                /* ★ 정사영(orthographic) — 원근 왜곡 없이 **도면 같은 아이소메트릭**.
                   원근 카메라는 앞쪽 바닥을 크게, 뒤쪽 장치를 작게 그려
                   방 앞이 휑해 보였습니다. */
                orthographic
                camera={{ position: [10, 9, 10], zoom: 80, near: 0.1, far: 100 }}
                /* ★ 픽셀 비율 상한. 레티나 화면에서 이게 없으면 픽셀을 4배로 그립니다 —
                   성능에서 가장 크게 손해 보는 자리입니다. */
                dpr={[1, 1.75]}
              >
                {/* ★ 조명은 **카메라 쪽**에서 비춰야 합니다. 반대편([-4,7,-4])에 두면
                    우리가 보는 면이 전부 그늘이라, 흰 벽(#eef6ef)도 **짙은 회색**으로
                    나옵니다. groundColor 도 너무 어두우면(#1e293b) 옆면을 끌어내립니다. */}
                {/* 그림자가 너무 진하면 바닥에 **구멍이 뚫린 것처럼** 보입니다.
                    주광을 낮추고 주변광을 올리면 그림자가 옅어집니다. */}
                <FitZoom />
                <hemisphereLight intensity={1.2} groundColor="#cbd5e1" />
                <ambientLight intensity={1.15} />
                {/* 🐞 이 빛은 **그림자를 던지지 않습니다** (castShadow 없음).
                    한때 던졌는데, ① 매 프레임 모든 물체를 한 번 더 그려 프레임이
                    12.4 → 15.4fps 로 깎였고 ② 바닥에 **검은 사각형**처럼 보이는
                    긴 그림자가 생겼습니다. 접지 그림자(<ContactShadows>)가
                    물체를 바닥에 붙이는 일을 이미 하고 있습니다. */}
                <directionalLight position={[4, 9, 4]} intensity={1.5} />

                {/* 🐞 여기에 한때 `<Environment>` + `<Lightformer>` 가 있었습니다.
                    점토 느낌의 반사를 주려던 것인데, **실측해 보니 프레임이 2.4배 느려지면서
                    그림은 사실상 똑같았습니다** (4.9fps → 11.6fps, 캡처 비교 차이 없음).
                    모든 재질이 픽셀마다 큐브맵을 뒤지기 때문입니다.
                    아래 세 조명만으로 충분합니다. **다시 넣지 마세요.** */}

                {/* 물체가 바닥에 **붙어** 보이게 하는 접지 그림자.
                    평행광 그림자만으로는 장치가 떠 보입니다. */}
                <ContactShadows
                  position={[0, 0.012, 0]}
                  opacity={0.34}
                  scale={11}
                  blur={2.6}
                  far={3.2}
                  /* ★ 기본값이 frames=Infinity 라 **매 프레임 장면을 한 번 더** 그립니다.
                     방은 가만히 있으므로 처음 몇 장만 구우면 충분합니다. */
                  frames={1}
                  resolution={256}
                  color="#4A3B2A"
                />
                <RoomShell room={room} />
                {sensors.map((d, i) => (
                  <SensorNode
                    key={d.key}
                    index={i}
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
                {actuators.map((d, i) => (
                  <ActuatorNode
                    key={d.key}
                    index={i}
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
                className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur hover:bg-white ${UI.focus}`}
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                2D 로 돌아가기
              </a>
              <a
                href="/office"
                className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur hover:bg-white ${UI.focus}`}
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
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" /> 승인이 필요해요
                </span>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  <b>{pending.device.label}</b>
                  {josa(pending.device.label, "을", "를")} 켤지 묻고 있습니다.{" "}
                  <span className="text-slate-500">방 안 말풍선에서 정하세요.</span>
                </p>
              </div>
            )}
            <div className="flex gap-1 rounded-full bg-[#F1EFEA] p-1">
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
                    tab === k ? "bg-[#141414] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
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
