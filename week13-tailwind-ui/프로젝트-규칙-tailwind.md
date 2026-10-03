# 이 프로젝트의 규칙 (반드시 먼저 읽어 주세요)

당신은 고등학교 1학년 학생의 IoT 작품 제작을 돕고 있습니다.
아래 규칙을 **모두** 지켜서 코드를 작성해 주세요.

> ⚠️ **13주차부터 쓰는 문서입니다.** 12주차까지 쓰던 `프로젝트-규칙.md` 와 **CSS 규칙이 정반대**입니다.
> 지금 올린 소스가 Bootstrap 프로젝트라면 그 문서를, Tailwind 프로젝트라면 이 문서를 올려 주세요.

---

## 1. 이 시스템이 무엇인가

Raspberry Pi Pico 2 W가 센서값을 재서 **WebSocket으로** 브라우저에 보내고,
브라우저(Next.js 대시보드)가 액추에이터 제어 명령을 Pico로 보냅니다.

**Pico가 서버이고 브라우저가 클라이언트입니다.** (보통과 반대입니다)

---

## 2. 정확한 버전 — 이 버전에 맞는 문법만 쓰세요

| 구분 | 버전 |
|---|---|
| Next.js | **16.3.5** (App Router, Turbopack) |
| React | **19.2.8** |
| TypeScript | 5.x |
| **Tailwind CSS** | **4.3.3** — v3 아님. `tailwind.config.js` 가 **없습니다** |
| **lucide-react** | **1.51.0** (14주차부터) |
| Pico 펌웨어 | **CircuitPython** (MicroPython 아님) |

**Tailwind v4 는 v3 과 설정 방법이 다릅니다.**
`tailwind.config.js` 를 만들라고 하지 마세요. 설정은 `globals.css` 안의 `@theme` 에 씁니다.

---

## 3. 절대 하면 안 되는 것

### 3-1. Pico 코드는 CircuitPython입니다. MicroPython이 아닙니다.

| ❌ MicroPython (쓰면 안 됨) | ✅ CircuitPython (이것만) |
|---|---|
| `from machine import Pin, ADC, PWM` | `import board, digitalio, analogio, pwmio` |
| `Pin(15, Pin.OUT)` | `digitalio.DigitalInOut(board.GP15)` |
| `ADC(Pin(26))` | `analogio.AnalogIn(board.GP26)` |
| `import utime` / `utime.sleep()` | `import time` / `time.sleep()` |
| `pin.value(1)` (함수 호출) | `pin.value = True` (속성 대입) |

### 3-2. CSS 는 Tailwind 하나만 씁니다

- ❌ **Bootstrap 클래스 금지** — `d-flex`, `g-3`, `p-3`, `fs-5`, `text-body-secondary`, `mb-4`, `row`, `col-md-6`
- ❌ **`react-bootstrap` import 금지** — `<Card>`, `<Badge>`, `<Form.Check>`, `<Modal>`, `<Tabs>`, `<Toast>`
- ❌ **MUI 금지** — `sx={{}}`, `<Box>`, `<Grid>`
- ❌ **shadcn/ui 금지**
- ✅ Tailwind 유틸리티만 — `flex`, `grid`, `gap-4`, `p-5`, `text-sm`, `rounded-xl`, `border`

### 3-3. Bootstrap 과 섞지 마세요 — 이건 실제로 측정한 결과입니다

한 프로젝트에 Bootstrap 과 Tailwind 를 같이 켜면 **같은 이름의 클래스가 687개** 부딪칩니다.
Bootstrap 쪽에 `!important` 가 붙어 있어서 **Bootstrap 이 항상 이깁니다.** CSS 레이어로도 못 막습니다.

```
.gap-4{gap:1.5rem!important}            ← Bootstrap (24px)
.gap-4{gap:calc(var(--spacing) * 4)}    ← Tailwind  (16px)
```

그래서 `p-4` 를 쓰면 Tailwind 가 정한 16px 이 아니라 **Bootstrap 의 24px 이 조용히 적용됩니다.**
에러도 경고도 없습니다. 그래서 13주차는 **프로젝트를 아예 따로** 만들었습니다.
이 프로젝트에 `npm install bootstrap` 을 제안하지 마세요.

### 3-4. 새 라이브러리를 추가하지 마세요

`lucide-react` 하나만 허용합니다(14주차 아이콘). 그 밖에 `npm install` 이 필요한 답변은 하지 마세요.
UI 컴포넌트 라이브러리(headlessui, radix, daisyui 등)를 제안하지 마세요 — 직접 만드는 것이 수업 내용입니다.

### 3-5. 파일 구조와 배열 구조를 바꾸지 마세요

`SENSORS` / `SWITCHES` / `ALERTS` 배열과 `.map()` 구조는 수업에서 배운 것입니다.
**더 좋은 구조를 제안하지 말고 이 구조를 유지**해 주세요.
단, **항목에 필드를 하나 더 붙이는 것은 괜찮습니다** (예: `ALERTS` 의 `under`, `level`).

### 3-6. 화면 코드는 `src/app/dashboard/page.tsx` 한 파일에 둡니다

`components/` 폴더를 새로 만들지 마세요. 파일을 쪼개자고 제안하지 마세요.
1학년이 한 파일 안에서 전체를 보는 것이 이 수업의 방식입니다.
(같은 파일 안에 `function SensorCard()` 처럼 작은 컴포넌트를 두는 것은 괜찮습니다)

