# 9주차 · 센서를 몇 개든 늘리기 — 단계별 전체 코드

노션 교재 **「9주차 · 센서를 몇 개든 늘리기 — 배열과 JSON 키」** 에 실린 코드 원본입니다.
`.tsx` 파일은 `src/app/dashboard/page.tsx` 에 통째로 붙여넣는 완성본입니다.

| 파일 | 단계 | 내용 |
|---|---|---|
| `step01.tsx` | 1 | SENSORS 배열 + `.map()` — 화면은 8주차와 동일 |
| `main_week9.py` | 2 | **Pico** — `cpu_temp`, `discomfort` 두 키 추가 (화면 변화 없음) |
| `step03.tsx` | 3 | 배열에 두 줄 추가 → 카드 5장 |
| `step04.tsx` | 4 | 액추에이터도 배열로 — R/G/B 스위치 3개 (3비트 진리표) |
| `step05.tsx` | 5 | 경고 규칙도 배열로 — `.filter()` + `.map()` |
| `step06.tsx` | 6 | 센서 하나가 죽어도 안 깨지게 (완성본) |

## 2단계에서 늘어나는 센서 두 개 — 부품 0원

- **`cpu_temp`** — `microcontroller.cpu.temperature` (RP2350 칩 내장). 칩이 스스로 열을 내므로 방 온도보다 높게 나오는 것이 정상.
- **`discomfort`** — 불쾌지수. 온도·습도로 계산한다.
  `DI = 0.81 × T + 0.01 × H × (0.99 × T − 14.3) + 46.3`
  (68 미만 쾌적 / 68~75 보통 / 75~80 다소 불쾌 / 80 이상 매우 불쾌)

## 검증 결과 (2026-09-19)

- 환경: Next.js 16.3.5 / React 19.2.8 / react-bootstrap 2.10.10 / bootstrap 5.3.8
- **화면 코드 5벌 전부 TypeScript 타입 오류 0건 / 콘솔 오류·경고 0건**
- `step06.tsx` 기준 **프로덕션 빌드 성공**
- 스위치 3비트 조합 전송 확인: 빨강+초록 → `{"servo_angle":90,"led_r":255,"led_g":255,"led_b":0}`
- 경고 2개 동시 표시 확인 (온도 31.5 / 불쾌지수 86.2)
- DHT11 고장 재현 시 **온도·습도·불쾌지수 세 장만 "값 없음"**, 조도·칩 온도는 정상 동작
- **6단계 버그 실증** — 조도값이 `null`일 때 자동 모드 동작:
  - 5단계 코드(`?? 0`) → 스위치 3개가 전부 **켜짐** (잘못된 동작)
  - 6단계 코드(null 확인) → 3개 모두 **꺼진 채 유지** (정상)

## 모의 Pico 서버

`mock-pico9.js` 는 9주차 Pico(센서 5개)와 같은 프로토콜입니다.

```bash
node mock-pico9.js                # 보통
MODE=hot     node mock-pico9.js   # 온도 31.5 / 습도 85 — 경고 2개 동시
MODE=dark    node mock-pico9.js   # 조도 18 — 자동 모드
MODE=broken  node mock-pico9.js   # DHT11 고장 — 온도/습도/불쾌지수 null
MODE=nolight node mock-pico9.js   # 조도 센서 고장 — 6단계 버그 재현용
```

## 화면 캡처

`../worksheets/screenshots/9주차_배열/` 에 단계별 실행 화면이 있습니다.
