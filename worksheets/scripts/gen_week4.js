const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, PageBreak, VerticalAlign,
} = require("docx");

const KFONT = "Malgun Gothic";
const CFONT = "Courier New";

// ---------- helpers (1~3주차 워크시트와 스타일 통일) ----------
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2F5496" } },
    children: [new TextRun({ text, bold: true, size: 30, font: KFONT, color: "1F3864" })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: KFONT, color: "2F5496" })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, ...(opts.spacing || {}) },
    children: [new TextRun({ text, font: KFONT, size: 21, bold: !!opts.bold, italics: !!opts.italics, ...opts.run })],
  });
}
function fillLine(label, blankWidth = 40) {
  return new Paragraph({
    spacing: { after: 200 },
    children: [
      new TextRun({ text: label + " ", font: KFONT, size: 21 }),
      new TextRun({ text: "_".repeat(blankWidth), font: KFONT, size: 21 }),
    ],
  });
}
function checklist(items) {
  return items.map(
    (t) =>
      new Paragraph({
        spacing: { after: 100 },
        indent: { left: 260 },
        children: [new TextRun({ text: "☐  " + t, font: KFONT, size: 21 })],
      })
  );
}
function quoteBox(text) {
  return new Table({
    width: { size: 9350, type: WidthType.DXA },
    borders: allBorders("BFBFBF"),
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 9350, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "EEF3FB" },
            margins: { top: 140, bottom: 140, left: 200, right: 200 },
            children: [new Paragraph({ children: [new TextRun({ text, font: KFONT, size: 20, italics: true, color: "1F3864" })] })],
          }),
        ],
      }),
    ],
  });
}
function allBorders(color) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}
function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 2000, type: WidthType.DXA },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: "2F5496" } : opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: opts.mono ? CFONT : KFONT,
            size: 20,
            bold: !!opts.header,
            color: opts.header ? "FFFFFF" : opts.textColor || "000000",
          }),
        ],
      }),
    ],
  });
}
function table(headers, rows, widths) {
  const w = widths || headers.map(() => Math.floor(9350 / headers.length));
  return new Table({
    width: { size: 9350, type: WidthType.DXA },
    borders: allBorders("BFBFBF"),
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((hd, i) => cell(hd, { header: true, width: w[i] })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, { width: w[i] })) })),
    ],
  });
}
function colorSwatchTable(rows) {
  // rows: [{name, hex, usage}]
  const w = [1750, 1300, 1600, 4700];
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      cell("이름", { header: true, width: w[0] }),
      cell("색상", { header: true, width: w[1] }),
      cell("값", { header: true, width: w[2] }),
      cell("용도", { header: true, width: w[3] }),
    ],
  });
  const dataRows = rows.map(
    (r) =>
      new TableRow({
        cantSplit: true,
        children: [
          cell(r.name, { width: w[0], mono: true }),
          new TableCell({
            width: { size: w[1], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: r.hex.replace("#", "") },
            children: [new Paragraph({ children: [new TextRun({ text: " ", size: 20 })] })],
          }),
          cell(r.hex, { width: w[2], mono: true }),
          cell(r.usage, { width: w[3] }),
        ],
      })
  );
  return new Table({
    width: { size: 9350, type: WidthType.DXA },
    borders: allBorders("BFBFBF"),
    rows: [headerRow, ...dataRows],
  });
}
function writeBox(lineCount = 5) {
  return new Table({
    width: { size: 9350, type: WidthType.DXA },
    borders: allBorders("BFBFBF"),
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 9350, type: WidthType.DXA },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: Array.from({ length: lineCount }, (_, i) =>
              new Paragraph({
                spacing: { after: 260 },
                border: i < lineCount - 1 ? { bottom: { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" } } : undefined,
                children: [new TextRun({ text: " ", font: KFONT, size: 21 })],
              })
            ),
          }),
        ],
      }),
    ],
  });
}
function recordTable(headers, emptyRowCount, widths) {
  const w = widths || headers.map(() => Math.floor(9350 / headers.length));
  const blankRow = headers.map(() => "");
  const rows = Array.from({ length: emptyRowCount }, () => blankRow);
  return new Table({
    width: { size: 9350, type: WidthType.DXA },
    borders: allBorders("BFBFBF"),
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((hd, i) => cell(hd, { header: true, width: w[i] })) }),
      ...rows.map(() =>
        new TableRow({
          cantSplit: true,
          children: headers.map((_, i) => new TableCell({
            width: { size: w[i], type: WidthType.DXA },
            margins: { top: 260, bottom: 260, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "", font: KFONT, size: 20 })] })],
          })),
        })
      ),
    ],
  });
}
function codeLine(segments, opts = {}) {
  const children = segments.map((seg) => {
    if (typeof seg === "object" && seg.blank) {
      return new TextRun({ text: `〔 ${seg.blank} 〕${"_".repeat(seg.len || 10)}`, font: CFONT, size: 18, bold: true, color: "AA0000" });
    }
    if (typeof seg === "object" && seg.comment) {
      return new TextRun({ text: seg.comment, font: CFONT, size: 18, color: "3A7D3A", italics: true });
    }
    return new TextRun({ text: seg, font: CFONT, size: 18 });
  });
  return new Paragraph({ spacing: { after: 0 }, indent: { left: opts.indent || 0 }, children });
}
function codeBlock(lines, filename) {
  const paras = [];
  if (filename) {
    paras.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: `# ${filename}`, font: CFONT, size: 18, bold: true, color: "555555" })],
      })
    );
  }
  paras.push(...lines);
  return new Table({
    width: { size: 9350, type: WidthType.DXA },
    borders: allBorders("D9D9D9"),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9350, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: paras,
          }),
        ],
      }),
    ],
  });
}
function spacer(size = 160) {
  return new Paragraph({ spacing: { after: size }, children: [] });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function hintList(hints) {
  return hints.map(
    (t) =>
      new Paragraph({
        spacing: { after: 60 },
        indent: { left: 260 },
        children: [new TextRun({ text: "· " + t, font: KFONT, size: 19, italics: true, color: "555555" })],
      })
  );
}

// ---------- document ----------
const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        // Cover
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 100 },
          children: [new TextRun({ text: "IoT 스마트 제어 시스템 실습", font: KFONT, size: 22, color: "555555" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "4주차 학생 워크시트", font: KFONT, size: 40, bold: true, color: "1F3864" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "대시보드 UI 리디자인 (계측기/제어반 스타일)", font: KFONT, size: 24, color: "2F5496" })],
        }),
        table(["이름", "학번", "조", "날짜"], [["", "", "", ""]], [2340, 2340, 2340, 2330]),
        spacer(240),
        quoteBox(
          "3주차에서 만든 대시보드는 '동작은 하지만' 색상·타이포·레이아웃이 전부 기본값이라 시제품 느낌이 강했습니다. 이번 주는 그 화면을 실제 상용 제품 수준의 완성도로 다시 디자인합니다. 다만 목표는 '예쁘게 꾸미기'가 아니라, 이 프로젝트의 정체성(산업용 IoT 제어반)에서 나온 디자인을 만드는 것입니다."
        ),
        spacer(300),

        // 1. 학습 목표
        h1("1. 학습 목표"),
        p("이번 시간이 끝나면 나는 아래 네 가지를 할 수 있습니다."),
        ...checklist([
          "'AI가 만든 티가 나는 디자인'의 전형적인 패턴을 알아보고 피할 수 있다.",
          "색상·타이포그래피·레이아웃을 하나의 디자인 컨셉으로 묶어서 결정할 수 있다.",
          "Tailwind CSS v4의 CSS 기반 테마 설정(@theme)과 next/font로 커스텀 폰트를 적용할 수 있다.",
          "화면을 재사용 가능한 컴포넌트(상태 표시, 센서 카드, 제어 패널)로 분리할 수 있다.",
        ]),

        // 2. 왜 AI가 만든 것처럼 보이는가
        h1("2. 시작 전 — 왜 지금 화면이 'AI가 만든 것'처럼 보이는가"),
        p("우리 3주차 화면에도 해당되는 특징이 있는지 체크해보세요."),
        ...checklist([
          "이모지(🟢🔴)를 상태 아이콘 대신 사용했다",
          "시스템 기본 서체(sans-serif) 그대로, 정보 위계(제목/라벨/값)가 크기 차이만으로 구분된다",
          "카드나 섹션 구분 없이 위에서 아래로 나열되어 있다",
          "여백과 정렬이 일관된 규칙 없이 임의로 지정되어 있다 (marginBottom: 16을 여기저기 반복)",
        ]),
        spacer(120),
        p("요즘 AI에게 '예쁘게 만들어줘'라고 하면 특히 자주 나오는 3가지 뻔한 패턴이 있습니다. 이번 리디자인에서는 이 셋을 의도적으로 피합니다."),
        table(
          ["#", "뻔한 패턴"],
          [
            ["1", "크림색 배경 + 세리프 헤드라인 + 테라코타(주황빛 갈색) 포인트 컬러"],
            ["2", "거의 검정에 가까운 배경 + 형광 네온 그린/버밀리언 단색 포인트"],
            ["3", "신문처럼 얇은 구분선과 각진 모서리로만 구성된 레이아웃"],
          ],
          [700, 8650]
        ),
        spacer(100),
        p("질문: 이 프로젝트는 산업 현장의 계측기·제어반(HMI)과 본질적으로 같은 화면입니다. 그 시각 언어(그래파이트 색 패널, 정확한 숫자 표시, 은은한 상태등)를 참고하는 것이 왜 '장식'이 아니라 '정직한 선택'일까요?"),
        fillLine("→"),

        pageBreak(),

        // 3. 디자인 컨셉 확정
        h1("3. 디자인 컨셉 확정"),
        h2("컬러 (4~6개, 이름 있는 값)"),
        colorSwatchTable([
          { name: "panel-bg", hex: "#14181C", usage: "전체 배경 (그래파이트, 순수 검정 아님)" },
          { name: "panel-surface", hex: "#1D232B", usage: "카드/섹션 배경" },
          { name: "panel-border", hex: "#2B323B", usage: "헤어라인 구분선" },
          { name: "text-primary", hex: "#E9EBEC", usage: "본문/숫자" },
          { name: "text-muted", hex: "#8B929B", usage: "라벨/보조 텍스트" },
          { name: "status-live", hex: "#4FA88F", usage: "연결됨/정상 상태, 포인트 컬러 (계측기의 '동작 중' 표시등과 같은 톤)" },
        ]),
        spacer(100),
        p("질문: panel-bg는 왜 순수 검정(#000000)이 아니라 #14181C 같은 '그래파이트' 톤을 쓸까요?"),
        fillLine("→"),
        spacer(140),
        h2("타이포그래피"),
        ...checklist([
          "IBM Plex Sans — 라벨, 제목용. 엔지니어링·기술 문서를 위해 만들어진 서체라 계측기/제어반 소재와 태생부터 맞습니다.",
          "IBM Plex Mono — 센서 숫자, IP 주소처럼 '값'을 나타내는 모든 곳. 디지털 계측기의 숫자 표시부 느낌을 의도한 선택입니다.",
        ]),
        spacer(120),
        h2("레이아웃 컨셉"),
        codeBlock(
          [
            codeLine(["┌─────────────────────────────────────┐"]),
            codeLine(["│ 스마트 제어반          [●] ONLINE   │  ", { comment: "← 헤더 + 상태 표시등" }]),
            codeLine(["├─────────────────────────────────────┤"]),
            codeLine(["│ [장치 IP 입력]  [장치 연결]          │"]),
            codeLine(["├───────────┬───────────┬─────────────┤"]),
            codeLine(["│  온도      │  습도      │  조도       │  ", { comment: "← 센서 카드 3열" }]),
            codeLine(["│  24.5°C    │  58%      │  62%        │"]),
            codeLine(["├───────────┴───────────┴─────────────┤"]),
            codeLine(["│ 액추에이터                            │"]),
            codeLine(["│ LED 색상: ● ● ● [커스텀]             │"]),
            codeLine(["│ 서보 각도: ─────●──────  90°         │"]),
            codeLine(["│ [설정 반영]                          │"]),
            codeLine(["└─────────────────────────────────────┘"]),
          ]
        ),
        spacer(100),
        p("시그니처 요소: 헤더의 상태 표시등(작은 원형 점 + 은은한 발광 애니메이션). 연결되면 부드럽게 맥동하고 끊기면 꺼진 회색 점이 됩니다. 이 화면에서 유일하게 '움직이는' 요소로 남겨, 나머지는 전부 정적으로 유지합니다."),
        spacer(100),
        p("의도적으로 하지 않은 것: 그라데이션 배경, 유리질(glassmorphism) 블러, 카드마다 다른 둥근 정도, 장식용 아이콘, 순서 없는 내용에 번호(01/02/03) 붙이기.", { italics: true, run: { size: 19, color: "666666" } }),
        spacer(100),
        p("우리 팀만의 '의도적으로 하지 않을 것'을 하나 더 추가해보세요."),
        fillLine("→"),

        pageBreak(),

        // 4. 폰트/색상 토큰 설정
        h1("4. 폰트/색상 토큰 설정"),
        p("이번 주는 새로 설치할 라이브러리가 없습니다. next/font는 Next.js에 기본 내장되어 있어 별도 npm install 없이 바로 사용할 수 있습니다. Tailwind v4는 tailwind.config.js 대신 CSS 안에서 @theme으로 설정합니다."),
        p("파일 위치: src/app/globals.css (기존 내용 전체를 아래로 교체)"),
        codeBlock(
          [
            codeLine(['@import "tailwindcss";']),
            codeLine([""]),
            codeLine(["@theme inline {"]),
            codeLine(["  --font-plex-sans: var(--font-plex-sans);"], { indent: 200 }),
            codeLine(["  --font-plex-mono: var(--font-plex-mono);"], { indent: 200 }),
            codeLine(["}"]),
            codeLine([""]),
            codeLine(["@theme {"]),
            codeLine(["  --color-panel-bg: #14181c;"], { indent: 200 }),
            codeLine(["  --color-panel-surface: #1d232b;"], { indent: 200 }),
            codeLine(["  --color-panel-border: #2b323b;"], { indent: 200 }),
            codeLine(["  --color-text-primary: #e9ebec;"], { indent: 200 }),
            codeLine(["  --color-text-muted: #8b929b;"], { indent: 200 }),
            codeLine(["  --color-status-live: #4fa88f;"], { indent: 200 }),
            codeLine(["  --color-status-idle: #4c5560;"], { indent: 200 }),
            codeLine(["}"]),
            codeLine([""]),
            codeLine(["body {"]),
            codeLine(["  background-color: var(--color-panel-bg);"], { indent: 200 }),
            codeLine(["  color: var(--color-text-primary);"], { indent: 200 }),
            codeLine(["  font-family: var(", { blank: "①", len: 20 }, "), sans-serif;"], { indent: 200 }),
            codeLine(["}"]),
          ],
          "src/app/globals.css"
        ),
        spacer(100),
        ...hintList(["① 위 @theme inline 블록에서 등록한 두 변수 중 '본문 서체(Sans)'용 변수 이름입니다."]),
        spacer(140),
        p("파일 위치: src/app/layout.tsx (Google Fonts를 next/font로 불러와 위 CSS 변수에 연결)"),
        codeBlock(
          [
            codeLine(['import type { Metadata } from "next";']),
            codeLine(['import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";']),
            codeLine(['import "./globals.css";']),
            codeLine([""]),
            codeLine(["const plexSans = IBM_Plex_Sans({"]),
            codeLine(['  subsets: ["latin"],'], { indent: 200 }),
            codeLine(['  weight: ["400", "500", "600", "700"],'], { indent: 200 }),
            codeLine(["  variable: ", { blank: "②", len: 20 }, ","], { indent: 200 }),
            codeLine(["});"]),
            codeLine([""]),
            codeLine(["const plexMono = IBM_Plex_Mono({"]),
            codeLine(['  subsets: ["latin"],'], { indent: 200 }),
            codeLine(['  weight: ["400", "500", "600"],'], { indent: 200 }),
            codeLine(['  variable: "--font-plex-mono",'], { indent: 200 }),
            codeLine(["});"]),
            codeLine([""]),
            codeLine(["export const metadata: Metadata = {"]),
            codeLine(['  title: "스마트 제어반",'], { indent: 200 }),
            codeLine(['  description: "실시간 센서 모니터링 및 액추에이터 제어",'], { indent: 200 }),
            codeLine(["};"]),
            codeLine([""]),
            codeLine(["export default function RootLayout({"]),
            codeLine(["  children,"], { indent: 200 }),
            codeLine(["}: {"]),
            codeLine(["  children: React.ReactNode;"], { indent: 200 }),
            codeLine(["}) {"]),
            codeLine(["  return ("], { indent: 200 }),
            codeLine(['    <html lang="ko">'], { indent: 200 }),
            codeLine(["      <body className={`${plexSans.variable} ${plexMono.variable} antialiased`}>"], { indent: 200 }),
            codeLine(["        {children}"], { indent: 200 }),
            codeLine(["      </body>"], { indent: 200 }),
            codeLine(["    </html>"], { indent: 200 }),
            codeLine(["  );"], { indent: 200 }),
            codeLine(["}"]),
          ],
          "src/app/layout.tsx"
        ),
        spacer(100),
        ...hintList(["② globals.css의 ①번 빈칸과 정확히 똑같은 문자열이어야 합니다. 하나라도 다르면 폰트가 적용되지 않습니다 (9번 트러블슈팅 참고)."]),

        pageBreak(),

        // 5. 컴포넌트 분리
        h1("5. 컴포넌트 분리"),
        p("파일 위치: src/components/StatusIndicator.tsx"),
        codeBlock(
          [
            codeLine(["export function StatusIndicator({ connected }: { connected: boolean }) {"]),
            codeLine(["  return ("], { indent: 200 }),
            codeLine(['    <div className="flex items-center gap-2">'], { indent: 200 }),
            codeLine(['      <span className="relative flex h-2.5 w-2.5">'], { indent: 200 }),
            codeLine(["        {connected && ("], { indent: 200 }),
            codeLine(['          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-live opacity-60" />'], { indent: 200 }),
            codeLine(["        )}"], { indent: 200 }),
            codeLine(["        <span"], { indent: 200 }),
            codeLine(["          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${"], { indent: 200 }),
            codeLine(["            connected ? \"bg-status-", { blank: "①", len: 8 }, "\" : \"bg-status-", { blank: "②", len: 8 }, "\""], { indent: 200 }),
            codeLine(["          }`}"], { indent: 200 }),
            codeLine(["        />"], { indent: 200 }),
            codeLine(["      </span>"], { indent: 200 }),
            codeLine(['      <span className="font-plex-mono text-xs uppercase tracking-wider text-text-muted">'], { indent: 200 }),
            codeLine(["        {connected ? \"", { blank: "③", len: 10 }, "\" : \"OFFLINE\"}"], { indent: 200 }),
            codeLine(["      </span>"], { indent: 200 }),
            codeLine(["    </div>"], { indent: 200 }),
            codeLine(["  );"], { indent: 200 }),
            codeLine(["}"]),
          ],
          "src/components/StatusIndicator.tsx"
        ),
        spacer(100),
        ...hintList([
          "①② 3번 섹션 컬러 표에서 '연결됨' 상태와 '평상시(대기)' 상태에 쓸 색상 이름입니다. (평상시 색상은 4번 섹션 globals.css의 --color-status-idle 참고)",
          "③ 연결되었을 때 보여줄 영문 상태 문구입니다.",
        ]),
        spacer(140),
        p("파일 위치: src/components/SensorCard.tsx"),
        codeBlock(
          [
            codeLine(["type SensorCardProps = {"]),
            codeLine(["  label: string;"], { indent: 200 }),
            codeLine(["  value: number | ", { blank: "①", len: 10 }, ";"], { indent: 200 }),
            codeLine(["  unit: string;"], { indent: 200 }),
            codeLine(["};"]),
            codeLine([""]),
            codeLine(["export function SensorCard({ label, value, unit }: SensorCardProps) {"]),
            codeLine(["  return ("], { indent: 200 }),
            codeLine(['    <div className="rounded-md border border-panel-border bg-panel-surface p-5">'], { indent: 200 }),
            codeLine(['      <p className="text-xs uppercase tracking-widest text-text-muted">{label}</p>'], { indent: 200 }),
            codeLine(['      <p className="mt-2 font-plex-mono text-4xl tabular-nums text-text-primary">'], { indent: 200 }),
            codeLine(["        {value ?? \"", { blank: "②", len: 8 }, "\"}"], { indent: 200 }),
            codeLine(['        <span className="ml-1 text-base text-text-muted">{unit}</span>'], { indent: 200 }),
            codeLine(["      </p>"], { indent: 200 }),
            codeLine(["    </div>"], { indent: 200 }),
            codeLine(["  );"], { indent: 200 }),
            codeLine(["}"]),
          ],
          "src/components/SensorCard.tsx"
        ),
        spacer(100),
        ...hintList([
          "① value가 아직 없을 때(연결 전)를 표현하는 타입입니다.",
          "② 센서 값이 아직 없을 때(value가 ①인 경우) 숫자 대신 화면에 보여줄 기호입니다. (계측기가 값을 못 받았을 때 흔히 쓰는 표시)",
        ]),

        pageBreak(),

        // 6. 대시보드 페이지 재작성
        h1("6. 대시보드 페이지 재작성"),
        p("파일 위치: src/app/dashboard/page.tsx (파일 전체 교체). 연결/명령 전송 로직은 3주차와 같고, 이번 주는 컴포넌트 구성과 스타일이 핵심입니다."),
        codeBlock(
          [
            codeLine(['"use client";']),
            codeLine([""]),
            codeLine(['import { useEffect, useRef, useState } from "react";']),
            codeLine(['import { StatusIndicator } from "@/components/', { blank: "①", len: 18 }, '";']),
            codeLine(['import { SensorCard } from "@/components/', { blank: "②", len: 18 }, '";']),
            codeLine([""]),
            codeLine(["type SensorData = {"]),
            codeLine(["  temperature: number | null;"], { indent: 200 }),
            codeLine(["  humidity: number | null;"], { indent: 200 }),
            codeLine(["  light_percent: number;"], { indent: 200 }),
            codeLine(["};"]),
            codeLine([""]),
            codeLine(["const LED_PRESETS = ["]),
            codeLine(['  { name: "주황", hex: "#e08a3c" },'], { indent: 200 }),
            codeLine(['  { name: "청록", hex: "', { blank: "③", len: 10 }, '" },'], { indent: 200 }),
            codeLine(['  { name: "백색", hex: "#e9ebec" },'], { indent: 200 }),
            codeLine(["];"]),
            codeLine([""]),
            codeLine(["export default function DashboardPage() {"]),
            codeLine(['  const [picoIp, setPicoIp] = useState("192.168.137.39");'], { indent: 200 }),
            codeLine(["  const [connected, setConnected] = useState(false);"], { indent: 200 }),
            codeLine(["  const [sensor, setSensor] = useState<SensorData | null>(null);"], { indent: 200 }),
            codeLine(['  const [ledColor, setLedColor] = useState("#e08a3c");'], { indent: 200 }),
            codeLine(["  const [servoAngle, setServoAngle] = useState(90);"], { indent: 200 }),
            codeLine(["  const wsRef = useRef<WebSocket | null>(null);"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  const connect = () => {  ", { comment: "// 3주차와 동일" }], { indent: 200 }),
            codeLine(["    wsRef.current?.close();"], { indent: 200 }),
            codeLine(["    const ws = new WebSocket(`ws://${picoIp}:5000/connect-websocket`);"], { indent: 200 }),
            codeLine(["    ws.onopen = () => setConnected(true);"], { indent: 200 }),
            codeLine(["    ws.onclose = () => setConnected(false);"], { indent: 200 }),
            codeLine(["    ws.onerror = () => setConnected(false);"], { indent: 200 }),
            codeLine(["    ws.onmessage = (event) => {"], { indent: 200 }),
            codeLine(["      try {"], { indent: 200 }),
            codeLine(["        setSensor(JSON.parse(event.data));"], { indent: 200 }),
            codeLine(["      } catch {"], { indent: 200 }),
            codeLine(['        console.warn("잘못된 메시지 형식:", event.data);'], { indent: 200 }),
            codeLine(["      }"], { indent: 200 }),
            codeLine(["    };"], { indent: 200 }),
            codeLine(["    wsRef.current = ws;"], { indent: 200 }),
            codeLine(["  };"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  const sendCommand = () => {  ", { comment: "// 3주차와 동일" }], { indent: 200 }),
            codeLine(["    if (wsRef.current?.readyState === WebSocket.OPEN) {"], { indent: 200 }),
            codeLine(["      const r = parseInt(ledColor.slice(1, 3), 16);"], { indent: 200 }),
            codeLine(["      const g = parseInt(ledColor.slice(3, 5), 16);"], { indent: 200 }),
            codeLine(["      const b = parseInt(ledColor.slice(5, 7), 16);"], { indent: 200 }),
            codeLine(["      wsRef.current.send("], { indent: 200 }),
            codeLine(["        JSON.stringify({ led_r: r, led_g: g, led_b: b, servo_angle: servoAngle })"], { indent: 200 }),
            codeLine(["      );"], { indent: 200 }),
            codeLine(["    }"], { indent: 200 }),
            codeLine(["  };"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  useEffect(() => {"], { indent: 200 }),
            codeLine(["    return () => wsRef.current?.close();"], { indent: 200 }),
            codeLine(["  }, []);"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  return ("], { indent: 200 }),
            codeLine(['    <main className="min-h-screen px-6 py-10 md:px-12">'], { indent: 200 }),
            codeLine(['      <div className="mx-auto max-w-3xl">'], { indent: 200 }),
            codeLine(['        <header className="flex items-center justify-between border-b border-panel-border pb-5">'], { indent: 200 }),
            codeLine(["          <div>"], { indent: 200 }),
            codeLine(['            <h1 className="text-lg font-semibold tracking-tight">스마트 제어반</h1>'], { indent: 200 }),
            codeLine(['            <p className="text-xs text-text-muted">온습도 · 조도 모니터링</p>'], { indent: 200 }),
            codeLine(["          </div>"], { indent: 200 }),
            codeLine(["          <StatusIndicator connected={", { blank: "④", len: 12 }, "} />"], { indent: 200 }),
            codeLine(["        </header>"], { indent: 200 }),
            codeLine([""]),
            codeLine(['        <section className="mt-6 flex items-center gap-2">'], { indent: 200 }),
            codeLine(["          <input"], { indent: 200 }),
            codeLine(["            value={picoIp}"], { indent: 200 }),
            codeLine(["            onChange={(e) => setPicoIp(e.target.value)}"], { indent: 200 }),
            codeLine(['            placeholder="장치 IP 주소"'], { indent: 200 }),
            codeLine(['            className="w-44 rounded border border-panel-border bg-panel-surface px-3 py-1.5 font-plex-mono text-sm text-text-primary outline-none focus:border-status-live"'], { indent: 200 }),
            codeLine(["          />"], { indent: 200 }),
            codeLine(["          <button"], { indent: 200 }),
            codeLine(["            onClick={connect}"], { indent: 200 }),
            codeLine(["            className=\"rounded bg-status-", { blank: "⑤", len: 8 }, " px-4 py-1.5 text-sm font-medium text-panel-bg hover:opacity-90\""], { indent: 200 }),
            codeLine(["          >"], { indent: 200 }),
            codeLine(["            장치 연결"], { indent: 200 }),
            codeLine(["          </button>"], { indent: 200 }),
            codeLine(["        </section>"], { indent: 200 }),
            codeLine([""]),
            codeLine(['        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">'], { indent: 200 }),
            codeLine(['          <SensorCard label="온도" value={sensor?.temperature ?? null} unit="', { blank: "⑥", len: 6 }, '" />'], { indent: 200 }),
            codeLine(['          <SensorCard label="습도" value={sensor?.humidity ?? null} unit="%" />'], { indent: 200 }),
            codeLine(['          <SensorCard label="조도" value={sensor?.light_percent ?? null} unit="%" />'], { indent: 200 }),
            codeLine(["        </section>"], { indent: 200 }),
            codeLine([""]),
            codeLine(["        // 액추에이터 섹션(LED 프리셋 버튼 + 커스텀 컬러 피커 + 서보 각도 슬라이더 + '설정 반영' 버튼)"], { indent: 200 }),
            codeLine(["        // 은 교재를 그대로 참고해 작성하세요"], { indent: 200 }),
            codeLine(["      </div>"], { indent: 200 }),
            codeLine(["    </main>"], { indent: 200 }),
            codeLine(["  );"], { indent: 200 }),
            codeLine(["}"]),
          ],
          "src/app/dashboard/page.tsx"
        ),
        spacer(100),
        ...hintList([
          "① ② 방금 만든 컴포넌트 파일명과 같은 이름입니다 (5번 섹션 참고).",
          "③ 3번 섹션 컬러 표에는 없지만, LED 프리셋 색상입니다 — 교재의 완성 화면을 참고하거나 원하는 청록색 hex 값을 정해보세요.",
          "④ StatusIndicator가 연결 상태를 받는 prop입니다. 이 컴포넌트 밖에서 관리하는 상태값 이름을 그대로 전달하세요.",
          "⑤⑥ 3번 섹션 컬러 표의 이름을 그대로 클래스 뒤에 붙이면 됩니다 (bg-status-live처럼). ⑥은 온도의 단위입니다.",
        ]),
        spacer(140),
        h2("바뀐 점 요약"),
        ...checklist([
          "이모지 상태 아이콘 → 실제 발광 애니메이션이 있는 상태 표시등 컴포넌트",
          "버튼 문구를 시스템 용어가 아니라 실제 행동으로: '연결'→'장치 연결', '적용'→'설정 반영'",
          "센서 값은 큼직한 모노스페이스 숫자로, 단위는 작고 흐리게 — 값이 먼저 눈에 들어오도록 위계 정리",
          "LED 색상에 자주 쓸 색상 3개를 프리셋 버튼으로 추가하고, 커스텀 컬러 피커는 보조로 배치",
        ]),

        pageBreak(),

        // 7. 실행 및 확인
        h1("7. 실행 및 확인"),
        ...checklist([
          "globals.css, layout.tsx, components/StatusIndicator.tsx, components/SensorCard.tsx, dashboard/page.tsx를 모두 위 내용으로 교체",
          "npm run dev:lan 재시작 (폰트/CSS 변경은 서버 재시작이 필요할 수 있음)",
          "브라우저에서 /dashboard 새로고침",
          "확인: 그래파이트 톤 배경에 카드가 구분되어 보이는지, 숫자가 모노스페이스 폰트로 표시되는지, 헤더의 상태 표시등이 연결 시 은은하게 맥동하는지",
        ]),

        spacer(160),

        // 8. AI 티 자가 점검
        h1("8. 'AI 티' 자가 점검 체크리스트"),
        p("완성 후 아래 항목을 스스로 확인해보세요. 하나라도 해당되면 그 부분만 다시 손보면 됩니다."),
        ...checklist([
          "크림색 배경 + 세리프 제목 + 주황빛 갈색 포인트 조합을 쓰지 않았다",
          "거의 검정 배경에 형광 네온 하나로만 포인트를 준 게 아니다 (우리는 차분한 청록 계열)",
          "이모지를 아이콘 대용으로 쓰지 않았다",
          "순서가 없는 내용에 01/02/03 같은 번호를 장식으로 붙이지 않았다",
          "버튼 문구가 'Submit', 'OK' 같은 시스템 용어가 아니라 실제 행동을 설명한다",
          "화면에서 움직이는 요소가 상태 표시등 하나로 절제되어 있다",
        ]),

        pageBreak(),

        // 9. 트러블슈팅
        h1("9. 트러블슈팅"),
        table(
          ["문제", "점검 순서"],
          [
            ["폰트가 기본 시스템 폰트로 보임(Plex 적용 안 됨)", "layout.tsx의 variable 값과 globals.css의 @theme inline 안 변수명이 정확히 일치하는지 확인, 서버 재시작"],
            ["bg-status-live 같은 클래스가 안 먹음", "@theme 블록이 globals.css 최상단 @import \"tailwindcss\"; 아래에 있는지, 오타 없는지 확인"],
            ["상태 표시등 애니메이션이 안 보임", "Tailwind의 animate-ping은 기본 내장 — connected가 true일 때만 조건부 렌더링되므로 먼저 연결 상태부터 확인"],
            ["레이아웃이 모바일에서 깨짐", "sm:grid-cols-3처럼 반응형 접두사가 제대로 붙어있는지 확인, 브라우저 창 폭을 줄여 확인"],
          ],
          [3400, 5950]
        ),
        spacer(160),
        h2("내가 오늘 실제로 겪은 문제"),
        recordTable(["증상", "원인 추정", "해결 방법"], 2, [3117, 3117, 3116]),

        pageBreak(),

        // 10. 마무리
        h1("10. 마무리 정리"),
        quoteBox(
          "1주차(로컬 제어) → 2주차(REST+MySQL) → 3주차(WebSocket 실시간) → 4주차(전문가 수준 UI)까지, 기능 구현에서 완성도 있는 제품 마감까지의 전체 흐름을 경험했습니다. 이후에는 이 디자인 시스템(색상·폰트 토큰, 컴포넌트 구조)을 다른 팀 프로젝트에도 그대로 적용해볼 수 있습니다."
        ),
        spacer(160),
        h2("4주 과정에서 배운 핵심 용어, 나만의 말로 설명하기"),
        recordTable(["용어", "나의 설명"], 5, [2800, 6550]),
        spacer(200),
        h2("4주 전체 과정을 마친 소감"),
        writeBox(6),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  require("fs").writeFileSync(__dirname + "/../4주차_학생워크시트.docx", buf);
  console.log("done");
});
