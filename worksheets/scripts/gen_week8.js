// 8주차 학생 워크시트 — Bootstrap 부품 10개, 하나씩 넣고 확인하기
const L = require("./ws_lib.js");
const {
  h1, h2, p, fillLine, checklist, quoteBox, table, writeBox,
  recordTable, codeLine, codeBlock, spacer, pageBreak, hintList, cover, save,
} = L;

save([
  ...cover(
    "8주차 학생 워크시트",
    "Bootstrap 부품 10개 — 하나씩 넣고 확인하기",
    "3주차까지 만든 화면은 동작은 하지만 투박합니다. 그렇다고 한꺼번에 예쁘게 고쳐 버리면 화면은 좋아지지만 어떤 요소가 무엇을 했는지 구분할 수 없게 됩니다. 그러면 나중에 내 작품에 골라 쓸 수가 없습니다. 오늘은 부품 하나를 넣고 → 화면을 보고 → 껐다 켜보고 → 한 줄 적습니다. 그걸 열 번 반복합니다."
  ),

  // 1. 학습 목표
  h1("1. 학습 목표"),
  p("이번 시간이 끝나면 나는 아래 네 가지를 할 수 있습니다."),
  ...checklist([
    "Bootstrap 부품 10개가 각각 무엇에 반응해서 화면을 바꾸는지 구분해서 설명할 수 있다.",
    "화면의 스위치가 Pico의 GPIO를 HIGH/LOW로 바꾸는 것임을 코드 수준에서 이해한다.",
    "센서값을 보고 프로그램이 스스로 액추에이터를 조작하는 자동화를 만들 수 있다.",
    "전시회 부스에서 관람객이 혼자 읽을 수 있는 화면의 조건을 안다.",
  ]),
  spacer(120),
  quoteBox(
    "이번 주부터 남은 네 번의 수업(8 · 9 · 11 · 12주차)은 11월 20일 작품 전시회로 이어집니다. 오늘 만드는 화면은 연습용이 아니라 여러분 작품의 출발점입니다."
  ),

  // 2. 오늘의 진행 방식
  h1("2. 오늘의 진행 방식 — 붙여넣기 전에 한 줄"),
  p(
    "코드는 전부 드려서 복사·붙여넣기로 진행합니다. 손이 빨라지는 대신 머리가 멈추기 쉽습니다. Ctrl+V를 열 번 누르고 끝나면 화면만 남고 아무것도 남지 않습니다."
  ),
  p("그래서 단계마다 세 줄을 적습니다. 30초면 됩니다. 이 세 줄이 오늘 수업의 본체이고, 코드 붙여넣기는 거기 딸린 작업입니다.", { bold: true }),
  table(
    ["언제", "무엇을 적나"],
    [
      ["붙여넣기 전", "이번 부품은 무엇에 반응할 것 같은가? (예상)"],
      ["붙여넣은 후", "실제로는 무엇이 달라졌나? (화면 / 동작)"],
      ["마지막", "우리 팀 작품에서는 어디에 쓸까?"],
    ],
    [2600, 6750]
  ),

  // 3. 준비
  h1("3. 준비"),
  h2("① 라이브러리 설치"),
  p("2주차에서 만든 iot-week2-api 프로젝트 폴더에서 터미널을 열고 실행합니다."),
  codeBlock([codeLine(["npm install react-bootstrap bootstrap"])]),
  p("3주차까지는 이 두 개를 설치하지 않았으므로, 이번 주에 처음 설치합니다."),
  spacer(120),

  h2("② globals.css 전체 교체 — 건너뛰면 안 됩니다"),
  quoteBox(
    "이 교체는 모든 팀이 반드시 해야 합니다. 2주차에서 create-next-app --tailwind 로 프로젝트를 만들었기 때문에, 지금 globals.css 맨 위에 @import \"tailwindcss\"; 가 들어 있습니다. Bootstrap과 Tailwind를 같이 켜면 .container 처럼 이름이 똑같은 클래스를 서로 다른 의미로 갖고 있어서, 원인을 찾기 어려운 레이아웃 깨짐이 생깁니다."
  ),
  spacer(120),
  ...checklist([
    "globals.css 를 교재의 내용으로 전부 덮어썼다",
    "다시 열어서 @import \"tailwindcss\"; 가 사라진 것을 눈으로 확인했다",
  ]),
  p(
    "참고로 3주차 트러블슈팅의 \"연결/적용 버튼이 안 보인다\" 도 같은 원인(Tailwind 기본 리셋)이었습니다. 이번 주에 Tailwind를 끄면 그 문제도 같이 사라집니다.",
    { italics: true }
  ),
  spacer(120),

  h2("③ layout.tsx 교체 — import 순서가 중요합니다"),
  codeBlock(
    [
      codeLine(["import \"bootstrap/dist/css/bootstrap.min.css\";  ", { comment: "// 반드시 먼저" }]),
      codeLine(["import \"./globals.css\";                          ", { comment: "// 나중" }]),
    ],
    "src/app/layout.tsx"
  ),
  p("순서가 바뀌면 내가 쓴 .sensor-value 가 Bootstrap에 덮여 무시됩니다."),
  spacer(120),

  h2("④ Pico와 서버"),
  ...checklist([
    "Pico 펌웨어는 이번 주에 하나도 바꾸지 않는다 (3주차 main.py 그대로)",
    "시리얼 모니터에서 Pico의 IP를 확인해 적어 두었다",
    "CSS import가 바뀌었으므로 dev 서버를 Ctrl+C 로 끄고 다시 실행했다",
  ]),
  fillLine("→ 오늘 확인한 Pico IP:", 34),

  // 4. 단계 기록
  h1("4. 단계별 기록 — 오늘 수업의 본체"),
  p("0단계는 3주차에서 완성한 화면 그대로입니다. 1단계부터 부품을 하나씩 넣습니다."),
  p("각 단계마다 붙여넣기 전에 \"예상\"을 먼저 쓰세요. 틀려도 됩니다. 틀린 예상을 고치는 순간이 배우는 순간입니다.", { bold: true }),
  spacer(160),

  ...[
    ["1", "Card + Flex", "아무것에도 (기준점)"],
    ["2", "Row / Col", "창 폭"],
    ["3", "Badge", "연결 상태"],
    ["4", "ProgressBar", "센서값"],
  ].flatMap(([n, part, reacts]) => [
    h2(`${n}단계 · ${part}`),
    p(`무엇에 반응하는가 (교재 기준): ${reacts}`, { italics: true, keepNext: true }),
    recordTable(["붙여넣기 전 — 예상", "붙여넣은 후 — 실제로 달라진 것", "우리 팀 작품에서는?"], 1, [3100, 3400, 2850]),
    spacer(160),
  ]),

  ...[
    ["5", "Switch + Range", "사용자 조작 · 센서값"],
    ["6", "Alert", "값이 임계를 넘을 때"],
    ["7", "Toast", "사건 1회"],
    ["8", "Tabs", "클릭 (갈아끼움)"],
  ].flatMap(([n, part, reacts]) => [
    h2(`${n}단계 · ${part}`),
    p(`무엇에 반응하는가 (교재 기준): ${reacts}`, { italics: true, keepNext: true }),
    recordTable(["붙여넣기 전 — 예상", "붙여넣은 후 — 실제로 달라진 것", "우리 팀 작품에서는?"], 1, [3100, 3400, 2850]),
    spacer(160),
  ]),

  ...[
    ["9", "Modal", "클릭 (위에 띄움)"],
    ["10", "display / fs 유틸", "아무것에도 (전시용 큰 글씨)"],
  ].flatMap(([n, part, reacts]) => [
    h2(`${n}단계 · ${part}`),
    p(`무엇에 반응하는가 (교재 기준): ${reacts}`, { italics: true, keepNext: true }),
    recordTable(["붙여넣기 전 — 예상", "붙여넣은 후 — 실제로 달라진 것", "우리 팀 작품에서는?"], 1, [3100, 3400, 2850]),
    spacer(160),
  ]),

  spacer(200),

  // 5. 동작 확인
  h1("5. 동작 확인 체크리스트"),
  p("단계를 다 마친 뒤, 아래를 직접 해보고 표시하세요."),
  ...checklist([
    "창 폭을 좁혔다 넓혔다 하면 카드가 가로 → 세로로 바뀐다 (2단계)",
    "Pico 연결을 끊으면 Badge 색과 글자가 바뀐다 (3단계 — 가상 Pico는 창에서 x)",
    "CdS를 손으로 가리면 ProgressBar 길이가 줄어든다 (4단계)",
    "화면의 스위치를 누르면 Pico의 RGB LED가 실제로 켜지고 꺼진다 (5단계)",
    "자동 모드를 켜고 조도를 낮추면 사람이 누르지 않아도 LED가 켜진다 (5단계)",
    "온도를 높이면 Alert가 나타나고, 내리면 사라진다 (6단계)",
    "명령을 보낼 때마다 Toast가 한 번 떴다 사라진다 (7단계)",
    "탭을 눌러 모니터 / 제어 화면을 갈아끼울 수 있다 (8단계)",
    "\"이 작품은?\" 버튼으로 Modal이 뜨고 닫힌다 (9단계)",
    "의자를 뒤로 밀고 2m 떨어져도 센서 숫자가 읽힌다 (10단계)",
  ]),

  // 6. 생각해보기
  h1("6. 생각해보기"),
  p("1) 1단계(Card + Flex)와 10단계(display/fs)는 둘 다 \"아무것에도 반응하지 않는\" 부품입니다. 그런데도 왜 넣을까요?"),
  writeBox(3),
  spacer(160),
  p("2) 6단계 Alert와 7단계 Toast는 둘 다 \"알려주는\" 부품입니다. 무엇이 다릅니까? 우리 팀 작품에서 각각 어디에 쓰면 좋을까요?"),
  writeBox(4),
  spacer(160),
  p("3) 화면의 스위치를 누르면 Pico의 LED가 켜집니다. 그 사이에 무슨 일이 일어나는지 순서대로 적어 보세요. (힌트: JSON, WebSocket, GPIO)"),
  writeBox(4),

  // 7. 트러블슈팅
  h1("7. 트러블슈팅"),
  table(
    ["증상", "점검 순서"],
    [
      ["Module not found: react-bootstrap", "npm install react-bootstrap bootstrap 을 프로젝트 폴더에서 실행했는지 확인"],
      ["레이아웃이 겹치고 여백이 제멋대로", "globals.css 에 @import \"tailwindcss\"; 가 남아 있지 않은지 확인 (3번 항목 ②)"],
      ["화면이 흰 배경으로 나온다", "layout.tsx 의 <html> 태그에 data-bs-theme=\"dark\" 가 있는지 확인"],
      ["내가 쓴 .sensor-value 가 안 먹힘", "layout.tsx 의 import 순서 — bootstrap.min.css 가 먼저, globals.css 가 나중"],
      ["You're importing a component that needs useState...", "파일 맨 윗줄에 \"use client\" 가 있는지 확인. 복사할 때 첫 줄이 잘리는 경우가 많습니다"],
      ["붙여넣었더니 import 가 두 번 나온다", "Ctrl+A 로 기존 내용을 전부 지우고 붙여넣어야 합니다"],
      ["스위치를 눌러도 LED가 안 켜짐", "시리얼 모니터에 [WS] 수신 메시지 가 뜨는지 먼저 확인 — 안 뜨면 브라우저 쪽, 뜨는데 안 움직이면 배선/핀"],
    ],
    [3200, 6150]
  ),

  // 8. 마무리
  h1("8. 마무리 정리"),
  h2("오늘 넣은 부품 중 우리 팀 작품에 꼭 쓸 것 세 개"),
  recordTable(["부품", "우리 작품에서 하는 일"], 3, [2800, 6550]),
  spacer(200),
  h2("오늘 배운 것을 한 문장으로"),
  writeBox(3),
  spacer(200),
  h2("다음 주 예고"),
  quoteBox(
    "9주차에서는 센서 개수가 정해지지 않은 화면을 만듭니다. 지금 코드는 온도·습도·조도 세 개를 각각 손으로 적어 두었지만, 팀마다 센서 개수가 다릅니다. 배열과 .map() 을 쓰면 배열에 한 줄만 추가해도 카드가 한 장 늘어납니다. 3주차 이후 처음으로 Pico 코드도 같이 고쳐서 JSON 키를 맞춥니다."
  ),
], "8주차_학생워크시트.docx");
