// 수행평가 학습지 HTML → A4 가로 PDF (앞면 회로도 · 설명, 뒷면 배선 연습), 꼬리말에 쪽 번호 「1 / 2」
//   python3 draw_assessment_circuit.py 로 그림을 먼저 만든 뒤  node make_assess_worksheet.js   →   worksheets/수행평가 학습지.pdf
// Playwright(Chromium) 가 필요합니다. 한글 글꼴은 NanumGothic(없으면 시스템 글꼴) — PDF 에 함께 들어갑니다.
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const SRC = path.join(__dirname, "수행평가_학습지.html");
const OUT = path.join(__dirname, "..");
const FOOTER = `<div style="width:100%;font-size:9px;color:#555;text-align:center;font-family:NanumGothic,sans-serif">
  3차 수행평가 학습지 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [q, name] of [["", "수행평가 학습지.pdf"]]) {
    await page.goto(pathToFileURL(SRC).href + q);
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, name);
    await page.pdf({
      path: out, format: "A4", landscape: true, printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true, headerTemplate: "<div></div>", footerTemplate: FOOTER,
    });
    console.log("saved", out);
  }
  await browser.close();
})();
