# 13주차 · Tailwind CSS로 다시 그리기 — 구조와 글자

노션 교재 **「13주차 · Tailwind CSS로 다시 그리기 — 구조와 글자」** 의 코드 원본입니다.

12주차까지 쓰던 Bootstrap 프로젝트는 **건드리지 않습니다.** 옆에 Tailwind 프로젝트를 새로 만들어
같은 스마트팜 화면을 다시 그립니다. 두 화면을 나란히 켜고 비교하는 것이 이 주차의 방식입니다.

## 학생에게 나눠줄 파일

| 파일 | 용도 |
|---|---|
| `page_smartfarm_bootstrap.tsx` | **출발점.** 11주차 스마트팜 완성본(Bootstrap). 팀마다 파일이 달라서 여기서 맞추고 시작합니다 |
| `globals-step0.css` | 새 프로젝트를 만든 직후 `src/app/globals.css` 를 **이것으로 통째로 교체** |
| `globals-step3.css` | 3단계에서 다시 교체 — `@theme` 색 토큰이 들어간 것 |
| `page_week13_step1.tsx` | **1단계 Layout** — Bento Grid |
| `page_week13_step2.tsx` | **2단계 Typography** — 글자 위계 5단 |
| `page_week13_step3.tsx` | **3단계 Color** — 의미 색 토큰 (13주차 완성본) |
| `프로젝트-규칙-tailwind.md` | **소스와 함께 제미나이에 업로드** — 13주차부터 쓰는 컨텍스트 문서 |
| `../worksheets/13주차_학생워크시트.docx` | 학생 워크시트 (생성기: `../worksheets/scripts/gen_week13.js`) |

각 `.tsx` 는 **통째로 복사해 붙이는 완성본**입니다. 전부 `src/app/dashboard/page.tsx` 로 들어갑니다.

## 새 프로젝트 만들기

```bash
npx create-next-app@latest iot-tailwind --typescript --app --eslint --tailwind --src-dir --import-alias "@/*"
cd iot-tailwind
npm run dev -- -p 3001
```

Bootstrap 프로젝트는 3000 번, Tailwind 프로젝트는 3001 번으로 띄워 두 창을 나란히 놓고 비교합니다.
`npm install` 은 하지 않습니다 — `--tailwind` 가 다 깔아 줍니다. (`lucide-react` 는 14주차에 한 번)

### 왜 한 프로젝트에 같이 안 넣는가

8주차에서 `globals.css` 의 `@import "tailwindcss";` 를 지우게 했던 이유가 그대로 유효합니다.
실제로 재 본 결과는 이렇습니다.

| 클래스 | Tailwind 가 정한 값 | 한 프로젝트에 섞었을 때 |
|---|---|---|
| `p-4` | 16px | **24px** (Bootstrap 값) |
| `gap-4` | 16px | **24px** |
| `h1.text-3xl` | 30px | **40px** |
| `button.rounded-lg` | 8px | **0px** |

Bootstrap 유틸리티에는 `!important` 가 붙어 있어서 **CSS 레이어로도 못 막습니다.**
이름이 겹칠 수 있는 Bootstrap 유틸리티가 **687개**입니다. 그래서 섞지 않고 옆에 새로 짓습니다.

## 세 단계

| 단계 | 배우는 것 | 확인 |
|---|---|---|
| 1 · Layout | `grid` `grid-cols-*` `gap-*` `sm:col-span-2` | 카드 여섯 장이 격자로 놓이고 **토양수분이 두 칸**을 차지하는가 |
| 2 · Typography | 크기·굵기 5단, `tabular-nums`, `tracking-wider` | 값이 바뀔 때 **숫자 폭이 안 흔들리는가** |
| 3 · Color | `@theme` 토큰, 뜻 → 색 | `h` 를 눌러 온도를 올리면 **카드 테두리가 빨갛게 바뀌는가** |

### Bootstrap 에서 버린 것

Tailwind 에는 탭·모달·토스트 부품이 없습니다. 직접 만들면 13주차 시간을 다 먹으므로 **한 화면으로 펼쳤습니다.**

