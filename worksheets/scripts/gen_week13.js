// 13주차 학생 워크시트 — Tailwind CSS로 다시 그리기 (구조와 글자)
const L = require("./ws_lib.js");
const {
  h1, h2, p, fillLine, checklist, quoteBox, table, writeBox,
  recordTable, codeLine, codeBlock, spacer, pageBreak, hintList, cover, save,
} = L;

save([
  ...cover(
    "13주차 학생 워크시트",
    "Tailwind CSS로 다시 그리기 — 구조와 글자",
    "같은 스마트팜 화면을 CSS 프레임워크만 바꿔 다시 그립니다. 12주차까지 쓰던 Bootstrap 프로젝트는 건드리지 않고, 옆에 새 프로젝트를 만들어 두 화면을 나란히 켜고 비교합니다. 통신 코드는 한 글자도 바꾸지 않습니다 — 오늘 바뀌는 것은 보이는 부분뿐입니다."
  ),

  // 1. 학습 목표
  h1("1. 학습 목표"),
  ...checklist([
    "Bootstrap 부품(Card, Badge, Form.Check)이 하던 일을 Tailwind 클래스로 직접 만들 수 있다.",
    "grid / grid-cols-* / gap-* / col-span-* 으로 Bento Grid 배치를 만들 수 있다.",
    "정보의 중요도에 따라 글자 크기와 굵기를 다섯 단으로 나눌 수 있다.",
    "@theme 에 색 토큰을 정의하고, 화면에서는 뜻으로 지은 이름만 쓸 수 있다.",
  ]),

  // 2. 새 프로젝트
  h1("2. 새 프로젝트 만들기 — 왜 따로 만드는가"),
  p("12주차까지 쓰던 프로젝트는 그대로 둡니다. 전시회 때 돌아갈 안전망입니다.", { bold: true }),
  spacer(120),
  codeBlock(
    [
      codeLine(['npx create-next-app@latest iot-tailwind --typescript --app --eslint --tailwind --src-dir --import-alias "@/*"']),
      codeLine(["cd iot-tailwind"]),
      codeLine(["npm run dev -- -p 3001   ", { comment: "# Bootstrap 쪽은 3000 번 그대로" }]),
    ],
    "터미널"
  ),
  spacer(160),
  p("왜 한 프로젝트에 같이 넣으면 안 되는가 — 실제로 재 본 결과입니다."),
  table(
    ["쓴 클래스", "Tailwind 가 정한 값", "섞었을 때 실제로 적용된 값"],
    [
      ["p-4", "16px", "24px  ← Bootstrap 값"],
      ["gap-4", "16px", "24px"],
      ["text-3xl (제목)", "30px", "40px"],
      ["rounded-lg (버튼)", "8px", "0px"],
    ],
    [2600, 3200, 3550]
  ),
  spacer(120),
  quoteBox(
    "Bootstrap 유틸리티에는 !important 가 붙어 있어서 CSS 레이어로도 못 막습니다. 이름이 겹칠 수 있는 것이 687개입니다. 에러도 경고도 없이 숫자만 조용히 달라집니다 — 그래서 섞지 않고 옆에 새로 짓습니다."
  ),
  spacer(160),
  h2("준비 확인"),
  ...checklist([
    "iot-tailwind 프로젝트를 만들고 3001 번으로 띄웠다",
    "src/app/globals.css 를 globals-step0.css 내용으로 통째로 바꿨다 (배경이 어두워진다)",
    "page_smartfarm_bootstrap.tsx 를 3000 번 쪽에 넣어 화면이 뜨는 것을 확인했다",
    "가상 Pico(mock_pi_11.py)를 켜고 창에 add soil 0 100 을 쳤다",
  ]),
  spacer(120),
  p("오늘 내내 두 창을 나란히 놓고 씁니다. 왼쪽 3000(Bootstrap) / 오른쪽 3001(Tailwind).", { italics: true }),

  // 3. 실습 1 Layout
  h1("3. 실습 1 · Layout — Bento Grid"),
  p("page_week13_step1.tsx 를 src/app/dashboard/page.tsx 에 통째로 붙여넣으세요."),
  spacer(120),
  h2("격자를 만드는 줄은 이것 하나입니다"),
  codeBlock(
    [
      codeLine(['<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">']),
      codeLine([""]),
      codeLine([{ comment: "# grid-cols-1  : 좁을 때 한 줄에 한 장" }]),
      codeLine([{ comment: "# sm:grid-cols-2 : 640px 부터 두 장" }]),
      codeLine([{ comment: "# lg:grid-cols-3 : 1024px 부터 세 장" }]),
      codeLine([{ comment: "# gap-4        : 카드 사이 간격 16px" }]),
    ],
    "src/app/dashboard/page.tsx"
  ),
  spacer(160),
  h2("Bootstrap 과 비교해 보세요"),
  table(
    ["Bootstrap 에서는", "Tailwind 에서는"],
    [
      ["<Row className=\"g-3\"> + <Col xs={12} sm={6} lg={4}>", "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"],
      ["부품 두 개(Row, Col)를 가져다 쓴다", "클래스 네 개로 직접 적는다"],
      ["12칸을 몇 칸 쓸지 적는다 (12 / 6 / 4)", "몇 열인지 직접 적는다 (1 / 2 / 3)"],
    ],
    [4400, 4950]
  ),
  spacer(160),
  h2("주인공 카드 — 한 장만 두 칸을 차지하게"),
  p("SENSORS 배열의 맨 앞(토양수분)이 주인공입니다. 카드에 이 클래스가 붙습니다."),
  codeBlock([codeLine([{ blank: "①", len: 14 }, "    ", { comment: "# 작은 화면에서는 그대로, sm 부터 두 칸" }])]),
  ...hintList(["① 두 칸을 차지하라는 뜻의 클래스입니다. col- 로 시작하고, sm: 접두사가 붙습니다."]),
  spacer(160),
  h2("확인하고 적기"),
  p("브라우저 폭을 줄였다 늘렸다 하면서 세 가지 상태를 모두 보세요."),
  recordTable(["창 폭", "한 줄에 카드 몇 장인가", "주인공 카드는 몇 칸인가"], 3, [2400, 3500, 3450]),
  p("(좁게 / 중간 / 넓게 세 줄을 채우세요)", { italics: true }),
  spacer(120),
  fillLine("→ 우리 팀 작품의 주인공 센서는:", 30),
  fillLine("→ 왜 그 센서인가:", 44),

  // 4. 실습 2 Typography
  h1("4. 실습 2 · Typography — 글자 위계"),
  p("page_week13_step2.tsx 로 바꿔 붙여넣으세요. 구조는 그대로이고 글자 클래스만 달라집니다.", { bold: true }),
  spacer(120),
  h2("중요한 순서대로 다섯 단"),
  table(
    ["단", "무엇", "쓴 클래스"],
    [
      ["①", "대시보드 제목", "text-2xl font-bold tracking-tight"],
      ["②", "섹션 제목 (액추에이터 등)", "text-sm font-semibold"],
      ["③", "센서 이름", "text-xs uppercase tracking-wider"],
      ["④", "센서 값", "text-4xl font-semibold tabular-nums (주인공은 text-6xl)"],
      ["⑤", "단위 · 보조 설명", "text-sm text-slate-400"],
    ],
    [700, 2900, 5750]
  ),
  spacer(160),
  h2("오늘의 숨은 주인공 — tabular-nums"),
  p("센서값은 1초마다 바뀝니다. 8.3 → 31.5 처럼 자릿수가 달라질 때 숫자 폭이 변하면 화면이 덜컹거립니다."),
  spacer(120),
  p("직접 확인하세요. 값 클래스에서 tabular-nums 만 지우고 30초 동안 보세요.", { bold: true }),
  recordTable(["tabular-nums", "숫자가 바뀔 때 어떻게 보이나"], 2, [2600, 6750]),
  p("(있을 때 / 없을 때 두 줄을 채우세요)", { italics: true }),
  spacer(160),
  h2("왜 ③ 센서 이름은 작은데도 눈에 띄는가"),
  p("크기를 키우지 않고 구분하는 방법이 있습니다. 코드를 보고 생각해 보세요.", { italics: true }),
  writeBox(3),

  // 5. 실습 3 Color
  h1("5. 실습 3 · Color — 색에 뜻으로 이름 붙이기"),
  p("globals.css 를 globals-step3.css 로, page.tsx 를 page_week13_step3.tsx 로 바꿉니다."),
  spacer(120),
  h2("색 이름을 한 곳에 모읍니다"),
  codeBlock(
    [
      codeLine(["@theme {"]),
      codeLine(["  ", { comment: "# 스타일마다 바뀌는 것 — 15주차에서 이 다섯 줄만 갈아끼운다" }]),
      codeLine(["  --color-base:    #14181c;   ", { comment: "# 페이지 배경" }]),
      codeLine(["  --color-surface: #1d232b;   ", { comment: "# 카드 배경" }]),
      codeLine(["  --color-line:    #2b323b;   ", { comment: "# 경계선" }]),
      codeLine(["  --color-ink:     #e9ebec;   ", { comment: "# 본문 글자" }]),
      codeLine(["  --color-ink-dim: #8b929b;   ", { comment: "# 보조 글자" }]),
      codeLine([""]),
      codeLine(["  ", { comment: "# 뜻이 정해진 것 — 바꾸지 않는다" }]),
      codeLine(["  --color-ok:   ", { blank: "②", len: 9 }, "  ", { comment: "# 정상" }]),
      codeLine(["  --color-warn: ", { blank: "③", len: 9 }, "  ", { comment: "# 주의" }]),
      codeLine(["  --color-bad:  ", { blank: "④", len: 9 }, "  ", { comment: "# 오류" }]),
      codeLine(["  --color-idle: #4c5560;      ", { comment: "# 값 없음 · 비활성" }]),
      codeLine(["}"]),
    ],
    "src/app/globals.css"
  ),
  ...hintList([
    "②③④ 는 globals-step3.css 를 보고 그대로 옮겨 적으세요.",
    "--color-ink 라고 적으면 Tailwind 가 text-ink / bg-ink / border-ink 를 자동으로 만들어 줍니다. 이름만 지으면 됩니다.",
  ]),
  spacer(160),
  h2("아홉 개가 두 무리로 나뉩니다 — 이 구분이 15주차의 바탕입니다"),
  table(
    ["무리", "이름", "15주차에서"],
    [
      ["모양", "base · surface · line · ink · ink-dim", "값을 갈아끼운다 (스타일 4종)"],
      ["뜻", "ok · warn · bad · idle", "바꾸지 않는다"],
    ],
    [1300, 4800, 3250]
  ),
  spacer(120),
  quoteBox(
    "bg-slate-800 처럼 직접 색을 쓰면 안 되는 이유가 여기 있습니다. 15주차에서 스타일을 바꿀 때 그 자리만 안 바뀌고 남습니다. 뜻으로 이름을 붙여 두면 한 곳만 고쳐도 화면 전체가 따라옵니다."
  ),
  spacer(160),
  h2("확인 — 경고가 뜨면 카드 색이 바뀌는가"),
  p("가상 Pico 창에서 두 가지를 쳐 보세요."),
  table(
    ["창에 치는 것", "어느 카드가", "무슨 색으로"],
    [
      ["h", "온도", ""],
      ["add soil 0 15", "토양수분", ""],
      ["(둘 다 친 뒤) 불쾌지수 카드는", "불쾌지수", ""],
      ["fail soil", "토양수분", ""],
    ],
    [3000, 2400, 3950]
  ),
  p("(오른쪽 두 칸을 눈으로 보고 채우세요)", { italics: true }),
  spacer(120),
  p("색을 고르는 코드는 if 문이 아니라 표입니다. 왜 이렇게 썼을까요?", { bold: true }),
  codeBlock([
    codeLine(['const bar = missing ? "bg-idle" : { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[status];']),
  ]),
  writeBox(3),

  // 6. 트러블슈팅
  h1("6. 트러블슈팅"),
  table(
    ["증상", "점검 순서"],
    [
      [
        "스위치를 눌러도 손잡이가 안 움직인다",
        "peer-checked: 는 형제 요소에만 걸립니다. 손잡이를 자식 <span> 으로 만들면 안 걸립니다. after: 로 가짜 요소를 쓰세요 — step1 파일의 스위치 부분과 대조",
      ],
      [
        "bg-surface 같은 클래스가 안 먹는다",
        "globals.css 를 globals-step3.css 로 바꿨는지 확인. @theme 블록이 @import \"tailwindcss\"; 아래에 있어야 합니다",
      ],
      [
        "배경이 하얗다",
        "globals.css 를 교체하지 않고 create-next-app 기본값을 쓰고 있습니다. globals-step0.css 내용으로 통째로 바꾸세요",
      ],
      [
        "카드가 한 줄에 하나씩만 나온다",
        "창이 좁은 것입니다. sm: 는 640px, lg: 는 1024px 부터입니다. 브라우저를 넓혀 보세요",
      ],
      [
        "막대가 안 보이거나 폭이 안 변한다",
        "퍼센트는 클래스로 못 만듭니다. style={{ width: `${percent}%` }} 가 있는지 확인",
      ],
      [
        "값이 계속 -- 로 나온다",
        "가상 Pico 가 꺼져 있거나 IP 가 다릅니다. 같은 PC 면 127.0.0.1. soil 은 창에 add soil 0 100 을 쳐야 들어옵니다",
      ],
      [
        "Bootstrap 쪽(3000) 화면이 이상해졌다",
        "Tailwind 프로젝트를 따로 만들었다면 영향이 없습니다. 같은 프로젝트에 설치했는지 확인하세요",
      ],
    ],
    [3400, 5950]
  ),

  // 7. 마무리
  h1("7. 마무리 정리"),
  h2("자가 점검"),
  ...checklist([
    "Bootstrap 프로젝트를 건드리지 않고 새 프로젝트에서 작업했다",
    "통신 코드(openSocket, sendCommand, 자동 제어)를 한 글자도 바꾸지 않은 것을 확인했다",
    "grid-cols-* 와 gap-* 으로 격자를 만들고, 주인공 카드를 두 칸으로 만들었다",
    "글자 다섯 단을 구분해서 적용했다",
    "tabular-nums 를 빼 보고 숫자가 덜컹거리는 것을 눈으로 봤다",
    "색 토큰 아홉 개를 @theme 에 적고, 화면에서는 토큰 이름만 썼다",
    "경고가 뜰 때 카드 테두리와 막대 색이 바뀌는 것을 확인했다",
    "두 화면(3000 / 3001)을 나란히 켜고 비교했다",
  ]),
  spacer(200),
  h2("부품을 가져다 쓰는 것과 직접 만드는 것 — 무엇이 달랐나"),
  p("오늘 Bootstrap 의 Card · Badge · Form.Check 를 직접 만들어 봤습니다. 좋았던 점과 번거로웠던 점을 각각 써 보세요.", { italics: true }),
  writeBox(4),
  spacer(200),
  h2("다음 주 예고"),
  quoteBox(
    "14주차에서는 아이콘(lucide-react)을 붙이고, 휴대폰 폭에서도 깨지지 않게 다듬고, 누를 때·초점이 갔을 때·연결이 끊겼을 때 화면이 어떻게 반응할지 정합니다. 오늘 만든 색 토큰을 그대로 씁니다."
  ),
], "13주차_학생워크시트.docx");
