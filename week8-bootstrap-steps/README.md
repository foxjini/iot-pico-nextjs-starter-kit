# 8주차 · Bootstrap 부품 10개 — 단계별 전체 코드

노션 교재 **「8주차 · Bootstrap 부품 10개 — 하나씩 넣고 확인하기」** 에 실린 코드 원본입니다.
각 파일은 `src/app/dashboard/page.tsx` 에 **통째로 붙여넣는 완성본**입니다 (부분 삽입 아님).

| 파일 | 단계 | 넣는 부품 | 무엇에 반응하는가 |
|---|---|---|---|
| `step00.tsx` | 0 | (출발점 — 3주차 화면) | — |
| `step01.tsx` | 1 | Card + Flex 유틸 | 아무것에도 (기준점) |
| `step02.tsx` | 2 | Row / Col | 창 폭 |
| `step03.tsx` | 3 | Badge | 연결 상태 |
| `step04.tsx` | 4 | ProgressBar | 센서값 |
| `step05.tsx` | 5 | Form.Check(switch) + Form.Range | 사용자 조작 · 센서값(자동 모드) |
| `step06.tsx` | 6 | Alert | 값이 임계를 넘을 때 |
| `step07.tsx` | 7 | Toast | 사건 1회 |
| `step08.tsx` | 8 | Tabs | 클릭 (갈아끼움) |
| `step09.tsx` | 9 | Modal ×2 | 클릭 (위에 띄움) |
| `step10.tsx` | 10 | display / fs 유틸 | 아무것에도 (전시용 큰 글씨) |

## 검증 결과 (2026-09-19)

- 환경: Next.js 16.3.5 / React 19.2.8 / react-bootstrap 2.10.10 / bootstrap 5.3.8
- **11개 파일 전부 TypeScript 타입 오류 0건**
- **브라우저 콘솔 오류·경고 0건** (11개 단계 각각 측정)
- `step10.tsx` 기준 **프로덕션 빌드 성공**
- 자동 모드 동작 확인:
  - 조도 18% → 꺼져 있던 LED가 스스로 켜짐, Pico가 `{"led_r":255,"led_g":136,"led_b":0,"servo_angle":90}` 수신
  - 조도 60% → 켜져 있던 LED가 스스로 꺼짐, Pico가 `{"led_r":0,"led_g":0,"led_b":0,"servo_angle":90}` 수신
  - 자동 모드 켜짐 상태에서 수동 스위치가 `disabled` 되는 것 확인

## 모의 Pico 서버

`mock-pico.js` 는 3주차 Pico WebSocket 서버와 **같은 프로토콜**을 흉내냅니다.
하드웨어 없이 화면만 확인할 때 씁니다.

```bash
npm install ws          # 최초 1회
node mock-pico.js              # 보통 (온도 24~27, 조도 40~80)
MODE=hot  node mock-pico.js    # 온도 31.5 — Alert 확인용
MODE=dark node mock-pico.js    # 조도 18   — 자동 모드 확인용
```

대시보드의 Pico IP 칸에 `localhost` 를 넣고 연결하면 됩니다.

## 화면 캡처

`../worksheets/screenshots/8주차_bootstrap/` 에 단계별 실행 화면이 있습니다.
