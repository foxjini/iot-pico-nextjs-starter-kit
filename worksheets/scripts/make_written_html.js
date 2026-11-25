// 서술형 수행평가 — 컴퓨터실용 HTML 두 개를 만듭니다 (인터넷 없이 파일 하나로 동작)
//   node make_written_html.js
//     → worksheets/서술형평가_문항.html       학생 배포용: 답 쓰기 + 「답안 저장」(제출 파일 만들기). 모범답안 없음.
//     → worksheets/서술형평가_채점도우미.html  교사용: 제출 파일 여러 개 불러오기 · 문항별 채점 · CSV 저장. 학생 배포 금지.
// 문항 · 배점 · 모범답안 · 채점 기준은 인쇄용 원본 「서술형_평가.html」 에서 그대로 읽어 옵니다(한 곳만 고치면 됨).
// Playwright(Chromium) 가 필요합니다.
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const SRC = path.join(__dirname, "서술형_평가.html");
const OUT_STUDENT = path.join(__dirname, "..", "서술형평가_문항.html");
const OUT_GRADER = path.join(__dirname, "..", "서술형평가_채점도우미.html");
const EXAM_ID = "written-final-extra-v1";
const TITLE = "서술형 수행평가 — 최종 회로 · 추가 회로";

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

async function extract() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(SRC).href);
  const data = await page.evaluate(() => {
    document.querySelectorAll(".stem").forEach((p) => { p.innerHTML = p.innerHTML.replace("왼쪽 그림처럼", "위 그림처럼"); });
    const out = [];
    let part = "";
    document.querySelectorAll(".part, .qbox").forEach((el) => {
      if (el.matches(".part")) { part = el.cloneNode(true); part.querySelector("small")?.remove(); part = part.textContent.trim(); return; }
      const n = el.querySelector(".qh .n").textContent.trim();
      const h2 = el.querySelector(".qh h2").cloneNode(true); h2.querySelector(".n").remove();
      const blocks = []; const subs = []; let k = 0;
      el.querySelectorAll("svg.fig, .stem, .given, .sq, .write").forEach((b) => {
        if (b.closest(".rub")) return;
        if (b.matches("svg.fig")) {
          const c = b.cloneNode(true); c.querySelectorAll(".ans").forEach((a) => a.remove());
          c.removeAttribute("width"); c.removeAttribute("height");
          blocks.push({ t: "fig", html: c.outerHTML });
        } else if (b.matches(".sq")) {
          k += 1;
          const p = b.querySelector(".p"); const pts = p ? +p.textContent.match(/\d+/)[0] : 0;
          const c = b.cloneNode(true); c.querySelector(".p")?.remove(); c.querySelector(".k")?.remove();
          subs.push({ key: `q${n}-${k}`, label: `(${k})`, pts, text: c.innerHTML.trim(), ans: "" });
          blocks.push({ t: "sq", key: `q${n}-${k}`, label: `(${k})`, pts, html: c.innerHTML.trim() });
        } else if (b.matches(".write")) {
          const lines = parseInt(getComputedStyle(b).getPropertyValue("--n")) || 2;
          const ans = b.querySelector(".ans")?.textContent.trim() || "";
          subs[subs.length - 1].ans = ans;
          blocks.push({ t: "write", key: `q${n}-${k}`, lines });
        } else {
          blocks.push({ t: b.matches(".stem") ? "stem" : "given", html: b.innerHTML.trim() });
        }
      });
      out.push({
        n: +n, part, title: h2.textContent.trim(), head: el.querySelector(".qh .pt").textContent.trim(),
        pts: subs.reduce((a, s) => a + s.pts, 0), blocks, subs,
        rubric: el.querySelector(".rub ul").innerHTML.trim(),
      });
    });
    return out;
  });
  await browser.close();
  return data;
}

// ───────────────────────── 공통 CSS ─────────────────────────
const BASE_CSS = `
:root { --ink:#15171C; --sub:#4A505B; --faint:#8A909B; --line:#D5D8DE; --soft:#F3F4F6; --acc:#1D5FD1; --accsoft:#E8F0FD; --ok:#1E7B3C; --warn:#B3261E; --bg:#FFFFFF; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--soft); color: var(--ink); font-family: "Malgun Gothic", "맑은 고딕", "NanumGothic", "Apple SD Gothic Neo", sans-serif; font-size: 16px; line-height: 1.6; word-break: keep-all; }
button { font: inherit; cursor: pointer; border-radius: 8px; border: 1px solid var(--line); background: #fff; color: var(--ink); padding: 7px 14px; }
button.primary { background: var(--acc); border-color: var(--acc); color: #fff; font-weight: 700; }
button:disabled { opacity: .5; cursor: default; }
input, textarea, select { font: inherit; color: var(--ink); }
.wrap { max-width: 920px; margin: 0 auto; padding: 0 16px 48px; }
.card { background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; margin-top: 14px; }
.part { margin: 26px 0 0; font-size: 18px; border-left: 5px solid var(--ink); padding-left: 10px; }
.qh { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.qh h2 { margin: 0; font-size: 18px; }
.qh .num { display: inline-block; min-width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 6px; background: var(--ink); color: #fff; font-size: 15px; margin-right: 8px; }
.qh .pt { color: var(--sub); font-size: 14px; white-space: nowrap; }
.stem { margin: 10px 0 0; }
.given { margin: 8px 0 0; background: var(--soft); border-radius: 8px; padding: 6px 12px; font-size: 14.5px; color: var(--sub); }
.fig { display: block; margin: 10px auto 0; width: 230px; max-width: 100%; height: auto; }
.fig text { font-family: inherit; }
.sq { margin: 14px 0 4px; font-weight: 400; }
.sq .k { font-weight: 700; margin-right: 4px; }
.sq .p { color: var(--sub); font-size: 13.5px; margin-left: 4px; }
`;

