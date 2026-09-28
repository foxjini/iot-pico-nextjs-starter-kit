const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, PageBreak, VerticalAlign,
} = require("docx");

const KFONT = "Malgun Gothic";
const CFONT = "Courier New";

// ---------- helpers (1·2주차 워크시트와 스타일 통일) ----------
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
          children: [new TextRun({ text: "3주차 학생 워크시트", font: KFONT, size: 40, bold: true, color: "1F3864" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "WebSocket 실시간 통신 + 웹 대시보드", font: KFONT, size: 24, color: "2F5496" })],
        }),
        table(["이름", "학번", "조", "날짜"], [["", "", "", ""]], [2340, 2340, 2340, 2330]),
        spacer(240),
        quoteBox(
          "2주차에서는 REST API(GET/POST)로 몇 초에 한 번씩 데이터를 주고받았습니다. 이번 주는 WebSocket으로 전환해, Pico의 센서값이 실시간으로 화면에 반영되고 브라우저에서 액추에이터를 즉시 제어할 수 있는 웹 대시보드를 완성합니다."
        ),
        spacer(300),

        // 1. 학습 목표
        h1("1. 학습 목표"),
        p("이번 시간이 끝나면 나는 아래 세 가지를 할 수 있습니다."),
        ...checklist([
          "REST(요청-응답)와 WebSocket(양방향 실시간)의 차이를 이해한다.",
          "Pico 2 W에 공식 라이브러리(adafruit_httpserver)로 WebSocket 서버를 구동할 수 있다.",
          "Next.js로 만든 웹 대시보드에서 WebSocket으로 Pico에 직접 접속해, 센서값을 실시간으로 보고 액추에이터를 제어할 수 있다.",
        ]),

        // 2. 아키텍처 차이
        h1("2. 이번 주 아키텍처가 2주차와 다른 점"),
        p("CircuitPython 진영에는 공식적으로 잘 관리되는 WebSocket '클라이언트' 라이브러리가 마땅치 않습니다. 그래서 이번 주는 역할을 아래처럼 뒤집습니다."),
        table(
          ["구분", "2주차 (REST API)", "3주차 (WebSocket)"],
          [
            ["통신 방식", "요청-응답 (필요할 때마다 물어봄)", "양방향 실시간 (연결만 하면 계속 흐름)"],
            ["서버 역할", "Next.js", "Pico 2 W"],
            ["클라이언트 역할", "Pico 2 W", "브라우저 (Next.js 대시보드)"],
          ],
          [2200, 3500, 3650]
        ),
        spacer(100),
        p("질문: 이번 주는 왜 Pico가 (2주차와 반대로) WebSocket '서버' 역할을 맡게 되었을까요?"),
        fillLine("→"),
        spacer(80),
        p("참고: 2주차에서 만든 MySQL 로깅(REST API)은 이번 주 핵심은 아니지만, 필요하면 그대로 병행 운영할 수 있습니다 (8번 항목 참고).", { italics: true, run: { size: 19, color: "666666" } }),

        // 3. 시작 전 확인
        h1("3. 시작 전 확인"),
        ...checklist([
          "Pico가 2주차와 동일한 PC 모바일 핫스팟에 연결 가능한 상태",
          "1주차의 adafruit_dht.mpy, adafruit_motor 폴더가 CIRCUITPY/lib에 그대로 남아있는지 확인",
          "이번 주 새로 필요한 라이브러리를 CIRCUITPY/lib에 추가 (아래 표)",
        ]),
        spacer(80),
        p("⚠️ 이번 주는 Pico의 IP 주소를 그때그때 직접 확인해서 대시보드에 입력해야 합니다. Pico는 핫스팟의 DHCP로 IP를 매번 받아오는 클라이언트라서 PC처럼 고정 IP가 아닙니다 — Serial Monitor에 출력되는 IP를 그대로 확인하세요.", { italics: true, run: { size: 19, color: "AA0000" } }),
        spacer(120),
        h2("이번 주 새로 추가할 라이브러리"),
        table(
          ["라이브러리", "파일/폴더명", "비고"],
          [
            ["HTTP/WebSocket 서버", "adafruit_httpserver 폴더", "Adafruit CircuitPython Library Bundle에서 다운로드"],
            ["비동기 처리", "asyncio 폴더", "CircuitPython 펌웨어에 내장되어 있지 않음 — 반드시 lib에 추가"],
            ["asyncio의 내부 의존 라이브러리", "adafruit_ticks.mpy", "빠뜨리면 ImportError: no module named 'adafruit_ticks' 오류 — 가장 놓치기 쉬운 부분"],
          ],
          [2900, 2700, 3750]
        ),
        spacer(100),
        p("질문: import asyncio라는 문장은 파이썬 표준 내장 모듈처럼 보이지만, CircuitPython에서는 왜 별도로 설치해야 할까요?"),
        fillLine("→"),

        pageBreak(),

        // 4. Pico WebSocket 서버
        h1("4. Pico 2 W — WebSocket 서버 구현"),
        p("목표: Pico가 WebSocket '서버'가 되어, 센서값을 실시간으로 내보내고(push) 브라우저의 제어 명령을 즉시 받아 반영한다."),
        codeBlock(
          [
            codeLine(["import os, json, board, analogio, pwmio, wifi, socketpool"]),
            codeLine(["import adafruit_dht"]),
            codeLine(["from adafruit_motor import servo"]),
            codeLine(["from adafruit_httpserver import GET, Request, Server, Websocket"]),
            codeLine(["from asyncio import create_task, gather, run, sleep as async_sleep"]),
            codeLine([""]),
            codeLine(["# ── Wi-Fi 연결 ──"]),
            codeLine(['ssid = os.getenv("CIRCUITPY_WIFI_SSID")']),
            codeLine(['password = os.getenv("CIRCUITPY_WIFI_PASSWORD")']),
            codeLine(["wifi.radio.connect(ssid, password)"]),
            codeLine(['print("연결 완료! 내 IP 주소:", wifi.radio.ipv4_address)']),
            codeLine([""]),
            codeLine(["pool = socketpool.SocketPool(wifi.radio)"]),
            codeLine(["server = Server(pool, debug=True)"]),
            codeLine([""]),
            codeLine(["# ── 센서·액추에이터 초기화 (1주차와 동일) ──"]),
            codeLine(["cds = analogio.AnalogIn(board.GP26)"]),
            codeLine(["dht = adafruit_dht.DHT11(board.GP16)"]),
            codeLine(["red = pwmio.PWMOut(board.GP17, frequency=1000, duty_cycle=0)"]),
            codeLine(["green = pwmio.PWMOut(board.GP18, frequency=1000, duty_cycle=0)"]),
            codeLine(["blue = pwmio.PWMOut(board.GP19, frequency=1000, duty_cycle=0)"]),
            codeLine(["servo_pwm = pwmio.PWMOut(board.GP15, duty_cycle=2 ** 15, frequency=50)"]),
            codeLine(["my_servo = servo.Servo(servo_pwm, min_pulse=500, max_pulse=2500)"]),
            codeLine([""]),
            codeLine(["def set_color(r, g, b):"]),
            codeLine(["    red.duty_cycle = int(r / 255 * 65535)"], { indent: 200 }),
            codeLine(["    green.duty_cycle = int(g / 255 * 65535)"], { indent: 200 }),
            codeLine(["    blue.duty_cycle = int(b / 255 * 65535)"], { indent: 200 }),
            codeLine([""]),
            codeLine(["def get_light_percent():"]),
            codeLine(["    raw = cds.value"], { indent: 200 }),
            codeLine(["    return round(100 - (raw / 65535 * 100), 1)"], { indent: 200 }),
            codeLine([""]),
            codeLine(["websocket: Websocket = None"]),
            codeLine([""]),
            codeLine(['@server.route(', { blank: "①", len: 24 }, ", GET)"]),
            codeLine(["def connect_client(request: Request):"]),
            codeLine(["    global websocket"], { indent: 200 }),
            codeLine(["    client_ip, client_port = request.client_address"], { indent: 200 }),
            codeLine(["    if websocket is not None:"], { indent: 200 }),
            codeLine(['        print(f"[WS] 기존 연결 종료 (새 클라이언트: {client_ip}:{client_port})")'], { indent: 200 }),
            codeLine(["        websocket.close()"], { indent: 200 }),
            codeLine(["    else:"], { indent: 200 }),
            codeLine(['        print(f"[WS] 클라이언트 연결됨: {client_ip}:{client_port}")'], { indent: 200 }),
            codeLine(["    websocket = Websocket(request)"], { indent: 200 }),
            codeLine(["    return ", { blank: "②", len: 14 }], { indent: 200 }),
            codeLine([""]),
            codeLine(["server.start(str(wifi.radio.ipv4_address), port=5000)"]),
            codeLine(['print(f"WebSocket 서버 시작: ws://{wifi.radio.ipv4_address}:5000/connect-websocket")']),
            codeLine([""]),
            codeLine(["async def handle_http_requests():"]),
            codeLine(["    while True:"], { indent: 200 }),
            codeLine(["        server.poll()"], { indent: 200 }),
            codeLine(["        await async_sleep(0)  ", { comment: "# 다른 태스크에게 실행 기회를 양보" }], { indent: 200 }),
            codeLine([""]),
            codeLine(["async def handle_websocket_requests():"]),
            codeLine(['    """브라우저가 보낸 제어 명령(JSON)을 받아 즉시 반영"""'], { indent: 200 }),
            codeLine(["    global websocket"], { indent: 200 }),
            codeLine(["    while True:"], { indent: 200 }),
            codeLine(["        if websocket is not None:"], { indent: 200 }),
            codeLine(["            try:"], { indent: 200 }),
            codeLine(["                message = websocket.", { blank: "③", len: 14 }, "(fail_silently=True)"], { indent: 200 }),
            codeLine(["            except Exception as e:"], { indent: 200 }),
            codeLine(["                websocket = None"], { indent: 200 }),
            codeLine(["                message = None"], { indent: 200 }),
            codeLine([""]),
            codeLine(["            if message:"], { indent: 200 }),
            codeLine(["                try:"], { indent: 200 }),
            codeLine(["                    command = json.", { blank: "④", len: 12 }, "(message)"], { indent: 200 }),
            codeLine(['                    set_color(command["led_r"], command["led_g"], command["led_b"])'], { indent: 200 }),
            codeLine(['                    my_servo.angle = command["servo_angle"]'], { indent: 200 }),
            codeLine(["                except Exception as e:"], { indent: 200 }),
            codeLine(['                    print("[WS] 명령 파싱/적용 오류:", e)'], { indent: 200 }),
            codeLine(["        await async_sleep(0)"], { indent: 200 }),
            codeLine([""]),
            codeLine(["async def send_sensor_messages():"]),
            codeLine(['    """1초마다 센서값을 JSON으로 브라우저에 push"""'], { indent: 200 }),
            codeLine(["    global websocket"], { indent: 200 }),
            codeLine(["    last_temp = 25"], { indent: 200 }),
            codeLine(["    while True:"], { indent: 200 }),
            codeLine(["        if websocket is not None:"], { indent: 200 }),
            codeLine(["            try:"], { indent: 200 }),
            codeLine(["                last_temp = dht.temperature"], { indent: 200 }),
            codeLine(["                humidity = dht.humidity"], { indent: 200 }),
            codeLine(["            except RuntimeError as e:"], { indent: 200 }),
            codeLine(["                humidity = None"], { indent: 200 }),
            codeLine([""]),
            codeLine(["            payload = json.dumps({"], { indent: 200 }),
            codeLine(['                "temperature": last_temp,'], { indent: 200 }),
            codeLine(['                "humidity": humidity,'], { indent: 200 }),
            codeLine(['                "light_percent": get_light_percent(),'], { indent: 200 }),
            codeLine(["            })"], { indent: 200 }),
            codeLine(["            try:"], { indent: 200 }),
            codeLine(["                websocket.", { blank: "⑤", len: 20 }, "(payload, fail_silently=True)"], { indent: 200 }),
            codeLine(["            except Exception as e:"], { indent: 200 }),
            codeLine(["                websocket = None"], { indent: 200 }),
            codeLine(["        await async_sleep(1)"], { indent: 200 }),
            codeLine([""]),
            codeLine(["async def main():"]),
            codeLine(["    await gather("], { indent: 200 }),
            codeLine(["        create_task(handle_http_requests()),"], { indent: 200 }),
            codeLine(["        create_task(handle_websocket_requests()),"], { indent: 200 }),
            codeLine(["        ", { blank: "⑥", len: 30 }, ","], { indent: 200 }),
            codeLine(["    )"], { indent: 200 }),
            codeLine([""]),
            codeLine(["run(main())"]),
          ],
          "main.py — 3주차: WebSocket 서버"
        ),
        spacer(100),
        ...hintList([
          "① 브라우저가 접속할 주소(경로)입니다. 5번 섹션 대시보드 코드의 접속 주소를 참고하세요.",
          "② 방금 만든 websocket 객체를 그대로 돌려줘야 서버가 연결을 유지합니다.",
          "③ 브라우저가 보낸 메시지를 '받는' 메서드입니다.",
          "④ 문자열(JSON)을 파이썬 객체로 '해석'하는 메서드입니다. (반대는 json.dumps)",
          "⑤ 문자열을 브라우저로 '보내는' 메서드입니다.",
          "⑥ 센서값을 1초마다 push하는 함수를 태스크로 추가해야 합니다. (send_sensor_messages)",
        ]),
        spacer(120),
        p("질문: 세 개의 async 함수는 모두 while True 무한 루프 안에서 await async_sleep(...)을 호출합니다. 만약 이 줄이 없다면 어떤 문제가 생길까요? (asyncio는 한 번에 하나씩만 실행됩니다)"),
        fillLine("→"),
        spacer(120),
        p("실행 후 시리얼 모니터에서 확인할 것: ws://192.168.137.xxx:5000/connect-websocket 형태의 로그가 출력됩니다. 이 IP 주소를 정확히 기록해두세요 — 다음 단계에서 대시보드에 입력해야 합니다."),
        h2("오늘의 Pico IP 기록"),
        recordTable(["시각", "시리얼 모니터에 뜬 Pico IP"], 2, [3350, 6000]),
        spacer(120),
        h2("시리얼 모니터 로그로 상태 진단하기"),
        table(
          ["로그 상태", "의미"],
          [
            ["[WS] 대기 중 이 계속 반복됨", "아직 브라우저가 연결하지 않은 상태 (5번 항목으로 진행)"],
            ["[WS] 클라이언트 연결됨 이 안 뜸", "브라우저가 접속을 시도조차 못하고 있음 (IP/네트워크 확인)"],
            ["[WS] 송신 메시지 는 뜨는데 대시보드에 값이 안 보임", "브라우저 쪽 문제로 좁혀서 확인 가능 (7번 트러블슈팅)"],
          ],
          [3800, 5550]
        ),

        pageBreak(),

        // 5. Next.js 대시보드
        h1("5. Next.js 대시보드 페이지"),
        p("2주차에서 만든 iot-week2-api 프로젝트에 새 페이지를 추가합니다."),
        spacer(80),
        p("⚠️ 사전 설정: localhost가 아닌 핫스팟 IP로 접속할 예정이므로, Next.js 개발 서버의 cross-origin 차단을 미리 풀어둬야 합니다.", { italics: true, run: { size: 19, color: "AA0000" } }),
        codeBlock(
          [
            codeLine(['import type { NextConfig } from "next";']),
            codeLine([""]),
            codeLine(["const nextConfig: NextConfig = {"]),
            codeLine(['  allowedDevOrigins: ["192.168.137.1", "192.168.137.*"],'], { indent: 200 }),
            codeLine(["};"]),
            codeLine([""]),
            codeLine(["export default nextConfig;"]),
          ],
          "next.config.ts"
        ),
        spacer(80),
        p("이 설정 없이 192.168.137.1:3000으로 접속하면 페이지는 열리지만 _next/static/... 스크립트와 Hot Reload용 WebSocket이 403으로 막혀 화면이 정상 동작하지 않습니다.", { italics: true, run: { size: 19, color: "666666" } }),
        spacer(120),
        p("파일 위치: src/app/dashboard/page.tsx"),
        codeBlock(
          [
            codeLine(['"use client";']),
            codeLine([""]),
            codeLine(['import { useEffect, useRef, useState } from "react";']),
            codeLine([""]),
            codeLine(["type SensorData = {"]),
            codeLine(["  temperature: number | null;"], { indent: 200 }),
            codeLine(["  humidity: number | null;"], { indent: 200 }),
            codeLine(["  light_percent: number;"], { indent: 200 }),
            codeLine(["};"]),
            codeLine([""]),
            codeLine(["export default function DashboardPage() {"]),
            codeLine(['  const [picoIp, setPicoIp] = useState("192.168.137.50"); ', { comment: "// Pico 시리얼모니터에 뜬 실제 IP로 변경" }], { indent: 200 }),
            codeLine(["  const [connected, setConnected] = useState(false);"], { indent: 200 }),
            codeLine(["  const [sensor, setSensor] = useState<SensorData | null>(null);"], { indent: 200 }),
            codeLine(['  const [ledColor, setLedColor] = useState("#ff8800");'], { indent: 200 }),
            codeLine(["  const [servoAngle, setServoAngle] = useState(90);"], { indent: 200 }),
            codeLine(["  const wsRef = useRef<WebSocket | null>(null);"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  const connect = () => {"], { indent: 200 }),
            codeLine(["    wsRef.current?.close();"], { indent: 200 }),
            codeLine(["    const ws = new WebSocket(`ws://${picoIp}:", { blank: "①", len: 8 }, "/connect-websocket`);"], { indent: 200 }),
            codeLine(["    ws.onopen = () => {"], { indent: 200 }),
            codeLine(["      setConnected(", { blank: "②", len: 8 }, ");"], { indent: 200 }),
            codeLine(["    };"], { indent: 200 }),
            codeLine(["    ws.onclose = () => setConnected(false);"], { indent: 200 }),
            codeLine(["    ws.onerror = () => setConnected(false);"], { indent: 200 }),
            codeLine(["    ws.onmessage = (event) => {"], { indent: 200 }),
            codeLine(["      try {"], { indent: 200 }),
            codeLine(["        setSensor(", { blank: "③", len: 16 }, "(event.data));"], { indent: 200 }),
            codeLine(["      } catch {"], { indent: 200 }),
            codeLine(['        console.warn("잘못된 메시지 형식:", event.data);'], { indent: 200 }),
            codeLine(["      }"], { indent: 200 }),
            codeLine(["    };"], { indent: 200 }),
            codeLine(["    wsRef.current = ws;"], { indent: 200 }),
            codeLine(["  };"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  const sendCommand = () => {"], { indent: 200 }),
            codeLine(["    if (wsRef.current?.readyState === WebSocket.", { blank: "④", len: 10 }, ") {"], { indent: 200 }),
            codeLine(["      const r = parseInt(ledColor.slice(1, 3), 16);"], { indent: 200 }),
            codeLine(["      const g = parseInt(ledColor.slice(3, 5), 16);"], { indent: 200 }),
            codeLine(["      const b = parseInt(ledColor.slice(5, 7), 16);"], { indent: 200 }),
            codeLine(["      const command = { led_r: r, led_g: g, led_b: b, servo_angle: servoAngle };"], { indent: 200 }),
            codeLine(["      wsRef.current.send(", { blank: "⑤", len: 20 }, "(command));"], { indent: 200 }),
            codeLine(["    }"], { indent: 200 }),
            codeLine(["  };"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  useEffect(() => {"], { indent: 200 }),
            codeLine(["    return () => wsRef.current?.close();"], { indent: 200 }),
            codeLine(["  }, []);"], { indent: 200 }),
            codeLine([""]),
            codeLine(["  return ("], { indent: 200 }),
            codeLine(["    // 화면(JSX): IP 입력창 + 연결 버튼 + 센서값 표시 + 색상/각도 컨트롤"], { indent: 200 }),
            codeLine(["    // 레이아웃과 스타일 코드는 교재를 그대로 참고해 작성하세요"], { indent: 200 }),
            codeLine(["    ..."], { indent: 200 }),
            codeLine(["  );"], { indent: 200 }),
            codeLine(["}"]),
          ],
          "src/app/dashboard/page.tsx"
        ),
        spacer(100),
        ...hintList([
          "① 4번 섹션의 main.py에서 server.start(..., port=____)로 지정한 포트 번호입니다.",
          "② WebSocket 연결이 '열렸을 때(onopen)' 상태를 어떻게 바꿔야 할까요?",
          "③ 받은 문자열(JSON)을 자바스크립트 객체로 '해석'하는 내장 함수입니다.",
          "④ WebSocket이 연결되어 '열린' 상태를 나타내는 상수입니다.",
          "⑤ 자바스크립트 객체를 문자열(JSON)로 '변환'하는 내장 함수입니다. (③의 반대)",
        ]),
        spacer(120),
        p("실행: 2주차와 동일하게 npm run dev:lan으로 실행한 뒤, 같은 핫스팟에 연결된 기기의 브라우저에서 http://192.168.137.1:3000/dashboard로 접속합니다."),

        pageBreak(),

        // 6. 함께 테스트하기
        h1("6. 함께 테스트하기"),
        p("아래 순서대로 진행하며 각 단계를 체크하세요."),
        ...checklist([
          "① Pico에 4번 항목 코드를 저장·실행 → Serial Monitor에서 ws://192.168.137.xxx:5000/... IP 확인",
          "② 브라우저에서 /dashboard 접속 → 입력창에 방금 확인한 Pico IP 입력 → 연결 클릭",
          "③ 상태가 '🟢 연결됨'으로 바뀌고, 1초마다 온도/습도/조도 값이 갱신되는지 확인",
          "④ LED 색상 선택 후 적용 클릭 → Pico의 RGB LED 색이 바뀌는지 확인",
          "⑤ 서보 각도 슬라이더 조절 후 적용 클릭 → 서보모터가 그 각도로 움직이는지 확인",
        ]),
        spacer(120),
        h2("동작 확인 체크리스트"),
        ...checklist([
          "Pico 재시작 후에도(IP가 바뀔 수 있음) 대시보드에 새 IP를 입력하면 다시 연결된다",
          "여러 번 연결/해제를 반복해도 Pico가 멈추지 않는다 (websocket.close() 로직 덕분)",
          "온습도/조도 값이 1초 간격으로 계속 갱신된다",
          "LED/서보 제어가 거의 즉시(REST 방식보다 훨씬 빠르게) 반영된다",
        ]),
        spacer(120),
        p("질문: 2주차(REST)와 비교했을 때, LED·서보 제어 명령이 반영되는 속도는 왜 다를까요?"),
        fillLine("→"),

        pageBreak(),

        // 7. 트러블슈팅
        h1("7. 트러블슈팅"),
        table(
          ["문제", "점검 순서"],
          [
            ["'연결'/'적용' 버튼이 화면에 안 보임(클릭도 안 됨)", "Tailwind 기본 리셋이 버튼 배경/테두리를 지우는 현상 — style로 배경색/글자색 명시 지정"],
            ["_next/static/... 요청 403, HMR WebSocket 연결 실패", "cross-origin 차단 — next.config.ts의 allowedDevOrigins 설정 확인, 설정 후 서버 재시작 필수"],
            ["'연결' 눌러도 상태가 계속 '🔴 연결 안됨'", "시리얼 모니터에 [WS] 클라이언트 연결됨 로그 확인 — 안 뜨면 IP/네트워크, 뜨는데 안 되면 브라우저(F12 콘솔) 문제"],
            ["처음엔 연결되는데 몇 초 후 끊김", "Pico 쪽 while True 루프에서 예외로 main()이 멈췄을 가능성 — 시리얼 모니터 Traceback 확인"],
            ["센서값이 대시보드에 안 뜸", "[WS] 송신 메시지 가 찍히는데 안 보이면 브라우저 문제, 안 찍히면 websocket이 None으로 끊긴 상태"],
            ["LED/서보가 반응 안 함", "[WS] 수신 메시지 · 명령 적용 완료 로그 확인 — 안 뜨면 브라우저 전송 문제, 뜨는데 안 움직이면 배선/핀 문제"],
            ["adafruit_httpserver import 오류", "CIRCUITPY/lib/adafruit_httpserver 폴더 전체가 들어있는지 확인 (폴더 구조임)"],
            ["ImportError: no module named 'adafruit_ticks'", "asyncio 폴더의 내부 의존 라이브러리 adafruit_ticks.mpy를 빠뜨린 경우 — 3번 항목 표 참고"],
            ["브라우저 콘솔에 Mixed Content 오류", "대시보드를 https://로 열었을 때 발생 — 이번 실습은 http://로 접속 (사설 네트워크에는 SSL 인증서 없음)"],
          ],
          [3400, 5950]
        ),
        spacer(160),
        h2("내가 오늘 실제로 겪은 문제"),
        recordTable(["증상", "원인 추정", "해결 방법"], 2, [3117, 3117, 3116]),

        // 8. 심화/선택
        h1("8. (심화/선택) 2주차 MySQL 로깅과 병행하기"),
        p("이번 주 핵심 실습은 아니지만, 여유가 되는 팀은 2주차의 sensor_post_test.py 코드를 send_sensor_messages() 옆에 별도 태스크로 추가해서, 실시간 대시보드(WebSocket)와 이력 저장(REST+MySQL)을 동시에 운영해볼 수 있습니다."),
        p("도전 과제: asyncio.gather()에 태스크를 하나 더 추가하려면 main() 함수를 어떻게 수정해야 할까요? (4번 섹션의 ⑥번 빈칸 주변을 참고하세요)"),
        fillLine("→"),

        pageBreak(),

        // 9. 마무리
        h1("9. 마무리 정리"),
        quoteBox(
          "1주차(로컬 센서/액추에이터) → 2주차(Wi-Fi + REST API + MySQL) → 3주차(WebSocket 실시간 대시보드)까지, IoT 시스템의 기본 구성 요소(센서, 액추에이터, 네트워크, 백엔드, 데이터베이스, 실시간 통신, 웹 대시보드)를 모두 경험했습니다."
        ),
        spacer(160),
        h2("오늘 배운 핵심 용어, 나만의 말로 설명하기"),
        recordTable(["용어", "나의 설명"], 4, [2800, 6550]),
        spacer(160),
        h2("다음 주 예고"),
        quoteBox(
          "8주차에서는 이 대시보드에 Bootstrap 부품을 한 번에 하나씩 넣어가며 화면과 동작이 어떻게 달라지는지 확인합니다. 오늘 만든 화면이 그 출발점이 되고, 이후 9·11·12주차를 거쳐 11월 20일 전시회에 세울 작품 화면으로 이어집니다."
        ),
        spacer(200),
        h2("오늘 실습 소감 / 어려웠던 점"),
        writeBox(5),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  require("fs").writeFileSync(__dirname + "/../3주차_학생워크시트.docx", buf);
  console.log("done");
});