| Bootstrap | Tailwind 쪽 |
|---|---|
| `Tabs` (모니터 / 제어) | 없앰 — 세로로 이어 붙임 |
| `Modal` 장치 설정 | 헤더에 IP 입력칸 인라인 |
| `Modal` 이 작품은? | **늘 보이는 설명 카드** — 전시회에서 관람객이 버튼을 안 눌러도 읽습니다 |
| `Toast` | 헤더 아래 한 줄 |
| `Form.Check type="switch"` | `peer sr-only` + `peer-checked:after:translate-x-5` 로 직접 만듦 |

**통신 코드(`openSocket` · `scheduleRetry` · `sendCommand` · 자동 제어)는 한 글자도 바꾸지 않았습니다.**
세 단계에서 바뀌는 것은 오직 보이는 부분입니다.

## 가상 Pico

`mock-pico/mock_pi_11.py` 를 그대로 씁니다.

| 창에 치는 것 | 확인하는 것 |
|---|---|
| `add soil 0 100` | 카드 여섯 장에 값이 들어오는가 (1단계) |
| `add soil 0 15` + `h` | 경고 세 개, 카드 테두리가 색으로 바뀌는가 (3단계) |
| `fail soil` | `--` 와 「값 없음」이 흐리게 나오는가 |
| `x` | 5초 뒤 저절로 ONLINE 으로 돌아오는가 |

## 검증 결과 (2026-10-03)

실제로 `create-next-app` 으로 프로젝트를 만들어 세 단계를 모두 올려 보고,
`mock_pi_11.py` 와 붙여 Chromium 으로 측정했습니다.

| 확인 | 결과 |
|---|---|
| 환경 | Next 16.3.5 / React 19.2.8 / **Tailwind 4.3.3** / lucide-react 1.51.0 |
| 타입 오류 · 프로덕션 빌드 | **0건 / 성공** (세 단계 모두) |
| 1단계 격자 | 3열 · `gap` 16px · 주인공 카드 741px vs 보통 363px → **두 칸 차지 확인** |
| 2단계 `tabular-nums` | 값이 바뀌어도 숫자 폭 고정 |
| 3단계 `@theme` 토큰 | `bg-surface` `border-bad` `border-warn` `bg-ok` `text-ink-dim` `bg-idle` 전부 생성됨 |
| 3단계 상태 색 | 토양수분·온도 `#d2605a`(bad) / 불쾌지수 `#d9a441`(warn) / 나머지 `#2b323b`(line)·`#4fa88f`(ok) |
| 수제 스위치 | 꺼짐 `translate: none` → 켜짐 `translate: 20px` — `peer-checked:after:` 동작 확인 |
| 자동 제어 | 밸브 열림(`soil 7.5 < 30`) · LED 꺼짐(`조도 78 > 40`) → **독립 규칙 확인** |
| 경고 `under` | `물 부족 — 현재 값 7.5 (20 이하)` 렌더, `over` 경고 두 개와 **동시에** 표시 |

스크린샷은 `worksheets/screenshots/13주차_tailwind/` 에 있습니다
(`w13-before-bootstrap.png` → `w13-step1-layout.png` → `w13-step3-color.png`).

## 선생님용 메모

- **스위치가 오늘의 가장 좋은 수업거리입니다.** `peer-checked:` 는 **형제 요소**에만 걸립니다.
  손잡이를 자식 `<span>` 으로 만들면 안 걸려서, 가짜 요소 `after:` 로 만들어야 합니다.
  학생이 자식으로 만들어 "안 움직여요" 할 때 이 설명을 해 주세요.
- **색 토큰 아홉 개 중 앞 다섯 개만 15주차에서 바뀝니다.** 뒤 네 개(ok/warn/bad/idle)는 뜻이
  정해져 있어 안 바꿉니다. 3단계에서 이 구분을 꼭 짚어 주세요 — 15주차가 여기에 얹힙니다.
- 11주차 스마트팜을 AI로 만든 결과가 팀마다 다릅니다. `page_smartfarm_bootstrap.tsx` 로
  **먼저 맞추고** 시작하세요. 특히 `ALERTS` 의 `under` 필드가 없는 팀이 많을 것입니다.