// ───────────────────────── 학생용 ─────────────────────────
function studentHtml(Q) {
  const qHtml = Q.map((q, i) => {
    const partHead = i === 0 || Q[i - 1].part !== q.part ? `<h3 class="part">${esc(q.part)}</h3>` : "";
    const body = q.blocks.map((b) => {
      if (b.t === "fig") return b.html.replace("<svg", '<svg class="fig"');
      if (b.t === "stem") return `<p class="stem">${b.html}</p>`;
      if (b.t === "given") return `<div class="given">${b.html}</div>`;
      if (b.t === "sq") return `<p class="sq"><span class="k">${b.label}</span>${b.html}<span class="p">[${b.pts}점]</span></p>`;
      if (b.t === "write") return `<textarea class="ans-box" data-key="${b.key}" rows="${Math.max(3, b.lines + 1)}" spellcheck="false" placeholder="여기에 답을 쓰세요"></textarea><div class="count" data-for="${b.key}">0자</div>`;
      return "";
    }).join("\n");
    return `${partHead}
<section class="card q" id="q${q.n}">
  <div class="qh"><h2><span class="num">${q.n}</span>${esc(q.title)}</h2><span class="pt">${esc(q.head)}</span></div>
  ${body}
</section>`;
  }).join("\n");
  const total = Q.reduce((a, q) => a + q.pts, 0);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="exam-id" content="${EXAM_ID}">
<title>서술형 수행평가 답안지</title>
<!--
  서술형 수행평가 — 학생 답안지 (인터넷 없이 동작하는 파일 하나)
  1) 반 · 번호 · 이름을 쓰고 답을 씁니다 — 쓰는 동안 이 컴퓨터에 자동 보관됩니다.
  2) 「답안 저장」(또는 Ctrl+S) → 「서술형_2반_03번_이름.html」 파일이 만들어집니다.
  3) 그 파일을 PC 관리 프로그램으로 선생님께 제출합니다.
  만든 곳: worksheets/scripts/make_written_html.js (원본 서술형_평가.html)