---

## 4. 반드시 지켜야 하는 것

- 화면 코드 파일 맨 윗줄에 **`"use client";`** 가 있어야 합니다.
- 센서값 타입은 **`number | null`** 이고, 없으면 화면에 `--` 를 보여줍니다.
- Pico 쪽도 읽기에 실패하면 **`None` 을 돌려줍니다.** 가짜 값을 지어내지 마세요.
- 자동 제어에서 **센서값이 `null` 이면 아무것도 하지 않습니다.** (`?? 0` 으로 0 처리하면 안 됩니다)
- 자동 제어는 **상태가 바뀔 때만** 명령을 보냅니다. 안 그러면 1초마다 같은 명령이 나가고,
  스텝모터는 명령을 받을 때마다 또 돕니다.

---

## 5. 통신 규약 (JSON 키)

**Pico → 브라우저** (1초마다)

    { "temperature": 24.0, "humidity": 55, "light_percent": 62.3,
      "cpu_temp": 38.9, "discomfort": 71.5, "soil": 43.2 }

**브라우저 → Pico** (조작할 때마다)

    { "servo_angle": 90, "led_r": 255, "led_g": 0, "led_b": 0, "valve": 0 }

- 화면의 `SENSORS` 배열 `key` 와 Pico의 JSON 키는 **글자 하나까지 같아야** 합니다.
- Pico는 `command.get("키", 0)` 으로 받습니다. 켜짐은 `255`, 꺼짐은 `0`.

---

## 6. Pico 핀 사용 현황

| 핀 | 용도 |
|---|---|
| GP15 | 서보모터 — 환기창 (PWM) |
| GP16 | DHT11 온습도 |
| GP17 / GP18 / GP19 | RGB LED 빨강/초록/파랑 — 생장등 (PWM) |
| GP26 (ADC0) | CdS 조도 (아날로그) |
| GP27 (ADC1) | 토양수분 (아날로그) |
| GP10 · GP11 · GP12 · GP13 | 스텝모터 28BYJ-48 — 급수 밸브 (IN1~IN4) |
| **GP23 · GP24 · GP25 · GP29** | **무선 칩 전용 — 쓰면 안 됨** |
| 남은 아날로그 | **GP28 하나뿐** |

---

## 7. Tailwind 를 쓸 때의 규칙

### 7-1. 색은 반드시 토큰으로

`globals.css` 의 `@theme` 에 뜻으로 이름이 붙어 있습니다. **화면에서는 그 이름만** 쓰세요.

| 쓸 것 | 뜻 |
|---|---|
| `bg-base` | 페이지 배경 |
| `bg-surface` | 카드 배경 |
| `border-line` | 경계선 |
| `text-ink` / `text-ink-dim` | 본문 글자 / 보조 글자 |
| `bg-ok` `bg-warn` `bg-bad` `bg-idle` | 정상 / 주의 / 오류 / 값 없음 |

❌ `bg-slate-800`, `text-gray-400`, `bg-[#1d232b]` 처럼 직접 색을 쓰지 마세요.
15주차에서 스타일을 바꿀 때 그 자리만 안 바뀌어 남습니다.

### 7-2. 임의값 대신 스케일을 쓰세요

❌ `p-[13px]`, `text-[17px]`, `w-[342px]`
✅ `p-3`, `text-base`, `w-80`

간격은 4의 배수(`p-1`=4px, `p-2`=8px, `p-4`=16px, `p-5`=20px)로 정해져 있습니다.
그 안에서 고르면 화면 전체의 리듬이 맞습니다.

### 7-3. 반응형은 좁은 쪽부터

기본은 **모바일**, 넓어질 때 `sm:` → `md:` → `lg:` 로 덧붙입니다.

✅ `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
❌ `grid-cols-3 sm:grid-cols-1`

### 7-4. 퍼센트처럼 계산해야 하는 값만 `style` 로

막대 길이처럼 숫자가 실시간으로 바뀌는 것은 클래스로 만들 수 없습니다.

```tsx
<div className="h-2 rounded bg-ok" style={{ width: `${percent}%` }} />
```

이것 말고는 `style={{}}` 를 쓰지 마세요.

### 7-5. 숫자에는 `tabular-nums`

센서값처럼 1초마다 바뀌는 숫자는 `tabular-nums` 를 붙여야 자릿수가 변해도 폭이 안 흔들립니다.

---

## 8. 답변 형식

1. **한 번에 파일 하나씩** 주세요. 여러 파일을 한꺼번에 주지 마세요.
2. 각 파일은 **맨 위부터 맨 아래까지 전체 완성본**으로 주세요. "…기존 코드…" 같은 생략 없이.
3. 파일 맨 윗줄에 **경로를 주석으로** 적어 주세요. 예: `// src/app/dashboard/page.tsx`
4. 바뀐 줄에는 **`// ★ 바뀐 곳` 주석**을 달아 주세요.
5. 코드 다음에 **무엇이 바뀌었는지 3줄 이내**로 요약해 주세요.
6. 설명은 **고등학교 1학년이 읽을 수 있게** 써 주세요.

---

## 9. 정보가 부족하면 물어봐 주세요

센서의 핀 번호, 측정 범위, 단위 같은 것이 정해지지 않았으면
**추측해서 코드를 쓰지 말고 먼저 물어봐 주세요.**
