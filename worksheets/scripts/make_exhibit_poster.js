// 전시용 작품 설명 포스터 HTML → A4 2쪽 PDF (꼬리말에 작은 쪽 번호)
//   node make_exhibit_poster.js   →   worksheets/작품 설명 포스터.pdf
// Playwright(Chromium) 가 필요합니다. 글꼴 NanumGothic · NanumSquareRound 가 PDF 에 함께 들어갑니다.
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const SRC = path.join(__dirname, "전시_포스터.html");
const OUT = path.join(__dirname, "..", "작품 설명 포스터.pdf");
const FOOTER = `<div style="width:100%;font-size:8px;color:#8A909C;text-align:center;font-family:NanumGothic,sans-serif">
  <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(SRC).href);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: OUT, format: "A4", printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: "<div></div>", footerTemplate: FOOTER,
  });
  console.log("saved", OUT);
  await browser.close();
})();