-->
<style>
${BASE_CSS}
.top { position: sticky; top: 0; z-index: 5; background: #fff; border-bottom: 1px solid var(--line); }
.top .in { max-width: 1100px; margin: 0 auto; padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between; }
.top h1 { font-size: 18px; margin: 0; }
.who { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 15px; }
.who input { border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; width: 64px; }
.who input#f-name { width: 120px; }
.who input.bad { border-color: var(--warn); background: #FDECEA; }
.bar { display: flex; gap: 10px; align-items: center; }
.clock { color: var(--sub); font-size: 14px; min-width: 120px; text-align: right; }
.state { font-size: 13.5px; color: var(--sub); }
.state.dirty { color: var(--warn); }
.state.saved { color: var(--ok); }
.info { font-size: 14.5px; color: var(--sub); }
.info b { color: var(--ink); }
.info ul { margin: 6px 0 0; padding-left: 20px; }
textarea.ans-box { display: block; width: 100%; margin-top: 4px; border: 1.5px solid var(--line); border-radius: 8px; padding: 10px 12px; resize: vertical; line-height: 1.7; min-height: 90px; background: #fff; }
textarea.ans-box:focus { outline: none; border-color: var(--acc); box-shadow: 0 0 0 3px var(--accsoft); }
textarea[readonly] { background: #FAFAFA; }
.count { text-align: right; font-size: 12.5px; color: var(--faint); }
.banner { display: none; background: var(--accsoft); border: 1px solid var(--acc); border-radius: 10px; padding: 12px 16px; margin-top: 14px; }
.banner.show { display: block; }
.banner b { color: var(--acc); }
.banner.warn { background: #FDECEA; border-color: var(--warn); }
.banner.warn b { color: var(--warn); }
.done { text-align: center; padding: 22px 20px; }
.done .big { font-size: 22px; font-weight: 700; margin: 4px 0 8px; }
#toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--ink); color: #fff; border-radius: 10px; padding: 12px 18px; font-size: 15px; display: none; max-width: 90vw; z-index: 20; }
#toast.show { display: block; }
@media print { .top, #toast, .done button, .banner button { display: none; } body { background: #fff; } .card { break-inside: avoid; } }
</style>
</head>
<body>
<header class="top"><div class="in">
  <h1>${esc(TITLE)}</h1>
  <div class="who">
    <label>반 <input id="f-class" inputmode="numeric" maxlength="3" autocomplete="off"></label>
    <label>번호 <input id="f-no" inputmode="numeric" maxlength="3" autocomplete="off"></label>
    <label>이름 <input id="f-name" maxlength="20" autocomplete="off"></label>
  </div>
  <div class="bar">
    <span class="clock" id="clock"></span>
    <button class="primary" id="btn-save" title="Ctrl+S 와 같아요">답안 저장</button>
  </div>
</div></header>

<main class="wrap">
  <div class="banner" id="banner"></div>

  <section class="card info">
    <b>시간</b> 50분 &nbsp;·&nbsp; <b>배점</b> ${Q.length}문항 · ${total}점 (${Q.map((q) => q.pts).join(" · ")}) &nbsp;·&nbsp; 한 문항에 약 8분
    <ul>
      <li>「까닭」 을 묻는 문항은 <b>무엇이 → 어떻게 되어서 → 그래서</b> 순서로 씁니다. 계산 문항은 <b>풀이</b>도 씁니다.</li>
      <li>쓰는 동안 이 컴퓨터에 <b>자동 보관</b>됩니다. 그래도 끝나면 꼭 <b>「답안 저장」</b> 을 눌러 제출 파일을 만드세요.</li>
      <li>답안 저장은 여러 번 해도 됩니다. <b>마지막에 저장한 파일</b>을 제출합니다.</li>
    </ul>
    <span class="state" id="state"></span>
  </section>

${qHtml}

  <section class="card done">
    <div>다 썼나요? 빈 칸이 없는지 확인한 뒤</div>
    <div class="big">「답안 저장」 → 파일 제출</div>
    <button class="primary" id="btn-save2">답안 저장</button>
    <ol style="text-align:left;max-width:560px;margin:16px auto 0;color:var(--sub);font-size:14.5px">
      <li>「답안 저장」 을 누르면 <b>서술형_반_번호_이름.html</b> 파일이 만들어집니다.<br>저장할 곳을 묻는 창이 뜨면 선생님이 알려 준 폴더를 고르고, 묻지 않으면 <b>다운로드</b> 폴더에 저장됩니다.</li>
      <li>화면 아래에 나오는 <b>파일 이름</b>을 확인합니다.</li>
      <li>그 파일을 <b>PC 관리 프로그램</b>으로 선생님께 제출합니다.</li>
    </ol>
  </section>
</main>
<div id="toast"></div>

<script>
(function () {
  "use strict";
  var EXAM_ID = ${JSON.stringify(EXAM_ID)};
  // 제출본이면 답안(JSON)을 먼저 읽고 그 태그를 떼어 낸 뒤, 저장할 때 쓸 깨끗한 원본을 잡아 둔다
  var subEl = document.getElementById("submitted"), SUB = null;
  if (subEl) { try { SUB = JSON.parse(subEl.textContent); } catch (e) {} subEl.parentNode.removeChild(subEl); }
  var TEMPLATE = "<!doctype html>\\n" + document.documentElement.outerHTML;
  var KEY = "exam:" + EXAM_ID + ":" + location.pathname;
  var $ = function (s) { return document.querySelector(s); };
  var boxes = Array.prototype.slice.call(document.querySelectorAll("textarea.ans-box"));
  var fClass = $("#f-class"), fNo = $("#f-no"), fName = $("#f-name");
  var dirty = false, readOnly = false, lastFile = "";

  function store(get, val) {
    try { if (get) return JSON.parse(localStorage.getItem(KEY) || "null"); localStorage.setItem(KEY, JSON.stringify(val)); } catch (e) { return null; }
  }
  function collect() {
    var a = {}; boxes.forEach(function (b) { a[b.dataset.key] = b.value; });
    return { cls: fClass.value.trim(), no: fNo.value.trim(), name: fName.value.trim(), answers: a };
  }
  function fill(d) {
    if (!d) return;
    fClass.value = d.cls || ""; fNo.value = d.no || ""; fName.value = d.name || "";
    boxes.forEach(function (b) { b.value = (d.answers && d.answers[b.dataset.key]) || ""; grow(b); count(b); });
  }
  function grow(b) { b.style.height = "auto"; b.style.height = Math.max(b.scrollHeight + 4, 90) + "px"; }
  function count(b) { var c = document.querySelector('.count[data-for="' + b.dataset.key + '"]'); if (c) c.textContent = b.value.replace(/\\s/g, "").length + "자"; }
  function setState(t, cls) { var s = $("#state"); s.textContent = t; s.className = "state " + (cls || ""); }
  function toast(t, ms) { var e = $("#toast"); e.innerHTML = t; e.className = "show"; clearTimeout(toast.t); toast.t = setTimeout(function () { e.className = ""; }, ms || 6000); }
  function banner(html, warn) { var b = $("#banner"); b.innerHTML = html; b.className = "banner show" + (warn ? " warn" : ""); }

  function autosave() {
    if (readOnly) return;
    var d = collect(); d.started = started; d.at = new Date().toISOString();
    store(false, d);
    dirty = true; setState("자동 보관됨 · 아직 제출 파일은 저장하지 않았어요", "dirty");
  }
  function lock(on) {
    readOnly = on;
    [fClass, fNo, fName].concat(boxes).forEach(function (e) { e.readOnly = on; });
    $("#btn-save").style.visibility = on ? "hidden" : ""; $("#btn-save2").disabled = on;
  }

  // 시계 (시간 제한은 걸지 않음 — 지난 시간만 보여 줌)
  var started = Date.now();
  function tick() {
    var m = Math.floor((Date.now() - started) / 60000);
    $("#clock").textContent = readOnly ? "" : "지난 시간 " + m + "분 / 50분";
  }

  // ── 제출 파일 만들기 ──
  function pad2(s) { return /^\\d$/.test(s) ? "0" + s : s; }
  function safe(s) { return String(s).replace(/[\\\\/:*?"<>|\\s]+/g, "_").slice(0, 20); }
  function buildFile(d) {
    var payload = { exam: EXAM_ID, cls: d.cls, no: d.no, name: d.name, savedAt: new Date().toISOString(),
      started: new Date(started).toISOString(), answers: d.answers };
    var tag = '<script type="application/json" id="submitted">' + JSON.stringify(payload).replace(/</g, "\\\\u003c") + "<\\/script>";
    var i = TEMPLATE.indexOf("</head>");
    return TEMPLATE.slice(0, i) + tag + "\\n" + TEMPLATE.slice(i);
  }
  function validate(d) {
    var ok = true;
    [[fClass, /^\\d{1,2}$/], [fNo, /^\\d{1,2}$/], [fName, /\\S/]].forEach(function (p) {
      var bad = !p[1].test(p[0].value.trim()); p[0].classList.toggle("bad", bad); if (bad) ok = false;
    });
    if (!ok) { toast("맨 위의 <b>반 · 번호 · 이름</b>을 먼저 쓰세요. (반 · 번호는 숫자)"); fClass.scrollIntoView({ block: "center" }); }
    return ok;
  }
  function save() {
    var d = collect();
    if (!validate(d)) return;
    var empty = boxes.filter(function (b) { return !b.value.trim(); }).length;
    if (empty && !confirm("아직 빈 답 칸이 " + empty + "개 있어요. 그래도 저장할까요?\\n(나중에 다시 저장할 수 있어요)")) return;
    var name = "서술형_" + safe(d.cls) + "반_" + pad2(safe(d.no)) + "번_" + safe(d.name) + ".html";
    var blob = new Blob([buildFile(d)], { type: "text/html;charset=utf-8" });
    var done = function (where) {
      dirty = false; lastFile = name;
      setState("제출 파일 저장됨 · " + new Date().toLocaleTimeString("ko-KR"), "saved");
      toast("저장했어요: <b>" + name + "</b><br>" + where + " → 이 파일을 PC 관리 프로그램으로 제출하세요.", 10000);
    };
    var fallback = function () {
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      done("다운로드 폴더에 저장됨 (파일 이름이 다르게 저장되었다면 위 이름으로 바꿔 주세요)");
    };
    if (window.showSaveFilePicker) {
      window.showSaveFilePicker({ suggestedName: name, types: [{ description: "답안 파일 (HTML)", accept: { "text/html": [".html"] } }] })
        .then(function (h) { return h.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); }).then(function () { done("고른 폴더에 저장됨"); }); })
        .catch(function (e) { if (e && e.name === "AbortError") return; fallback(); });
    } else fallback();
  }

  // ── 시작: 제출본인지, 이어 쓰는 중인지 ──
  if (subEl) {
    var d = SUB;
    if (d) {
      fill(d); lock(true);
      started = Date.parse(d.started) || started;
      banner("<b>제출본</b> — " + d.cls + "반 " + d.no + "번 " + d.name + " · 저장 시각 " + new Date(d.savedAt).toLocaleString("ko-KR") +
        ' &nbsp; <button id="btn-edit">이어 쓰기</button>');
      setState("읽기 전용 제출본입니다", "saved");
      $("#btn-edit").onclick = function () {
        lock(false); $("#banner").className = "banner"; setState("이어 쓰는 중 — 끝나면 다시 「답안 저장」", "dirty");
        var own = store(true); if (own && own.at && own.at > d.savedAt) fill(own);
      };
    }
  } else {
    var saved = store(true);
    if (saved && (saved.name || Object.keys(saved.answers || {}).some(function (k) { return saved.answers[k]; }))) {
      fill(saved); started = saved.started || started;
      banner("<b>이어서 쓰기</b> — 이 컴퓨터에 자동 보관된 답을 불러왔어요 (" + new Date(saved.at).toLocaleString("ko-KR") + ").");
      setState("자동 보관됨 · 아직 제출 파일은 저장하지 않았어요", "dirty");
    } else {
      setState("쓰는 동안 자동 보관됩니다");
      store(false, { started: started, at: new Date().toISOString(), answers: {} });
    }
  }

  boxes.forEach(function (b) { b.addEventListener("input", function () { grow(b); count(b); autosave(); }); grow(b); count(b); });
  [fClass, fNo, fName].forEach(function (e) { e.addEventListener("input", function () { e.classList.remove("bad"); autosave(); }); });
  $("#btn-save").onclick = save; $("#btn-save2").onclick = save;
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); if (readOnly) toast("제출본입니다 — 고치려면 「이어 쓰기」 를 누르세요."); else save(); }
  });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  tick(); setInterval(tick, 20000);
})();
</script>
</body>
</html>
`;
}

// ───────────────────────── 교사용 채점 도우미 ─────────────────────────
function graderHtml(Q) {
  const exam = Q.map((q) => ({ n: q.n, title: q.title, part: q.part, pts: q.pts, rubric: q.rubric,
    subs: q.subs.map((s) => ({ key: s.key, label: s.label, pts: s.pts, text: s.text, ans: s.ans })) }));
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>서술형 채점 도우미</title>
<!--
  서술형 수행평가 — 교사용 채점 도우미 (모범답안 · 채점 기준이 들어 있으니 학생에게 배포하지 마세요)
  학생이 제출한 「서술형_반_번호_이름.html」 파일을 여러 개 한꺼번에 불러와 문항별로 채점하고 CSV 로 저장합니다.
  제출 파일 안의 스크립트는 실행하지 않고, 답안(JSON)만 읽습니다. 점수는 이 컴퓨터 브라우저에 자동 보관됩니다.
  만든 곳: worksheets/scripts/make_written_html.js
-->
<style>
${BASE_CSS}
.wrap { max-width: 1180px; }
header { background: #fff; border-bottom: 1px solid var(--line); }
header .in { max-width: 1180px; margin: 0 auto; padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
header h1 { font-size: 19px; margin: 0; }
header .tag { display: inline-block; font-size: 12.5px; color: #fff; background: var(--warn); border-radius: 99px; padding: 1px 10px; margin-left: 8px; vertical-align: 2px; }
.tools { display: flex; flex-wrap: wrap; gap: 8px; }
#drop { border: 2px dashed var(--line); border-radius: 12px; background: #fff; padding: 16px; text-align: center; color: var(--sub); margin-top: 14px; }
#drop.over { border-color: var(--acc); background: var(--accsoft); }
.msgs { margin-top: 8px; font-size: 14px; }
.msgs div { padding: 2px 0; }
.msgs .w { color: var(--warn); }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
.tabs button.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.key h2 { margin: 0 0 6px; font-size: 18px; }
.key .sub { margin: 6px 0; font-size: 14.5px; }
.key .model { color: var(--warn); font-weight: 700; }
.key .rub { font-size: 13.5px; color: var(--sub); border-top: 1px dashed var(--line); margin-top: 8px; padding-top: 6px; max-height: 160px; overflow: auto; }
.key .rub ul { margin: 0; padding-left: 18px; }
table { border-collapse: collapse; width: 100%; background: #fff; }
th, td { border: 1px solid var(--line); padding: 8px 10px; vertical-align: top; text-align: left; font-size: 14.5px; }
th { background: var(--soft); white-space: nowrap; }
td.who { white-space: nowrap; font-weight: 700; }
td.who small { display: block; font-weight: 400; color: var(--faint); font-size: 12px; }
.ans { white-space: pre-wrap; }
.ans.empty { color: var(--faint); font-style: italic; }
.ans-label { font-weight: 700; color: var(--sub); }
.sc { display: flex; align-items: center; gap: 4px; margin-top: 4px; white-space: nowrap; }
.sc input { width: 64px; padding: 3px 6px; border: 1px solid var(--line); border-radius: 6px; text-align: right; }
.sc input.over { border-color: var(--warn); background: #FDECEA; }
textarea.memo { width: 100%; min-height: 54px; border: 1px solid var(--line); border-radius: 6px; padding: 4px 6px; font-size: 13.5px; }
.tot { font-weight: 700; white-space: nowrap; }
.num { text-align: right; }
.empty-note { color: var(--sub); padding: 24px; text-align: center; }
select { padding: 6px 8px; border-radius: 6px; border: 1px solid var(--line); }
</style>
</head>
<body>
<header><div class="in">
  <h1>서술형 채점 도우미<span class="tag">교사용 · 학생 배포 금지</span></h1>
  <div class="tools">
    <button class="primary" id="btn-open">제출 파일 불러오기</button>
    <button id="btn-csv">CSV 저장 (엑셀)</button>
    <button id="btn-backup">점수 백업 저장</button>
    <button id="btn-restore">백업 불러오기</button>
    <button id="btn-clear">모두 비우기</button>
  </div>
</div></header>
<input type="file" id="pick" multiple hidden>
<input type="file" id="pick-json" accept=".json" hidden>

<main class="wrap">
  <div id="drop">학생이 제출한 <b>서술형_반_번호_이름.html</b> 파일들을 여기에 끌어다 놓거나 「제출 파일 불러오기」 를 누르세요. (여러 개 한꺼번에)
    <div class="msgs" id="msgs"></div></div>
  <div class="tabs" id="tabs"></div>
  <div id="view"></div>
</main>

<script id="exam" type="application/json">${jsonForScript({ id: EXAM_ID, questions: exam })}</script>
<script>
(function () {
  "use strict";
  var EXAM = JSON.parse(document.getElementById("exam").textContent);
  var KEY = "grader:" + EXAM.id;
  var S = load() || { subs: {}, scores: {}, memos: {} };   // subs: 학생키 → 제출 답안
  var tab = "q1";
  var $ = function (s) { return document.querySelector(s); };
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { msg("브라우저 저장소에 보관하지 못했어요 — 「점수 백업 저장」 을 이용하세요.", true); } }
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function msg(t, w) { var d = document.createElement("div"); d.className = w ? "w" : ""; d.textContent = t; $("#msgs").appendChild(d); }
  function skey(d) { return String(+d.cls || d.cls) + "-" + String(+d.no || d.no); }
  function students() {
    return Object.keys(S.subs).map(function (k) { return S.subs[k]; })
      .sort(function (a, b) { return (+a.cls - +b.cls) || (+a.no - +b.no) || String(a.name).localeCompare(b.name); });
  }
  function subScore(k, key) { var v = (S.scores[k] || {})[key]; return v === undefined || v === "" ? null : +v; }
  function qTotal(k, q) { var t = 0, any = false; q.subs.forEach(function (s) { var v = subScore(k, s.key); if (v != null) { t += v; any = true; } }); return any ? t : null; }
  function total(k) { var t = 0, any = false; EXAM.questions.forEach(function (q) { var v = qTotal(k, q); if (v != null) { t += v; any = true; } }); return any ? t : null; }
  function fmt(v) { return v == null ? "" : (Math.round(v * 10) / 10).toString(); }

  // ── 불러오기 ──
  function readFiles(files) {
    $("#msgs").innerHTML = "";
    var list = Array.prototype.slice.call(files), left = list.length, added = 0;
    if (!left) return;
    list.forEach(function (f) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var doc = new DOMParser().parseFromString(String(r.result), "text/html");   // 스크립트는 실행되지 않음
          var el = doc.getElementById("submitted");
          if (!el) throw new Error("답안이 들어 있지 않은 파일(저장 전 원본이거나 다른 파일)");
          var d = JSON.parse(el.textContent);
          if (d.exam !== EXAM.id) msg(f.name + " — 다른 시험의 파일일 수 있어요 (" + d.exam + ")", true);
          if (!String(d.name || "").trim()) msg(f.name + " — 이름이 비어 있어요", true);
          d.file = f.name;
          var k = skey(d), old = S.subs[k];
          if (old && old.name !== d.name) msg(f.name + " — " + d.cls + "반 " + d.no + "번이 두 이름으로 제출됨: " + old.name + " / " + d.name, true);
          if (old && old.savedAt > d.savedAt) msg(f.name + " — 같은 학생의 더 나중 파일이 이미 있어 건너뜀", true);
          else { if (old) msg(f.name + " — 같은 학생의 이전 제출을 이 파일(더 나중 저장)로 바꿈"); S.subs[k] = d; added++; }
        } catch (e) { msg(f.name + " — 읽지 못함: " + e.message, true); }
        if (--left === 0) { persist(); msg("불러온 파일 " + added + "개 · 학생 " + Object.keys(S.subs).length + "명"); render(); }
      };
      r.readAsText(f, "utf-8");
    });
  }
  $("#btn-open").onclick = function () { $("#pick").value = ""; $("#pick").click(); };
  $("#pick").onchange = function () { readFiles(this.files); };
  var drop = $("#drop");
  ["dragenter", "dragover"].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
  document.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files.length) readFiles(e.dataTransfer.files); });

  // ── 화면 ──
  function renderTabs() {
    var h = EXAM.questions.map(function (q) { return '<button data-t="q' + q.n + '" class="' + (tab === "q" + q.n ? "on" : "") + '">' + q.n + "번 (" + q.pts + "점)</button>"; }).join("");
    h += '<button data-t="sum" class="' + (tab === "sum" ? "on" : "") + '">점수표</button>';
    h += '<select id="stu-sel"><option value="">학생별 보기…</option>' + students().map(function (d) {
      var k = skey(d); return '<option value="s:' + esc(k) + '"' + (tab === "s:" + k ? " selected" : "") + ">" + esc(d.cls + "반 " + d.no + "번 " + d.name) + "</option>"; }).join("") + "</select>";
    $("#tabs").innerHTML = h;
    Array.prototype.forEach.call($("#tabs").querySelectorAll("button"), function (b) { b.onclick = function () { tab = b.dataset.t; render(); }; });
    $("#stu-sel").onchange = function () { if (this.value) { tab = this.value; render(); } };
  }
  function scoreInput(k, s) {
    var v = subScore(k, s.key);
    return '<label class="sc">' + s.label + ' <input type="number" min="0" max="' + s.pts + '" step="0.5" data-k="' + esc(k) + '" data-key="' + s.key + '" value="' + (v == null ? "" : v) + '"> / ' + s.pts + "</label>";
  }
  function answerCell(d, s) {
    var a = (d.answers || {})[s.key] || "";
    return '<div><span class="ans-label">' + s.label + "</span> " + (a.trim() ? '<span class="ans">' + esc(a) + "</span>" : '<span class="ans empty">(빈 칸)</span>') + "</div>";
  }
  function keyCard(q) {
    return '<section class="card key"><h2>' + q.n + ". " + esc(q.title) + " <small style=\\"color:var(--sub);font-weight:400\\">(" + q.pts + "점)</small></h2>" +
      q.subs.map(function (s) { return '<div class="sub"><b>' + s.label + "</b> " + s.text + ' <span style="color:var(--sub)">[' + s.pts + '점]</span><br><span class="model">모범답안: ' + esc(s.ans) + "</span></div>"; }).join("") +
      '<div class="rub"><b>채점 기준</b><ul>' + q.rubric + "</ul></div></section>";
  }
  function render() {
    renderTabs();
    var st = students(), v = $("#view");
    if (!st.length) { v.innerHTML = '<div class="card empty-note">아직 불러온 제출 파일이 없어요.</div>'; return; }
    if (tab.charAt(0) === "q") {
      var q = EXAM.questions.filter(function (x) { return "q" + x.n === tab; })[0];
      v.innerHTML = keyCard(q) + '<section class="card"><table><tr><th>학생</th><th>답안</th><th>점수</th><th>메모</th></tr>' +
        st.map(function (d) {
          var k = skey(d);
          return "<tr><td class=\\"who\\">" + esc(d.cls + "반 " + d.no + "번") + "<br>" + esc(d.name) + "<small>" + esc(new Date(d.savedAt).toLocaleString("ko-KR")) + "</small></td><td>" +
            q.subs.map(function (s) { return answerCell(d, s); }).join("") + "</td><td>" +
            q.subs.map(function (s) { return scoreInput(k, s); }).join("") + '<div class="tot" data-tot="' + esc(k) + '">계 ' + fmt(qTotal(k, q)) + " / " + q.pts + "</div></td>" +
            '<td><textarea class="memo" data-k="' + esc(k) + '" data-q="' + q.n + '">' + esc(((S.memos[k] || {})[q.n]) || "") + "</textarea></td></tr>";
        }).join("") + "</table></section>";
    } else if (tab === "sum") {
      v.innerHTML = '<section class="card"><table><tr><th>반</th><th>번호</th><th>이름</th>' + EXAM.questions.map(function (q) { return "<th>" + q.n + "번 (" + q.pts + ")</th>"; }).join("") +
        "<th>합계</th><th>저장 시각</th><th>파일</th></tr>" + st.map(function (d) {
          var k = skey(d);
          return "<tr><td>" + esc(d.cls) + "</td><td>" + esc(d.no) + "</td><td>" + esc(d.name) + "</td>" +
            EXAM.questions.map(function (q) { return '<td class="num">' + fmt(qTotal(k, q)) + "</td>"; }).join("") +
            '<td class="num tot">' + fmt(total(k)) + "</td><td>" + esc(new Date(d.savedAt).toLocaleString("ko-KR")) + "</td><td>" + esc(d.file || "") + "</td></tr>";
        }).join("") + "</table></section>";
    } else {
      var k = tab.slice(2), d = S.subs[k];
      if (!d) { tab = "q1"; return render(); }
      v.innerHTML = '<section class="card"><h2 style="margin:0">' + esc(d.cls + "반 " + d.no + "번 " + d.name) + ' <span class="tot" data-all="' + esc(k) + '">합계 ' + fmt(total(k)) + " / 100</span></h2></section>" +
        EXAM.questions.map(function (q) {
          return '<section class="card"><div class="qh"><h2><span class="num">' + q.n + "</span>" + esc(q.title) + '</h2><span class="pt">' + q.pts + "점</span></div>" +
            q.subs.map(function (s) {
              return '<div style="margin-top:10px"><b>' + s.label + "</b> " + s.text + '<div style="margin:4px 0 0 14px">' + answerCell(d, s) +
                '<div class="model" style="color:var(--warn);font-size:13.5px">모범답안: ' + esc(s.ans) + "</div>" + scoreInput(k, s) + "</div></div>";
            }).join("") + '<div class="tot" data-tot="' + esc(k) + '" data-q="' + q.n + '" style="margin-top:6px">계 ' + fmt(qTotal(k, q)) + " / " + q.pts + "</div></section>";
        }).join("");
    }
    bindInputs();
  }
  function bindInputs() {
    Array.prototype.forEach.call(document.querySelectorAll(".sc input"), function (inp) {
      inp.oninput = function () {
        var k = inp.dataset.k, key = inp.dataset.key, max = +inp.max;
        S.scores[k] = S.scores[k] || {};
        if (inp.value === "") delete S.scores[k][key]; else S.scores[k][key] = +inp.value;
        inp.classList.toggle("over", inp.value !== "" && (+inp.value < 0 || +inp.value > max));
        persist();
        var q = EXAM.questions.filter(function (x) { return key.indexOf("q" + x.n + "-") === 0; })[0];
        Array.prototype.forEach.call(document.querySelectorAll('[data-tot="' + k + '"]'), function (t) {
          if (!t.dataset.q || +t.dataset.q === q.n) t.textContent = "계 " + fmt(qTotal(k, q)) + " / " + q.pts;
        });
        var all = document.querySelector('[data-all="' + k + '"]'); if (all) all.textContent = "합계 " + fmt(total(k)) + " / 100";
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("textarea.memo"), function (m) {
      m.oninput = function () { var k = m.dataset.k; S.memos[k] = S.memos[k] || {}; S.memos[k][m.dataset.q] = m.value; persist(); };
    });
  }

  // ── 내보내기 ──
  function download(name, text, type) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function csvCell(v) { v = v == null ? "" : String(v); return /[",\\n\\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function stamp() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()); }
  $("#btn-csv").onclick = function () {
    var head = ["반", "번호", "이름"];
    EXAM.questions.forEach(function (q) { q.subs.forEach(function (s) { head.push(q.n + s.label); }); head.push(q.n + "번 계"); });
    head.push("합계", "메모", "저장 시각", "파일");
    var rows = [head].concat(students().map(function (d) {
      var k = skey(d), r = [d.cls, d.no, d.name];
      EXAM.questions.forEach(function (q) { q.subs.forEach(function (s) { r.push(fmt(subScore(k, s.key))); }); r.push(fmt(qTotal(k, q))); });
      var memo = Object.keys(S.memos[k] || {}).filter(function (n) { return S.memos[k][n]; }).map(function (n) { return n + "번: " + S.memos[k][n]; }).join(" / ");
      r.push(fmt(total(k)), memo, new Date(d.savedAt).toLocaleString("ko-KR"), d.file || "");
      return r;
    }));
    download("서술형_점수_" + stamp() + ".csv", "\\uFEFF" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\\r\\n"), "text/csv;charset=utf-8");
  };
  $("#btn-backup").onclick = function () { download("서술형_채점백업_" + stamp() + ".json", JSON.stringify(S), "application/json"); };
  $("#btn-restore").onclick = function () { $("#pick-json").value = ""; $("#pick-json").click(); };
  $("#pick-json").onchange = function () {
    var f = this.files[0]; if (!f) return; var r = new FileReader();
    r.onload = function () { try { var d = JSON.parse(String(r.result)); if (!d.subs || !d.scores) throw new Error("형식이 다름"); S = d; S.memos = S.memos || {}; persist(); render(); msg("백업을 불러왔어요"); } catch (e) { msg("백업을 읽지 못함: " + e.message, true); } };
    r.readAsText(f, "utf-8");
  };
  $("#btn-clear").onclick = function () {
    if (!confirm("불러온 답안과 입력한 점수를 모두 지울까요? (먼저 「CSV 저장」 이나 「점수 백업 저장」 을 권해요)")) return;
    S = { subs: {}, scores: {}, memos: {} }; persist(); $("#msgs").innerHTML = ""; tab = "q1"; render();
  };
  render();
})();
</script>
</body>
</html>
`;
}

(async () => {
  const Q = await extract();
  const student = studentHtml(Q);
  const grader = graderHtml(Q);
  // 검사: 학생용에 모범답안 · 채점 기준이 새지 않았는지, 배점 합계
  const leaks = [];
  Q.forEach((q) => q.subs.forEach((s) => { const probe = s.ans.slice(0, 24); if (probe && student.includes(probe)) leaks.push(`${s.key}: ${probe}`); }));
  ["모범답안", "채점 기준"].forEach((w) => { if (student.includes(w)) leaks.push(`낱말 「${w}」`); });
  if (leaks.length) { console.error("학생용 파일에 답이 들어갔습니다:\n" + leaks.join("\n")); process.exit(1); }
  const total = Q.reduce((a, q) => a + q.pts, 0);
  if (total !== 100) { console.error("배점 합계가 100 이 아닙니다: " + total); process.exit(1); }
  Q.forEach((q) => { const h = +q.head.match(/^(\d+)점/)[1]; if (h !== q.pts) { console.error(`${q.n}번 머리 배점 ${h} ≠ 소문항 합 ${q.pts}`); process.exit(1); } });
  fs.writeFileSync(OUT_STUDENT, student);
  fs.writeFileSync(OUT_GRADER, grader);
  console.log(`문항 ${Q.length}개 · ${total}점 · 소문항 ${Q.reduce((a, q) => a + q.subs.length, 0)}개`);
  console.log("saved", OUT_STUDENT);
  console.log("saved", OUT_GRADER);
})();
