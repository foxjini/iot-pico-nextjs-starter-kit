const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, PageBreak, VerticalAlign,
} = require("docx");

const KFONT = "Malgun Gothic";
const CFONT = "Courier New";

// ---------- helpers ----------
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2F5496" } },
    children: [new TextRun({ text, bold: true, size: 30, font: KFONT, color: "1F3864" })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
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
// code line: array of segments; each segment is string (plain code) or {blank:"①"}
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
          children: [new TextRun({ text: "1주차 학생 워크시트", font: KFONT, size: 40, bold: true, color: "1F3864" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "Pico 2 W 로컬 센서 · 액추에이터 제어", font: KFONT, size: 24, color: "2F5496" })],
        }),
        table(
          ["이름", "학번", "조", "날짜"],
          [["", "", "", ""]],
          [2340, 2340, 2340, 2330]
        ),
        spacer(240),
        quoteBox(
          "이번 주는 네트워크(Wi-Fi)를 전혀 사용하지 않습니다. Pico 2 W 보드 하나만으로 센서 값을 읽고 액추에이터를 움직이는 것에 집중합니다. Wi-Fi·API 연동은 2주차부터 다룹니다."
        ),
        spacer(300),

        // 1. 학습 목표
        h1("1. 학습 목표"),
        p("이번 시간이 끝나면 나는 아래 세 가지를 할 수 있습니다."),
        ...checklist([
          "CircuitPython으로 디지털 센서(DHT11)와 아날로그 센서(CdS)의 값을 읽을 수 있다.",
          "PWM을 이용해 RGB LED의 색과 밝기, SG90 서보모터의 각도를 제어할 수 있다.",
          "센서 값에 따라 액추에이터가 반응하는 간단한 자동 제어 로직을 작성할 수 있다.",
        ]),

        // 2. 시작 전 확인
        h1("2. 시작 전 확인"),
        ...checklist([
          "VS Code에 CircuitPython 확장(extension) 설치 확인 (또는 Mu 에디터 사용 가능)",
          "Pico 2 W를 USB로 연결하면 CIRCUITPY 드라이브가 탐색기에 보이는지 확인",
          "CIRCUITPY/lib 폴더 안에 아래 라이브러리가 들어있는지 확인",
        ]),
        spacer(80),
        table(
          ["필요 라이브러리", "파일/폴더명 (CIRCUITPY/lib 안)", "확인"],
          [
            ["DHT11 온습도 센서", "adafruit_dht.mpy", "☐"],
            ["서보모터 제어", "adafruit_motor 폴더 (servo.mpy 포함)", "☐"],
          ],
          [3400, 4950, 1000]
        ),

        // 3. 부품 목록
        h1("3. 부품 목록 확인"),
        p("실습 전, 아래 부품을 모두 받았는지 확인하고 체크하세요."),
        table(
          ["부품", "수량", "비고", "수령"],
          [
            ["Raspberry Pi Pico 2 W", "1", "CircuitPython 펌웨어 설치 완료", "☐"],
            ["DHT11 온습도 센서 (3핀 모듈형)", "1", "", "☐"],
            ["CdS 조도센서", "1", "", "☐"],
            ["10kΩ 저항", "1", "CdS 전압분배용", "☐"],
            ["RGB LED 모듈 (저항 내장, 4핀)", "1", "핀 순서: 위에서부터 GND·B·G·R", "☐"],
            ["전해 커패시터 470~1000μF", "1", "서보 전원 안정화 (아래 전원 주의 참고)", "☐"],
            ["SG90 서보모터", "1", "", "☐"],
            ["브레드보드, 점퍼선", "다수", "", "☐"],
          ],
          [3400, 900, 3650, 1400]
        ),

        // 4. 배선하기
        h1("4. 배선하기"),
        p("아래 배선표를 보고 직접 브레드보드에 연결하세요."),
        table(
          ["부품 핀", "Pico 2 W 핀", "설명"],
          [
            ["DHT11 VCC", "3V3(OUT)", ""],
            ["DHT11 GND", "GND", ""],
            ["DHT11 DATA", "GP16", ""],
            ["10kΩ 저항 한쪽", "3V3(OUT)", "고정저항이 3V3 쪽"],
            ["10kΩ 다른쪽 + CdS 한쪽 다리", "GP26(ADC0)", "이 지점이 분압점"],
            ["CdS 다른쪽 다리", "GND", "CdS가 GND 쪽 — 반대로 꽂으면 무드등이 정반대로 동작"],
            ["RGB 모듈 GND (맨 위)", "GND", ""],
            ["RGB 모듈 B", "GP19", "저항 내장이므로 220Ω 불필요"],
            ["RGB 모듈 G", "GP18", ""],
            ["RGB 모듈 R (맨 아래)", "GP17", ""],
            ["SG90 갈색(GND)", "GND", ""],
            ["SG90 빨강(VCC)", "VBUS(5V)", "3V3이 아닌 5V(VBUS) 사용"],
            ["SG90 주황(신호)", "GP15", ""],
          ],
          [3000, 3550, 2800]
        ),
        spacer(160),
        quoteBox(
          "전원 주의 — 서보가 움직이는 순간 Pico가 리셋된다면 배선이 헐거워서가 아니라 전류가 모자라서입니다. SG90은 대기 중 5~15mA지만 기동·방향 전환 순간에 700~1000mA까지 끌어 씁니다. 노트북 USB 2.0 포트는 500mA뿐이라 그 순간 전압이 주저앉아 Pico가 재부팅됩니다. 470~1000μF 전해 커패시터를 서보 전원(빨강 ↔ 갈색) 바로 옆에 달면 커패시터가 순간 전류를 대신 내줍니다. 전해 커패시터는 극성이 있으니 긴 다리가 +(빨강 쪽)입니다."
        ),
        spacer(200),
        h2("배선 이해 확인"),
        p("1) CdS는 밝을 때와 어두울 때 중 언제 저항이 더 커질까요? 그렇다면 ADC로 읽는 raw 값은 밝을 때와 어두울 때 중 언제 더 클까요?"),
        fillLine("→ 저항이 더 큰 쪽: ______________  /  raw 값이 더 큰 쪽: "),
        p("2) SG90 서보모터의 빨강선(VCC)은 왜 3V3이 아니라 VBUS(5V)에 연결해야 할까요?"),
        fillLine("→"),
        spacer(120),
        h2("배선 완료 체크"),
        ...checklist([
          "DHT11 3핀(VCC / GND / DATA) 연결 완료",
          "CdS + 10kΩ 분압회로 연결 완료",
          "RGB 모듈 4핀 연결 완료 (위에서부터 GND·B·G·R — 따로 220Ω을 달지 않았다)",
          "SG90 서보모터 3선 연결 완료 (VCC는 반드시 VBUS!)",
          "서보 전원에 커패시터(470~1000μF)를 달았다 — 긴 다리가 +(빨강 쪽)",
        ]),

        pageBreak(),

        // 5. 실습 1 - CdS
        h1("5. 실습 1 — CdS 조도센서 값 읽기"),
        p("목표: 아날로그 센서의 원시값(raw)을 읽고, 이를 이해하기 쉬운 '밝기 %'로 변환한다.", { bold: false }),
        codeBlock(
          [
            codeLine(["import board"]),
            codeLine(["import analogio"]),
            codeLine(["import time"]),
            codeLine([""]),
            codeLine(["cds = analogio.AnalogIn(board.", { blank: "①", len: 8 }, ")"]),
            codeLine([""]),
            codeLine(["def get_light_percent():"]),
            codeLine(["    raw = cds.value  ", { comment: "# 0 ~ 65535" }], { indent: 200 }),
            codeLine(["    percent = ", { blank: "②", len: 22 }], { indent: 200 }),
            codeLine(["    return round(percent, 1)"], { indent: 200 }),
            codeLine([""]),
            codeLine(["while True:"]),
            codeLine(['    print(f"조도 원시값: {cds.value:5d}  |  밝기: {get_light_percent()}%")'], { indent: 200 }),
            codeLine(["    time.sleep(0.5)"], { indent: 200 }),
          ],
          "cds_test.py"
        ),
        spacer(100),
        ...hintList(["① 배선표에서 CdS가 연결된 핀을 확인하세요.", "② '값이 작을수록 밝음'이 되도록 raw(0~65535)를 100에서 빼는 식으로 바꿔보세요."]),
        spacer(140),
        h2("실행 결과 기록"),
        recordTable(["측정 상황", "raw 값", "밝기(%)"], 3, [3350, 3000, 3000]),
        p("(측정 상황 예시: 밝은 곳 / 손으로 살짝 가림 / 완전히 가림)", { italics: true, run: { size: 18, color: "666666" } }),
        spacer(100),
        p("질문: raw 값과 밝기(%)는 왜 반대 방향으로 움직일까요? 완성한 계산식을 근거로 설명해보세요."),
        fillLine("→"),

        pageBreak(),

        // 6. 실습 2 - RGB LED
        h1("6. 실습 2 — RGB LED 색상·밝기 제어"),
        p("목표: PWM의 duty_cycle 값으로 LED의 밝기를 조절하는 원리를 이해한다."),
        codeBlock(
          [
            codeLine(["import board"]),
            codeLine(["import pwmio"]),
            codeLine(["import time"]),
            codeLine([""]),
            codeLine(["# duty_cycle은 0~65535 범위. 값이 클수록 밝음 (공통 캐소드 기준)"]),
            codeLine(["red = pwmio.PWMOut(board.", { blank: "①", len: 6 }, ", frequency=1000, duty_cycle=0)"]),
            codeLine(["green = pwmio.PWMOut(board.", { blank: "②", len: 6 }, ", frequency=1000, duty_cycle=0)"]),
            codeLine(["blue = pwmio.PWMOut(board.", { blank: "③", len: 6 }, ", frequency=1000, duty_cycle=0)"]),
            codeLine([""]),
            codeLine(["def set_color(r, g, b):"]),
            codeLine(['    """r, g, b는 각각 0~255 범위로 입력"""'], { indent: 200 }),
            codeLine(["    red.duty_cycle = ", { blank: "④", len: 20 }], { indent: 200 }),
            codeLine(["    green.duty_cycle = int(g / 255 * 65535)"], { indent: 200 }),
            codeLine(["    blue.duty_cycle = int(b / 255 * 65535)"], { indent: 200 }),
            codeLine([""]),
            codeLine(["colors = [(255,0,0), (0,255,0), (0,0,255), (255,255,255), (0,0,0)]"]),
            codeLine([""]),
            codeLine(["for r, g, b in colors:"]),
            codeLine(["    set_color(r, g, b)"], { indent: 200 }),
            codeLine(["    time.sleep(1)"], { indent: 200 }),
          ],
          "rgb_led_test.py"
        ),
        spacer(100),
        ...hintList(["①②③ 배선표를 참고해 R·G·B가 각각 연결된 핀을 채우세요.", "④ green/blue 줄과 같은 패턴으로, r을 0~255에서 0~65535 범위로 바꿔보세요."]),
        spacer(140),
        h2("관찰 기록"),
        recordTable(["순서", "코드상 색상(r,g,b)", "실제로 보인 색"], 5, [2000, 3350, 4000]),
        spacer(100),
        p("질문: 만약 우리 RGB LED가 공통 애노드(Common Anode) 타입이라면, ④번 계산식을 어떻게 바꿔야 할까요?"),
        fillLine("→"),

        pageBreak(),

        // 7. 실습 3 - DHT11
        h1("7. 실습 3 — DHT11 온습도 읽기"),
        p("목표: 디지털 센서에서 온도·습도 두 값을 동시에 읽고, 통신 오류에 대비하는 코드를 작성한다."),
        codeBlock(
          [
            codeLine(["import board"]),
            codeLine(["import adafruit_dht"]),
            codeLine(["import time"]),
            codeLine([""]),
            codeLine(["dht = adafruit_dht.DHT11(board.", { blank: "①", len: 8 }, ")"]),
            codeLine([""]),
            codeLine(["while True:"]),
            codeLine(["    try:"], { indent: 200 }),
            codeLine(["        temperature = ", { blank: "②", len: 14 }], { indent: 200 }),
            codeLine(["        humidity = ", { blank: "③", len: 14 }], { indent: 200 }),
            codeLine(['        print(f"온도: {temperature}°C  |  습도: {humidity}%")'], { indent: 200 }),
            codeLine(["    except RuntimeError as e:"], { indent: 200 }),
            codeLine(['        print("센서 읽기 재시도:", e)'], { indent: 200 }),
            codeLine([""]),
            codeLine(["    time.sleep(", { blank: "④", len: 6 }, ")  ", { comment: "# DHT11은 최소 2초 이상 간격 필요" }], { indent: 200 }),
          ],
          "dht11_test.py"
        ),
        spacer(100),
        ...hintList(["② ③ dht 객체에는 .temperature, .humidity 속성이 있습니다.", "④ 교재 본문의 '시작 전 확인'과 아래 트러블슈팅 표를 참고하세요."]),
        spacer(140),
        h2("측정 기록"),
        recordTable(["측정 횟수", "온도(°C)", "습도(%)"], 2, [3350, 3000, 3000]),
        spacer(140),
        h2("자주 발생하는 오류와 해결"),
        table(
          ["증상", "원인", "해결"],
          [
            ["RuntimeError: Checksum did not validate 가 계속 뜸", "배선 접촉 불량, 너무 짧은 읽기 간격", "점퍼선 재결합, sleep()을 2초 이상 유지"],
            ["값이 항상 None", "DATA 핀 번호 오타, 4핀 센서(풀업저항 없음) 사용", "핀 번호 재확인, 4핀이면 풀업저항 10kΩ 추가"],
          ],
          [3450, 3050, 2850]
        ),
        spacer(100),
        p("질문: DHT11은 왜 2초 이상 간격을 두고 읽어야 할까요?"),
        fillLine("→"),

        pageBreak(),

        // 8. 실습 4 - Servo
        h1("8. 실습 4 — SG90 서보모터 각도 제어"),
        p("목표: PWM 신호로 서보모터의 정확한 각도를 제어한다."),
        codeBlock(
          [
            codeLine(["import board"]),
            codeLine(["import pwmio"]),
            codeLine(["import time"]),
            codeLine(["from adafruit_motor import servo"]),
            codeLine([""]),
            codeLine(["pwm = pwmio.PWMOut(board.", { blank: "①", len: 6 }, ", duty_cycle=2 ** 15, frequency=50)"]),
            codeLine(["my_servo = servo.Servo(pwm, min_pulse=500, max_pulse=2500)"]),
            codeLine([""]),
            codeLine(["# 원하는 각도 순서를 직접 정해보세요"]),
            codeLine(["for angle in [", { blank: "②", len: 22 }, "]:"]),
            codeLine(["    my_servo.angle = angle"], { indent: 200 }),
            codeLine(['    print(f"서보 각도: {angle}도")'], { indent: 200 }),
            codeLine(["    time.sleep(1)"], { indent: 200 }),
          ],
          "servo_test.py"
        ),
        spacer(100),
        ...hintList(["① 배선표에서 SG90 신호선(주황)이 연결된 핀을 확인하세요.", "② 0~180 사이의 각도를 원하는 순서로 나열해보세요. 예) 0, 90, 180, 0"]),
        spacer(140),
        h2("동작 확인"),
        ...checklist(["0도로 이동 확인", "90도로 이동 확인", "180도로 이동 확인 — 회전이 끝단에서 심하게 떨린다면 max_pulse를 2400 정도로 줄여보기"]),

        pageBreak(),

        // 9. 종합 실습
        h1("9. 종합 실습 — 조도 연동 무드등 + 온도 연동 게이지"),
        p("목표: 지금까지 만든 4개 부품을 하나로 합쳐 '감지 → 판단 → 동작' 흐름을 완성한다. 어두워지면 RGB LED가 무드등처럼 켜지고, 온도에 따라 서보 바늘이 게이지처럼 움직입니다."),
        h2("설계해보기"),
        p("아래 빈칸을 채워 이번 종합 실습의 감지 → 판단 → 동작 흐름을 정리해보세요."),
        table(
          ["구분", "① 감지 (무엇을 읽는가)", "② 판단 (어떤 조건인가)", "③ 동작 (무엇을 하는가)"],
          [
            ["무드등", "", "", ""],
            ["온도 게이지", "", "", ""],
          ],
          [1700, 2550, 2550, 2550]
        ),
        spacer(200),
        codeBlock(
          [
            codeLine(["# main.py — 1주차 종합 실습  (센서·액추에이터 초기화 부분은 실습1~4와 동일)"]),
            codeLine(["...  ", { comment: "# cds, dht, red/green/blue, temp_gauge 초기화 + set_color/get_light_percent/clamp 함수" }]),
            codeLine([""]),
            codeLine(["last_dht_read = 0"]),
            codeLine(["current_temp = 25  ", { comment: "# DHT11 읽기 실패 시 사용할 마지막 유효값" }]),
            codeLine([""]),
            codeLine(["while True:"]),
            codeLine(["    # 1) 조도값을 읽어 무드등 밝기 결정 (어두울수록 밝게)"], { indent: 200 }),
            codeLine(["    light_percent = get_light_percent()"], { indent: 200 }),
            codeLine(["    if ", { blank: "①", len: 20 }, ":  ", { comment: "# 어두운 환경 조건" }], { indent: 200 }),
            codeLine(["        brightness = clamp(int((40 - light_percent) / 40 * 255), 0, 255)"], { indent: 200 }),
            codeLine(["        set_color(255, brightness // 2, 0)"], { indent: 200 }),
            codeLine(["    else:"], { indent: 200 }),
            codeLine(["        set_color(0, 0, 0)"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    # 2) DHT11은 2초 이상 간격으로만 읽기"], { indent: 200 }),
            codeLine(["    now = time.monotonic()"], { indent: 200 }),
            codeLine(["    if now - last_dht_read > 2.0:"], { indent: 200 }),
            codeLine(["        try:"], { indent: 200 }),
            codeLine(["            current_temp = dht.temperature"], { indent: 200 }),
            codeLine(["        except RuntimeError:"], { indent: 200 }),
            codeLine(["            pass"], { indent: 200 }),
            codeLine(["        last_dht_read = now"], { indent: 200 }),
            codeLine([""]),
            codeLine(["    # 3) 온도(0~40도)를 서보 각도(0~180도)로 매핑"], { indent: 200 }),
            codeLine(["    angle = ", { blank: "②", len: 24 }], { indent: 200 }),
            codeLine(["    temp_gauge.angle = angle"], { indent: 200 }),
            codeLine([""]),
            codeLine(['    print(f"밝기: {light_percent:.1f}%  |  온도: {current_temp}°C  |  서보각도: {angle:.0f}도")'], { indent: 200 }),
            codeLine(["    time.sleep(0.3)"], { indent: 200 }),
          ],
          "main.py"
        ),
        spacer(100),
        ...hintList([
          "① 실습1에서 구한 밝기(%)가 40보다 작을 때를 '어둡다'고 판단합니다.",
          "② clamp() 함수를 사용해 (current_temp / 40) * 180 값이 0~180 범위를 벗어나지 않게 만들어보세요.",
        ]),
        spacer(140),
        h2("동작 확인 체크리스트"),
        ...checklist([
          "방을 어둡게 하면(또는 CdS를 손으로 가리면) RGB LED가 켜진다",
          "밝은 곳에서는 LED가 꺼진다",
          "손으로 DHT11을 감싸 온도를 높이면 서보 각도가 커진다(바늘이 더 돌아간다)",
          "시리얼 모니터에 값이 끊기지 않고 계속 출력된다",
        ]),

        // 10. 트러블슈팅
        h1("10. 트러블슈팅 자가진단"),
        table(
          ["문제", "점검 순서"],
          [
            ["CIRCUITPY 드라이브가 안 보임", "USB 케이블이 데이터 전송용인지 확인(충전 전용 케이블 아닌지), 다른 USB 포트 시도"],
            ["ImportError: no module named 'adafruit_dht' 등", "lib 폴더에 해당 라이브러리가 실제로 들어있는지, 폴더/파일명 오타가 없는지 확인"],
            ["코드 저장했는데 반영이 안 됨", "code.py 또는 main.py라는 파일명으로 CIRCUITPY 루트에 저장했는지 확인"],
            ["서보가 힘없이 떨기만 함", "전원을 3V3이 아닌 VBUS(5V)에 연결했는지 확인"],
            ["서보가 움직이는 순간 Pico가 리셋된다", "전류 부족입니다. 커패시터(470~1000μF)를 서보 전원 옆에 다세요. 배선을 다시 꽂는 것으로는 해결되지 않습니다"],
            ["LED가 항상 켜져 있거나 항상 꺼짐", "RGB 모듈의 GND 핀이 맨 위인지 확인. 핀 순서가 다르면 기판에 인쇄된 글자를 보고 맞추세요"],
          ],
          [3800, 5550]
        ),
        spacer(160),
        h2("내가 오늘 실제로 겪은 문제"),
        recordTable(["증상", "원인 추정", "해결 방법"], 2, [3117, 3117, 3116]),

        pageBreak(),

        // 11. 마무리
        h1("11. 마무리 정리"),
        h2("오늘 배운 핵심 용어, 나만의 말로 설명하기"),
        recordTable(["용어", "나의 설명"], 3, [2800, 6550]),
        spacer(160),
        h2("다음 주 예고"),
        quoteBox(
          "2주차부터는 이번 시간에 만든 센서·액추에이터 코드에 Wi-Fi 연결을 추가하고, Next.js(TS)로 만든 백엔드 API에 센서 값을 전송(REST, JSON)하고 MySQL에 저장하는 과정을 다룹니다."
        ),
        spacer(200),
        h2("오늘 실습 소감 / 어려웠던 점"),
        writeBox(5),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  require("fs").writeFileSync(__dirname + "/../1주차_학생워크시트.docx", buf);
  console.log("done");
});
