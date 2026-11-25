// 서술형 수행평가 HTML → A4 PDF (학생용 문항지 · 정답·채점기준판), 꼬리말에 쪽 번호
//   node make_written_test.js   →   worksheets/서술형 수행평가.pdf, worksheets/서술형 수행평가(정답·채점기준).pdf
// Playwright(Chromium) 가 필요합니다. 한글 글꼴은 NanumGothic(없으면 시스템 글꼴) — PDF 에 함께 들어갑니다.
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const SRC = path.join(__dirname, "서술형_평가.html");
const OUT = path.join(__dirname, "..");
const FOOTER = `<div style="width:100%;font-size:9px;color:#555;text-align:center;font-family:NanumGothic,sans-serif">
  서술형 수행평가 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [q, name] of [["", "서술형 수행평가.pdf"], ["?answer=1", "서술형 수행평가(정답·채점기준).pdf"]]) {
    await page.goto(pathToFileURL(SRC).href + q);
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, name);
    await page.pdf({
      path: out, format: "A4", printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true, headerTemplate: "<div></div>", footerTemplate: FOOTER,
    });
    console.log("saved", out);
  }
  await browser.close();
})();
