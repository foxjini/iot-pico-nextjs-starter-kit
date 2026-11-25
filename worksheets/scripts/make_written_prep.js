// 서술형 수행평가 대비 학습지 HTML → A4 PDF (학생용 · 정답판), 꼬리말에 쪽 번호
//   node make_written_prep.js   →   worksheets/서술형 대비 학습지.pdf, worksheets/서술형 대비 학습지(정답).pdf
// Playwright(Chromium) 가 필요합니다. 한글 글꼴은 NanumGothic(없으면 시스템 글꼴) — PDF 에 함께 들어갑니다.
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const SRC = path.join(__dirname, "서술형_대비_학습지.html");
const OUT = path.join(__dirname, "..");
const FOOTER = `<div style="width:100%;font-size:9px;color:#555;text-align:center;font-family:NanumGothic,sans-serif">
  서술형 대비 학습지 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [q, name] of [["", "서술형 대비 학습지.pdf"], ["?answer=1", "서술형 대비 학습지(정답).pdf"]]) {
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
