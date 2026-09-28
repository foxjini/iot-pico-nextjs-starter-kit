// 학생 워크시트 공용 헬퍼 — gen_week1.js 에서 추출
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, PageBreak, VerticalAlign,
} = require("docx");

const KFONT = "Malgun Gothic";
const CFONT = "Courier New";

// ---------- helpers ----------
function h1(text) {
  return new Paragraph({
    keepNext: true,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2F5496" } },
    children: [new TextRun({ text, bold: true, size: 30, font: KFONT, color: "1F3864" })],
  });
}
function h2(text) {
  return new Paragraph({
    keepNext: true,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: KFONT, color: "2F5496" })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    keepNext: !!opts.keepNext,
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

// ---------- 공통 문서 머리말 ----------
function cover(weekLabel, subtitle, intro) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 100 },
      children: [new TextRun({ text: "IoT 스마트 제어 시스템 실습", font: KFONT, size: 22, color: "555555" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: weekLabel, font: KFONT, size: 40, bold: true, color: "1F3864" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: subtitle, font: KFONT, size: 24, color: "2F5496" })],
    }),
    table(["이름", "학번", "조", "날짜"], [["", "", "", ""]], [2340, 2340, 2340, 2330]),
    spacer(240),
    quoteBox(intro),
    spacer(300),
  ];
}

function save(children, filename) {
  const doc = new Document({ sections: [{ properties: {}, children }] });
  Packer.toBuffer(doc).then((buf) => {
    require("fs").writeFileSync(__dirname + "/../" + filename, buf);
    console.log("saved", filename);
  });
}

module.exports = {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, PageBreak, VerticalAlign,
  KFONT, CFONT,
  h1, h2, p, fillLine, checklist, quoteBox, allBorders, cell, table,
  writeBox, recordTable, codeLine, codeBlock, spacer, pageBreak, hintList,
  cover, save,
};
