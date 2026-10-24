const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, PageBreak, VerticalAlign,
} = require("docx");

const KFONT = "Malgun Gothic";
const CFONT = "Courier New";

// ---------- helpers (동일: 1주차 워크시트와 스타일 통일) ----------
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
            font: KFONT,
            size: 20,
            bold: !!opts.header,
            color: opts.header ? "FFFFFF" : "000000",
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
        cantSplit: true,
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
          children: [new TextRun({ text: "2주차 학생 워크시트", font: KFONT, size: 40, bold: true, color: "1F3864" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "Wi-Fi + REST API(Next.js) + MySQL 연동", font: KFONT, size: 24, color: "2F5496" })],
        }),
        table(["이름", "학번", "조", "날짜"], [["", "", "", ""]], [2340, 2340, 2340, 2330]),
        spacer(240),
        quoteBox(
          "이번 주는 1주차에서 만든 센서/액추에이터 코드에 Wi-Fi 통신을 추가합니다. Pico 2 W가 Next.js(TS) 백엔드에 센서 값을 전송(POST)하고 MySQL에 저장하며, 반대로 서버가 내려주는 제어 명령을 받아(GET) 액추에이터를 움직이는 것까지 다룹니다."
        ),
        spacer(300),

        // 1. 학습 목표
        h1("1. 학습 목표"),
        p("이번 시간이 끝나면 나는 아래 세 가지를 할 수 있습니다."),
        ...checklist([
          "CircuitPython으로 Wi-Fi에 연결하고, settings.toml로 접속 정보를 안전하게 분리할 수 있다.",
          "Next.js API Route(TS)에서 MySQL과 연동해 센서 데이터를 저장/조회할 수 있다.",
          "Pico가 REST API(JSON)로 서버와 데이터를 주고받으며, 서버가 내려준 명령으로 액추에이터를 제어할 수 있다.",
        ]),

        // 2. 네트워크 구성
        h1("2. 네트워크 구성 — Windows PC 모바일 핫스팟"),
        p("이번 교재는 Next.js 서버가 돌아가는 Windows PC 자체가 Wi-Fi 핫스팟을 켜고, Pico 2 W가 그 핫스팟에 접속하는 방식으로 운영합니다."),
        h2("핫스팟 켜기 (Windows 11 기준)"),
        ...checklist([
          "설정 → 네트워크 및 인터넷 → 모바일 핫스팟 이동",
          "네트워크 이름(SSID)과 암호(8자리 이상) 설정",
          "공유할 인터넷 연결(공유 대상)을 이더넷 또는 다른 Wi-Fi 어댑터로 선택",
          "토글을 켜서 핫스팟 활성화",
          "ipconfig 실행 → '무선 로컬 영역 네트워크 연결*' 어댑터의 IPv4 주소 확인 (대부분 192.168.137.1)",
        ]),
        spacer(100),
        h2("우리 팀의 네트워크 정보 기록"),
        p("아래 값은 이후 실습(12번, 13~15번)에서 계속 사용하니 정확히 적어두세요."),
        table(
          ["항목", "값"],
          [
            ["Wi-Fi 이름 (SSID)", ""],
            ["Wi-Fi 비밀번호", ""],
            ["PC의 IP 주소 (ipconfig로 확인)", ""],
          ],
          [4350, 5000]
        ),
        spacer(100),
        p("질문: 학교 공용 Wi-Fi 대신 PC의 모바일 핫스팟을 사용하는 이유는 무엇일까요?"),
        fillLine("→"),

        // 3. 전체 구조
        h1("3. 전체 구조 한눈에 보기"),
        table(
          ["구간", "무엇이 오가나", "관련 API / 테이블"],
          [
            ["Pico → Next.js", "센서값 전송 (POST, JSON), 3~5초마다", "/api/sensor → sensor_logs 테이블"],
            ["Next.js → Pico", "제어 명령 조회 (GET), 주기적으로", "/api/actuator → actuator_state 테이블"],
          ],
          [2600, 3800, 2950]
        ),
        spacer(100),
        p("참고: 이번 주에는 아직 웹 대시보드 화면을 만들지 않습니다. Postman(또는 curl)으로 API를 직접 테스트하며 흐름을 확인합니다. 대시보드 UI는 3주차에서 다룹니다.", { italics: true, run: { size: 19, color: "666666" } }),

        pageBreak(),

        // 4. MySQL
        h1("4. MySQL 데이터베이스 준비"),
        p("MySQL Workbench, HeidiSQL, 또는 명령줄(mysql -u root -p) 중 편한 도구로 아래 SQL을 실행하세요."),
        codeBlock(
          [
            codeLine(["-- 데이터베이스 생성"]),
            codeLine(["CREATE DATABASE IF NOT EXISTS iot_week2"]),
            codeLine(["  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"]),
            codeLine([""]),
            codeLine(["USE iot_week2;"]),
            codeLine([""]),
            codeLine(["-- 센서 로그 테이블 (Pico가 보낸 값들이 계속 쌓임)"]),
            codeLine(["CREATE TABLE sensor_logs ("]),
            codeLine(["  id INT AUTO_INCREMENT PRIMARY KEY,"], { indent: 200 }),
            codeLine(["  temperature FLOAT,"], { indent: 200 }),
            codeLine(["  humidity FLOAT,"], { indent: 200 }),
            codeLine(["  ", { blank: "①", len: 26 }, ","], { indent: 200 }),
            codeLine(["  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"], { indent: 200 }),
            codeLine([");"]),
            codeLine([""]),
            codeLine(["-- 액추에이터 상태 테이블 (딱 1행만 사용 — 현재 원하는 제어 상태)"]),
            codeLine(["CREATE TABLE actuator_state ("]),
            codeLine(["  id INT PRIMARY KEY,"], { indent: 200 }),
            codeLine(["  led_r INT DEFAULT 0,"], { indent: 200 }),
            codeLine(["  led_g INT DEFAULT 0,"], { indent: 200 }),
            codeLine(["  led_b INT DEFAULT 0,"], { indent: 200 }),
            codeLine(["  ", { blank: "②", len: 26 }, ","], { indent: 200 }),
            codeLine(["  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"], { indent: 200 }),
            codeLine([");"]),
            codeLine([""]),
            codeLine(["INSERT INTO actuator_state (id, led_r, led_g, led_b, servo_angle)"]),
            codeLine(["VALUES (1, 0, 0, 0, 90);"]),
          ],
          "setup.sql"
        ),
        spacer(100),
        ...hintList([
          "① 1주차에서 다룬 '조도값'을 저장할 컬럼입니다. sensor_logs의 다른 컬럼(temperature FLOAT 등)과 같은 형식으로 작성해보세요.",
          "② 서보 각도를 저장할 컬럼입니다. 기본값은 90도(중앙)입니다.",
        ]),
        spacer(140),
        p("확인: SELECT * FROM actuator_state; 실행 시 1개 행이 나오면 정상입니다."),
        p("질문: actuator_state 테이블은 왜 여러 행이 아니라 딱 1개 행(id=1)만 사용할까요?"),
        fillLine("→"),

        // 5. Next.js 프로젝트 생성
        h1("5. Next.js 프로젝트 생성 및 라이브러리 설치"),
        p("터미널(명령 프롬프트 또는 VS Code 통합 터미널)에서 실행합니다."),
        codeBlock(
          [
            codeLine(['npx create-next-app@latest iot-week2-api --typescript --app --eslint --tailwind --src-dir --import-alias "@/*"']),
            codeLine(["cd iot-week2-api"]),
            codeLine(["npm install mysql2"]),
          ],
          "terminal"
        ),
        spacer(100),
        ...checklist(["create-next-app 실행 완료 (프롬프트는 기본값/Enter로 진행)", "npm install mysql2 완료"]),

        // 6. 환경변수
        h1("6. 환경변수 설정 (.env.local)"),
        p("프로젝트 루트에 .env.local 파일을 만들고 아래 내용을 본인 MySQL 계정 정보로 채웁니다."),
        codeBlock(
          [
            codeLine(["DB_HOST=localhost"]),
            codeLine(["DB_USER=root"]),
            codeLine(["DB_PASSWORD=", { blank: "①", len: 20 }]),
            codeLine(["DB_NAME=iot_week2"]),
          ],
          ".env.local"
        ),
        spacer(80),
        ...hintList(["① 본인 MySQL 계정의 실제 비밀번호를 입력하세요."]),
        spacer(120),
        p("질문: .env.local 파일은 왜 GitHub 등에 절대 올리면 안 될까요?"),
        fillLine("→"),

        pageBreak(),

        // 7. DB 연결 유틸리티
        h1("7. DB 연결 유틸리티"),
        p("파일 위치: src/lib/db.ts (폴더가 없다면 새로 생성)"),
        codeBlock(
          [
            codeLine(['import mysql from "mysql2/promise";']),
            codeLine([""]),
            codeLine(["const pool = mysql.createPool({"]),
            codeLine(["  host: process.env.", { blank: "①", len: 14 }, ","], { indent: 200 }),
            codeLine(["  user: process.env.DB_USER,"], { indent: 200 }),
            codeLine(["  password: process.env.DB_PASSWORD,"], { indent: 200 }),
            codeLine(["  database: process.env.DB_NAME,"], { indent: 200 }),
            codeLine(["  waitForConnections: true,"], { indent: 200 }),
            codeLine(["  connectionLimit: 10,"], { indent: 200 }),
            codeLine(["});"]),
            codeLine([""]),
            codeLine(["export default pool;"]),
          ],
          "src/lib/db.ts"
        ),
        spacer(80),
        ...hintList(["① 6번에서 만든 .env.local의 어떤 키(key) 이름을 가져와야 할까요?"]),

        // 8. API Route 1
        h1("8. API Route 1 — 센서 데이터 저장/조회"),
        p("파일 위치: src/app/api/sensor/route.ts"),
        codeBlock(
          [
            codeLine(['import { NextRequest, NextResponse } from "next/server";']),
            codeLine(['import pool from "@/lib/db";']),
            codeLine([""]),
            codeLine(["// Pico가 센서값을 보낼 때 사용 (POST)"]),
            codeLine(["export async function POST(request: NextRequest) {"]),
            codeLine(["  try {"], { indent: 200 }),
            codeLine(["    const body = await request.json();"], { indent: 200 }),
            codeLine(["    const { temperature, humidity, light_percent } = body;"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    if ("], { indent: 200 }),
            codeLine(['      typeof temperature !== "number" ||'], { indent: 200 }),
            codeLine(['      typeof humidity !== "number" ||'], { indent: 200 }),
            codeLine(["      typeof ", { blank: "①", len: 16 }, ' !== "number"'], { indent: 200 }),
            codeLine(["    ) {"], { indent: 200 }),
            codeLine(["      return NextResponse.json("], { indent: 200 }),
            codeLine(['        { error: "temperature, humidity, light_percent는 숫자여야 합니다." },'], { indent: 200 }),
            codeLine(["        { status: 400 }"], { indent: 200 }),
            codeLine(["      );"], { indent: 200 }),
            codeLine(["    }"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    await pool.query("], { indent: 200 }),
            codeLine(['      "INSERT INTO sensor_logs (temperature, humidity, light_percent) VALUES (', { blank: "②", len: 12 }, ')",'], { indent: 200 }),
            codeLine(["      [temperature, humidity, light_percent]"], { indent: 200 }),
            codeLine(["    );"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    return NextResponse.json({ ok: true });"], { indent: 200 }),
            codeLine(["  } catch (err) {"], { indent: 200 }),
            codeLine(['    return NextResponse.json({ error: "서버 오류" }, { status: 500 });'], { indent: 200 }),
            codeLine(["  }"], { indent: 200 }),
            codeLine(["}"]),
            codeLine([""]),
            codeLine(["// 최근 20개 기록 조회 (브라우저나 Postman에서 GET으로 확인용)"]),
            codeLine(["export async function GET() {"]),
            codeLine(["  const [rows] = await pool.query("], { indent: 200 }),
            codeLine(['    "SELECT * FROM sensor_logs ORDER BY id DESC LIMIT ', { blank: "③", len: 6 }, '"'], { indent: 200 }),
            codeLine(["  );"], { indent: 200 }),
            codeLine(["  return NextResponse.json(rows);"], { indent: 200 }),
            codeLine(["}"]),
          ],
          "src/app/api/sensor/route.ts"
        ),
        spacer(80),
        ...hintList([
          "① 세 번째로 검사해야 할 값은 무엇일까요? body에서 꺼낸 변수 이름을 참고하세요.",
          "② INSERT 문에서 값이 들어갈 자리는 물음표(?)로 표시합니다. 컬럼이 3개이니 몇 개가 필요할까요?",
          "③ '최근 20개'를 가져오려면 몇으로 제한해야 할까요?",
        ]),

        pageBreak(),

        // 9. API Route 2
        h1("9. API Route 2 — 액추에이터 명령 조회/설정"),
        p("파일 위치: src/app/api/actuator/route.ts"),
        codeBlock(
          [
            codeLine(['import { NextRequest, NextResponse } from "next/server";']),
            codeLine(['import pool from "@/lib/db";']),
            codeLine(['import { RowDataPacket } from "mysql2";']),
            codeLine([""]),
            codeLine(["// Pico가 주기적으로 호출해 현재 제어 명령을 받아감 (GET)"]),
            codeLine(["export async function GET() {"]),
            codeLine(["  const [rows] = await pool.query<RowDataPacket[]>("], { indent: 200 }),
            codeLine(['    "SELECT led_r, led_g, led_b, servo_angle FROM actuator_state WHERE id = ', { blank: "①", len: 4 }, '"'], { indent: 200 }),
            codeLine(["  );"], { indent: 200 }),
            codeLine(["  return NextResponse.json(rows[0]);"], { indent: 200 }),
            codeLine(["}"]),
            codeLine([""]),
            codeLine(["// 사람이 Postman 등으로 원하는 제어값을 설정 (POST)"]),
            codeLine(["export async function POST(request: NextRequest) {"]),
            codeLine(["  const body = await request.json();"], { indent: 200 }),
            codeLine(["  const { led_r, led_g, led_b, servo_angle } = body;"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  await pool.query("], { indent: 200 }),
            codeLine(["    `UPDATE actuator_state"], { indent: 200 }),
            codeLine(["     SET led_r = ?, led_g = ?, led_b = ?, servo_angle = ?"], { indent: 200 }),
            codeLine(["     WHERE id = 1`,"], { indent: 200 }),
            codeLine(["    [", { blank: "②", len: 30 }, "]"], { indent: 200 }),
            codeLine(["  );"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  return NextResponse.json({ ok: true });"], { indent: 200 }),
            codeLine(["}"]),
          ],
          "src/app/api/actuator/route.ts"
        ),
        spacer(80),
        ...hintList([
          "① actuator_state 테이블에서 우리가 사용하는 행은 항상 몇 번일까요? (4번 섹션 참고)",
          "② UPDATE 문의 물음표(?) 4개에 순서대로 들어갈 값들을 배열로 채워보세요.",
        ]),

        // 10. 서버 실행
        h1("10. 서버 실행 및 네트워크 노출 설정"),
        p("기본 npm run dev는 PC 자기 자신(localhost)에서만 접속됩니다. Pico에서 접속하려면 PC의 네트워크 IP로 열어야 합니다."),
        h2("package.json의 scripts에 추가"),
        codeBlock(
          [
            codeLine(['"scripts": {']),
            codeLine(['  "dev": "next dev",'], { indent: 200 }),
            codeLine(['  "dev:lan": "next dev -H 0.0.0.0 -p 3000"'], { indent: 200 }),
            codeLine(["}"]),
          ],
          "package.json"
        ),
        spacer(100),
        ...checklist([
          "package.json에 dev:lan 스크립트 추가 완료",
          "npm run dev:lan 으로 서버 실행",
          "ipconfig로 PC IP 재확인 (2번에서 기록한 값과 같은지)",
          "첫 실행 시 Windows 방화벽 알림에서 '액세스 허용' + '공용 네트워크' 체크박스까지 모두 허용",
        ]),

        // 11. curl 테스트
        h1("11. Postman(또는 curl)으로 API 먼저 테스트"),
        p("Pico를 연결하기 전에, API 자체가 정상 동작하는지 먼저 확인합니다. 아래 IP는 예시이며, 본인 PC의 실제 IP로 바꿔서 실행하세요."),
        codeBlock(
          [
            codeLine(["# 센서 데이터 저장 테스트"]),
            codeLine(["curl -X POST http://192.168.137.1:3000/api/sensor ^"]),
            codeLine(['  -H "Content-Type: application/json" ^']),
            codeLine(['  -d "{\\"temperature\\": 25.5, \\"humidity\\": 60, \\"light_percent\\": 40}"']),
            codeLine([""]),
            codeLine(["# 저장된 데이터 확인"]),
            codeLine(["curl http://192.168.137.1:3000/api/sensor"]),
            codeLine([""]),
            codeLine(["# 액추에이터 명령 확인"]),
            codeLine(["curl http://192.168.137.1:3000/api/actuator"]),
            codeLine([""]),
            codeLine(["# 액추에이터 명령 변경 테스트"]),
            codeLine(["curl -X POST http://192.168.137.1:3000/api/actuator ^"]),
            codeLine(['  -H "Content-Type: application/json" ^']),
            codeLine(['  -d "{\\"led_r\\": 255, \\"led_g\\": 100, \\"led_b\\": 0, \\"servo_angle\\": 45}"']),
          ],
          "terminal (Windows cmd)"
        ),
        spacer(100),
        p("(^ 는 Windows cmd의 줄바꿈 기호입니다. PowerShell이라면 각 줄을 한 줄로 이어 붙이거나 백틱을 사용하세요.)", { italics: true, run: { size: 19, color: "666666" } }),
        spacer(120),
        h2("테스트 결과 기록"),
        recordTable(["테스트 명령", "실제 응답 결과"], 4, [3350, 6000]),
        spacer(120),
        h2("확인 체크리스트"),
        ...checklist([
          'POST 후 {"ok": true} 응답이 온다',
          "SELECT * FROM sensor_logs;로 MySQL에서 직접 데이터가 쌓였는지 확인된다",
          "GET /api/actuator 호출 시 방금 설정한 값이 그대로 조회된다",
        ]),
        spacer(80),
        p("이 단계가 실패하면 Pico 코드 문제가 아니라 서버/DB/네트워크 설정 문제이므로, 여기서 먼저 원인을 잡고 넘어가야 합니다.", { italics: true, run: { size: 19, color: "AA0000" } }),

        pageBreak(),

        // 12. Pico Wi-Fi 연결 준비
        h1("12. Pico 2 W — Wi-Fi 연결 및 라이브러리 준비"),
        h2("추가로 필요한 라이브러리"),
        table(
          ["라이브러리", "파일/폴더명", "확인"],
          [
            ["HTTP 요청", "adafruit_requests.mpy", "☐"],
            ["연결 관리(소켓풀/SSL)", "adafruit_connection_manager.mpy", "☐"],
          ],
          [3400, 4550, 1400]
        ),
        spacer(80),
        p("⚠️ 1주차에서 설치한 adafruit_dht.mpy, adafruit_motor 폴더도 이번 주 코드에서 계속 사용됩니다. CIRCUITPY/lib 폴더에 그대로 남아있는지 확인하세요.", { italics: true, run: { size: 19, color: "AA0000" } }),
        spacer(120),
        h2("settings.toml — Wi-Fi 접속 정보 분리 보관"),
        p("파일 위치: CIRCUITPY/settings.toml (루트에 새로 생성). 2번에서 기록한 우리 팀 정보를 그대로 입력하세요."),
        codeBlock(
          [
            codeLine(['CIRCUITPY_WIFI_SSID = "iot-class"']),
            codeLine(['CIRCUITPY_WIFI_PASSWORD = "여기에_핫스팟_비밀번호"']),
            codeLine(['API_BASE_URL = "http://192.168.137.1:3000"']),
          ],
          "settings.toml"
        ),
        spacer(80),
        p("주의: settings.toml을 수정한 후에는 Pico를 한 번 재시작(USB 재연결 또는 리셋 버튼)해야 적용됩니다.", { italics: true, run: { size: 19, color: "666666" } }),
        spacer(140),
        h2("Wi-Fi 연결 테스트 코드"),
        codeBlock(
          [
            codeLine(["import os"]),
            codeLine(["import wifi"]),
            codeLine([""]),
            codeLine(["ssid = os.getenv(", { blank: "①", len: 24 }, ")"]),
            codeLine(['password = os.getenv("CIRCUITPY_WIFI_PASSWORD")']),
            codeLine([""]),
            codeLine(['print(f"{ssid}에 연결 중...")']),
            codeLine(["wifi.radio.connect(ssid, password)"]),
            codeLine(['print("연결 완료! 내 IP 주소:", ', { blank: "②", len: 20 }, ")"]),
          ],
          "wifi_test.py"
        ),
        spacer(80),
        ...hintList(["① settings.toml에 저장한 키 이름 그대로 가져와야 합니다.", "② wifi.radio 객체에는 연결된 내 IP를 담고 있는 속성이 있습니다."]),
        spacer(120),
        p("확인: 이 코드를 code.py로 저장해 실행했을 때 192.168.137.x 처럼 PC 핫스팟과 같은 대역의 IP가 출력되면 성공입니다."),
        p("질문: 만약 전혀 다른 대역의 IP(예: 10.0.0.5)가 출력된다면 무엇을 다시 점검해야 할까요?"),
        fillLine("→"),

        pageBreak(),

        // 13. 실습 1
        h1("13. 실습 1 — 센서값을 서버로 전송 (POST)"),
        p("목표: Wi-Fi로 서버에 연결하고, 센서값을 JSON으로 묶어 REST API에 전송한다."),
        codeBlock(
          [
            codeLine(["import os, time, wifi, board, analogio"]),
            codeLine(["import adafruit_dht"]),
            codeLine(["import adafruit_connection_manager"]),
            codeLine(["import adafruit_requests"]),
            codeLine([""]),
            codeLine(["ssid = os.getenv(\"CIRCUITPY_WIFI_SSID\")"]),
            codeLine(["password = os.getenv(\"CIRCUITPY_WIFI_PASSWORD\")"]),
            codeLine(["api_base = os.getenv(\"API_BASE_URL\")"]),
            codeLine([""]),
            codeLine(["wifi.radio.connect(ssid, password)"]),
            codeLine(["pool = adafruit_connection_manager.get_radio_socketpool(wifi.radio)"]),
            codeLine(["ssl_context = adafruit_connection_manager.get_radio_ssl_context(wifi.radio)"]),
            codeLine(["requests = adafruit_requests.Session(pool, ssl_context)"]),
            codeLine([""]),
            codeLine(["cds = analogio.AnalogIn(board.GP26)"]),
            codeLine(["dht = adafruit_dht.DHT11(board.GP16)"]),
            codeLine([""]),
            codeLine(["def get_light_percent():"]),
            codeLine(["    raw = cds.value"], { indent: 200 }),
            codeLine(["    return round(100 - (raw / 65535 * 100), 1)"], { indent: 200 }),
            codeLine([""]),
            codeLine(["while True:"]),
            codeLine(["    try:"], { indent: 200 }),
            codeLine(["        temperature = dht.temperature"], { indent: 200 }),
            codeLine(["        humidity = dht.humidity"], { indent: 200 }),
            codeLine(["    except RuntimeError as e:"], { indent: 200 }),
            codeLine(['        print("DHT 읽기 재시도:", e)'], { indent: 200 }),
            codeLine(["        time.sleep(2.0)"], { indent: 200 }),
            codeLine(["        continue"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    light_percent = get_light_percent()"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    payload = {"], { indent: 200 }),
            codeLine(['        "temperature": temperature,'], { indent: 200 }),
            codeLine(['        "humidity": humidity,'], { indent: 200 }),
            codeLine(["        ", { blank: "①", len: 28 }], { indent: 200 }),
            codeLine(["    }"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    try:"], { indent: 200 }),
            codeLine(["        response = ", { blank: "②", len: 34 }], { indent: 200 }),
            codeLine(['        print("서버 응답:", response.json())'], { indent: 200 }),
            codeLine(["        response.close()  ", { comment: "# 소켓 자원 반납 — 반드시 호출!" }], { indent: 200 }),
            codeLine(["    except Exception as e:"], { indent: 200 }),
            codeLine(['        print("전송 실패:", e)'], { indent: 200 }),
            codeLine([""]),
            codeLine(["    time.sleep(3.0)"], { indent: 200 }),
          ],
          "sensor_post_test.py"
        ),
        spacer(80),
        ...hintList([
          "① payload에는 temperature, humidity 외에 무엇이 더 필요할까요? (JSON은 \"키\": 값 형태입니다)",
          "② 8번에서 만든 /api/sensor 엔드포인트로 payload를 JSON으로 보내는 requests 메서드를 완성하세요.",
        ]),
        spacer(120),
        p("⚠️ response.close()를 꼭 호출해야 합니다. CircuitPython은 동시에 열 수 있는 소켓 개수가 적어서, 닫지 않고 반복하면 몇 번 만에 오류가 납니다.", { italics: true, run: { size: 19, color: "AA0000" } }),
        spacer(120),
        p("확인: MySQL에서 SELECT * FROM sensor_logs ORDER BY id DESC LIMIT 5; 실행 결과를 기록하세요."),
        recordTable(["시간", "temperature", "humidity", "light_percent"], 3, [2000, 2450, 2450, 2450]),

        pageBreak(),

        // 14. 실습 2
        h1("14. 실습 2 — 서버 명령을 받아 액추에이터 반영 (GET)"),
        p("목표: 서버에 주기적으로 현재 제어 명령을 물어보고(GET), 받은 값을 그대로 LED·서보에 적용한다."),
        codeBlock(
          [
            codeLine(["import os, time, wifi, board, pwmio"]),
            codeLine(["import adafruit_connection_manager"]),
            codeLine(["import adafruit_requests"]),
            codeLine(["from adafruit_motor import servo"]),
            codeLine([""]),
            codeLine(["ssid = os.getenv(\"CIRCUITPY_WIFI_SSID\")"]),
            codeLine(["password = os.getenv(\"CIRCUITPY_WIFI_PASSWORD\")"]),
            codeLine(["api_base = os.getenv(\"API_BASE_URL\")"]),
            codeLine([""]),
            codeLine(["wifi.radio.connect(ssid, password)"]),
            codeLine(["pool = adafruit_connection_manager.get_radio_socketpool(wifi.radio)"]),
            codeLine(["ssl_context = adafruit_connection_manager.get_radio_ssl_context(wifi.radio)"]),
            codeLine(["requests = adafruit_requests.Session(pool, ssl_context)"]),
            codeLine([""]),
            codeLine(["red = pwmio.PWMOut(board.GP17, frequency=1000, duty_cycle=0)"]),
            codeLine(["green = pwmio.PWMOut(board.GP18, frequency=1000, duty_cycle=0)"]),
            codeLine(["blue = pwmio.PWMOut(board.GP19, frequency=1000, duty_cycle=0)"]),
            codeLine([""]),
            codeLine(["servo_pwm = pwmio.PWMOut(board.GP15, duty_cycle=2 ** 15, frequency=50)"]),
            codeLine(["my_servo = servo.Servo(servo_pwm, min_pulse=500, max_pulse=2500)"]),
            codeLine([""]),
            codeLine(["def set_color(r, g, b):"]),
            codeLine(["    red.duty_cycle = int(r / 255 * 65535)"], { indent: 200 }),
            codeLine(["    green.duty_cycle = int(g / 255 * 65535)"], { indent: 200 }),
            codeLine(["    blue.duty_cycle = int(b / 255 * 65535)"], { indent: 200 }),
            codeLine([""]),
            codeLine(["while True:"]),
            codeLine(["    try:"], { indent: 200 }),
            codeLine(["        response = ", { blank: "①", len: 36 }], { indent: 200 }),
            codeLine(["        state = response.json()"], { indent: 200 }),
            codeLine(["        response.close()"], { indent: 200 }),
            codeLine([""]),
            codeLine(['        set_color(state["led_r"], state["led_g"], state["led_b"])'], { indent: 200 }),
            codeLine(["        ", { blank: "②", len: 18 }, ' = state["servo_angle"]'], { indent: 200 }),
            codeLine(['        print("적용된 상태:", state)'], { indent: 200 }),
            codeLine(["    except Exception as e:"], { indent: 200 }),
            codeLine(['        print("명령 수신 실패:", e)'], { indent: 200 }),
            codeLine([""]),
            codeLine(["    time.sleep(2.0)"], { indent: 200 }),
          ],
          "actuator_get_test.py"
        ),
        spacer(80),
        ...hintList([
          "① 9번에서 만든 /api/actuator 엔드포인트에서 현재 상태를 받아오는 requests 메서드를 완성하세요.",
          "② 받은 서보 각도(state[\"servo_angle\"])를 실제로 적용할 대상은 무엇일까요? (실습4, 1주차 참고)",
        ]),
        spacer(120),
        p("동작 확인: 이 코드를 실행한 상태에서 PC에서 curl로 /api/actuator에 다른 색상/각도 값을 POST해보세요. 2초 이내에 Pico의 LED 색과 서보 각도가 바뀌면 성공입니다."),
        ...checklist(["curl로 색상을 바꾸면 2초 안에 LED 색이 바뀐다", "curl로 각도를 바꾸면 2초 안에 서보가 움직인다"]),

        pageBreak(),

        // 15. 종합 실습
        h1("15. 종합 실습 — 센서 전송 + 명령 수신 통합"),
        p("목표: main.py 하나로 센서값은 3초마다 전송하고, 액추에이터 명령은 2초마다 확인해 반영하는 구조로 통합한다. (1주차 종합 실습과 동일하게 time.monotonic()으로 두 작업의 주기를 독립적으로 관리)"),
        codeBlock(
          [
            codeLine(["# main.py — 2주차 종합 실습"]),
            codeLine(["# (Wi-Fi 연결, 센서·액추에이터 초기화, set_color/get_light_percent 함수는 실습1~2와 동일)"]),
            codeLine(["...  ", { comment: "# ssid/password 연결, cds/dht/red/green/blue/my_servo 초기화" }]),
            codeLine([""]),
            codeLine(["last_sensor_send = 0"]),
            codeLine(["last_actuator_check = 0"]),
            codeLine(["current_temp = 25  ", { comment: "# DHT11 읽기 실패 대비 마지막 유효값" }]),
            codeLine([""]),
            codeLine(["while True:"]),
            codeLine(["    now = time.monotonic()"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    # 1) 일정 간격마다 센서값 전송"], { indent: 200 }),
            codeLine(["    if now - last_sensor_send > ", { blank: "①", len: 6 }, ":"], { indent: 200 }),
            codeLine(["        try:"], { indent: 200 }),
            codeLine(["            current_temp = dht.temperature"], { indent: 200 }),
            codeLine(["            humidity = dht.humidity"], { indent: 200 }),
            codeLine(["            light_percent = get_light_percent()"], { indent: 200 }),
            codeLine(["            payload = {"], { indent: 200 }),
            codeLine(['                "temperature": current_temp,'], { indent: 200 }),
            codeLine(['                "humidity": humidity,'], { indent: 200 }),
            codeLine(['                "light_percent": light_percent,'], { indent: 200 }),
            codeLine(["            }"], { indent: 200 }),
            codeLine(['            response = requests.post(f"{api_base}/api/sensor", json=payload)'], { indent: 200 }),
            codeLine(["            response.close()"], { indent: 200 }),
            codeLine(["        except Exception as e:"], { indent: 200 }),
            codeLine(['            print("센서 전송 실패:", e)'], { indent: 200 }),
            codeLine(["        last_sensor_send = now"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    # 2) 일정 간격마다 액추에이터 명령 확인 및 반영"], { indent: 200 }),
            codeLine(["    if now - last_actuator_check > ", { blank: "②", len: 6 }, ":"], { indent: 200 }),
            codeLine(["        try:"], { indent: 200 }),
            codeLine(['            response = requests.get(f"{api_base}/api/actuator")'], { indent: 200 }),
            codeLine(["            state = response.json()"], { indent: 200 }),
            codeLine(["            response.close()"], { indent: 200 }),
            codeLine(['            set_color(state["led_r"], state["led_g"], state["led_b"])'], { indent: 200 }),
            codeLine(['            my_servo.angle = state["servo_angle"]'], { indent: 200 }),
            codeLine(["        except Exception as e:"], { indent: 200 }),
            codeLine(['            print("명령 수신 실패:", e)'], { indent: 200 }),
            codeLine(["        last_actuator_check = now"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    time.sleep(0.2)"], { indent: 200 }),
          ],
          "main.py"
        ),
        spacer(80),
        ...hintList(["①② 이번 실습 목표 설명에 나온 두 숫자(초 단위)를 각각 채워보세요. 센서 전송과 명령 확인의 주기가 다릅니다."]),
        spacer(120),
        h2("동작 확인 체크리스트"),
        ...checklist([
          "MySQL sensor_logs에 데이터가 계속 쌓인다",
          "curl로 /api/actuator에 새 값을 보내면 몇 초 안에 Pico의 LED/서보가 반응한다",
          "Wi-Fi가 잠깐 끊겨도(공유기 재부팅 등) 프로그램이 멈추지 않고 오류만 출력하며 계속 시도한다",
        ]),

        pageBreak(),

        // 16. 트러블슈팅
        h1("16. 트러블슈팅"),
        table(
          ["문제", "점검 순서"],
          [
            ["Pico가 Wi-Fi 연결 자체가 안 됨", "SSID/비밀번호 오타 확인, 2.4GHz 대역인지 확인 (Pico 2 W는 5GHz 미지원)"],
            ["PC에서 모바일 핫스팟 토글이 안 켜짐", "'공유할 인터넷 연결'이 있는지 확인. 유선 이더넷 연결 또는 다른 어댑터 지정. 그래도 안 되면 netsh wlan 명령으로 대체"],
            ["Pico는 연결됐는데 서버 응답이 없음(timeout)", "PC가 핫스팟을 켠 상태가 맞는지, Pico가 다른 Wi-Fi에 붙어있지 않은지 재확인"],
            ["curl 테스트는 되는데 Pico에서만 안 됨", "settings.toml의 API_BASE_URL IP가 ipconfig로 확인한 실제 IP와 일치하는지, Pico 재시작 여부 확인"],
            ["RuntimeError: Sendto failed 반복 발생", "response.close()를 호출하지 않아 소켓이 누적된 경우 — 모든 요청 뒤에 close() 확인"],
            ["MySQL 연결 오류(ECONNREFUSED 등)", "MySQL 서비스가 실행 중인지, .env.local의 계정 정보가 맞는지 확인"],
            ["Windows 방화벽 때문에 외부에서 접속 안 됨", "방화벽 알림에서 '액세스 허용' + '공용 네트워크' 체크박스까지 눌렀는지 확인"],
            ["API 호출 시 500 에러", "Next.js 터미널에 출력되는 실제 에러 로그(console.error) 확인"],
          ],
          [3400, 5950]
        ),
        spacer(160),
        h2("내가 오늘 실제로 겪은 문제"),
        recordTable(["증상", "원인 추정", "해결 방법"], 2, [3117, 3117, 3116]),

        pageBreak(),

        // 17. 마무리
        h1("17. 마무리 정리"),
        h2("오늘 배운 핵심 용어, 나만의 말로 설명하기"),
        recordTable(["용어", "나의 설명"], 4, [2800, 6550]),
        spacer(160),
        h2("다음 주 예고"),
        quoteBox(
          "3주차에서는 REST API를 WebSocket으로 확장해 실시간 스트리밍을 구현하고, 지금까지 curl로 테스트하던 것을 웹 대시보드 화면으로 만들어 센서 그래프 확인과 액추에이터 원격 제어를 브라우저에서 직접 할 수 있도록 완성합니다."
        ),
        spacer(200),
        h2("오늘 실습 소감 / 어려웠던 점"),
        writeBox(5),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  require("fs").writeFileSync(__dirname + "/../2주차_학생워크시트.docx", buf);
  console.log("done");
});
