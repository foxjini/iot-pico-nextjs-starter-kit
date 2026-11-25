// 3차 수행평가 수업 영상 만들기 — 수업 자료(HTML)를 대본대로 조작하며 한 장씩 찍어 mp4 로 (자막을 화면에 넣음, 소리 없음)
//   node make_assess_video.js [프레임 폴더]
//     → worksheets/수행평가 수업 영상.mp4 · worksheets/수행평가 수업 영상.srt
// 필요: Playwright(Chromium), ffmpeg(libx264). 한글 글꼴(나눔고딕 등).
// 움직임은 가상 시계로 맞춥니다: 프레임마다 시계를 0.1초 돌리고 → 애니메이션 한 번 → 조작 → 찍기.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "..");
const DECK = path.join(ROOT, "week10-real-pico", "수행평가-수업자료.html");
const OUT_MP4 = path.join(ROOT, "worksheets", "수행평가 수업 영상.mp4");
const OUT_SRT = path.join(ROOT, "worksheets", "수행평가 수업 영상.srt");
const FRAMES = process.argv[2] || path.join(__dirname, "_video_frames");
const FPS = 10, W = 1920, H = 1080, SCALE = 1.08;

// ── 조작 도우미 (페이지 안에서 실행할 코드) ──
const click = sel => `document.querySelector(${JSON.stringify(sel)}).click()`;
const block = name => `[...document.querySelectorAll('#blocks text')].find(t => t.textContent === ${JSON.stringify(name)})` +
  `.parentNode.dispatchEvent(new MouseEvent('click', { bubbles: true }))`;
const nth = (sel, i) => `document.querySelectorAll(${JSON.stringify(sel)})[${i}].click()`;
// 슬라이더를 t초부터 d초 동안 a → b 로 (sel, a, b)
const slide = (t, d, sel, a, b) => ({ t, tween: { d, sel, a, b } });
const act = (t, js) => ({ t, js });

// ── 대본: [장면, [[길이(초), 자막, [조작…]], …]] ──
const SCRIPT = [
  [0, [
    [5, "오늘은 3차 수행평가 회로를 함께 알아봅니다."],
    [5, "이 회로가 하는 일은 딱 두 가지예요."],
    [8, "① 조이스틱을 기울이면 스텝모터가 돌고,\n② RFID 카드를 대면 LCD 에 카드 번호가 나옵니다."],
    [6, "나머지 부품과 선은 모두 이 두 가지를 위한 준비랍니다."],
  ]],
  [1, [
    [6, "먼저 전체 구성을 볼까요? 가운데의 Pico 2 W 가 두뇌 역할을 합니다."],
    [7, "LCD 는 I2C 라는 방식으로, 선 두 개(SDA · SCL)로 Pico 와 이어집니다.", [act(0.3, block("LCD 1602"))]],
    [7, "LCD 는 5V, Pico 는 3.3V — 그래서 둘 사이에 레벨 변환기를 둡니다.", [act(0.3, block("레벨 변환"))]],
    [7, "스텝모터는 ULN2003 드라이버를 거쳐 GP10~GP13, 네 개의 핀으로 움직입니다.", [act(0.3, block("ULN2003 + 스텝모터"))]],
    [7, "조이스틱은 X · Y 두 개의 아날로그 값과 버튼 하나를 Pico 로 보냅니다.", [act(0.3, block("조이스틱"))]],
    [8, "RFID 리더기는 SPI 방식, 선 네 개로 카드 번호를 전해 줍니다.\n3.3V 전용이라는 것, 꼭 기억하세요!", [act(0.3, block("RFID-RC522"))]],
  ]],
  [2, [
    [6, "이제 전원입니다. 브레드보드의 레일을 두 갈래로 나눠 씁니다."],
    [8, "왼쪽 레일은 외부 5V 어댑터 —\n스텝모터, LCD, 레벨 변환기의 HV 쪽에 전기를 줍니다."],
    [8, "오른쪽 레일은 Pico 의 3.3V —\n조이스틱, RC522, 레벨 변환기의 LV 쪽에 씁니다."],
    [8, "만약 USB 하나로 모두 쓰면? 모터 전류 때문에 여유가 거의 없고\n전압이 흔들려 Pico 가 다시 켜질 수 있어요.", [act(0.5, click("#pwUsb"))]],
    [7, "그래서 모터는 5V 2A 어댑터로 따로! GND(−)는 모두 하나로 이어 줍니다.", [act(0.5, click("#pwSep"))]],
    [6, "전원 순서: 켤 때는 USB 먼저 → 어댑터, 끌 때는 어댑터 먼저."],
  ]],
  [3, [
    [7, "조이스틱 안에는 가변저항이 들어 있어요. 기울인 만큼 전압이 바뀝니다."],
    [7, "가운데에서는 약 1.65V. Pico 의 ADC 가 이 전압을 0~65535 숫자로 읽어요."],
    [7, "오른쪽으로 기울이면 전압이 올라가고, 모터는 시계 방향으로 돕니다.", [slide(0.5, 3, "#j3x", 0, 80)]],
    [8, "왼쪽으로 기울이면 반대로! 가운데 ±7% 는 「가만히」로 봐서 모터가 멈춥니다.",
      [slide(0.2, 3, "#j3x", 80, -80), slide(4.5, 2, "#j3x", -80, 4)]],
    [8, "주의! 조이스틱의 「+5V」 핀에 5V 를 넣으면\n출력이 3.3V 를 넘어 Pico 가 위험해요.", [act(0.5, click("#j3v5")), slide(1.5, 2, "#j3x", 4, 90)]],
    [6, "그래서 「+5V」 핀에는 꼭 3.3V 레일을 연결합니다.", [act(0.5, click("#j3v33")), slide(1.5, 2, "#j3x", 90, 0)]],
    [7, "버튼(SW)을 누르면 LCD 표시가 원래대로 돌아오고, 모터 위치가 0° 가 됩니다."],
  ]],
  [4, [
    [6, "스텝모터 안에는 코일 4개(A · B · C · D)가 있어요."],
    [8, "코일을 순서대로 켜면, 가운데 자석이 켜진 코일 쪽으로 끌려가며 한 칸씩 돕니다."],
    [7, "오른쪽 표가 code.py 의 반 스텝 순서예요. 8단계를 계속 반복합니다."],
    [7, "Pico 는 약한 신호만 보내고, ULN2003 이 외부 5V 로 코일에 전류를 흘려 줘요."],
    [6, "반 스텝을 4096 번 하면 출력축이 한 바퀴 돕니다."],
    [8, "조이스틱을 많이 기울일수록 한 칸 간격이 짧아져(8ms → 1.3ms) 빨리 돌아요.", [slide(0.5, 5, "#m4x", 15, 100)]],
    [6, "손을 놓으면 코일을 꺼서 모터가 뜨거워지지 않게 합니다."],
  ]],
  [5, [
    [7, "LCD 는 I2C 로 이어집니다. 선은 SDA(데이터)와 SCL(박자) 두 개뿐이에요."],
    [8, "보낼 때 주소 0x27 을 붙여서\n「LCD 야, 이건 너한테 보내는 거야」 하고 알려 줍니다."],
    [7, "그런데 Pico 쪽 신호는 3.3V, LCD 쪽은 5V — 그래프의 높이가 다르죠?"],
    [8, "레벨 변환기를 빼고 바로 이으면?\n3.3V 용 Pico 핀에 5V 가 들어가 망가질 수 있어요.", [act(0.5, click("#i2Off"))]],
    [5, "그래서 가운데에 레벨 변환기를 꼭 둡니다.", [act(0.3, click("#i2On"))]],
    [7, "속도는 충분해요. 글자 한 개에 0.6ms, 두 줄 전체도 0.02초면 끝!"],
  ]],
  [6, [
    [5, "이번에는 RFID 리더기와 카드의 대화를 들어 볼까요?"],
    [9, "① 리더기가 전파로 「근처에 카드 있니?」 하고 0.25초마다 물어요.\n카드는 전지가 없어도 이 전파로 깨어납니다.", [act(0.3, nth("#r6steps .btn", 0))]],
    [5, "② 카드가 「있어요!」 하고 대답합니다.", [act(0.3, nth("#r6steps .btn", 1))]],
    [7, "③ 「번호 알려줘」 하면, 카드가 번호 4바이트와 검사 바이트를 보내요.", [act(0.3, nth("#r6steps .btn", 2))]],
    [7, "검사 바이트(BCC)는 네 바이트를 XOR 한 값이에요. 맞으면 번호를 믿습니다."],
    [5, "④ 그러면 Pico 가 그 번호를 LCD 에 씁니다.", [act(0.3, nth("#r6steps .btn", 3))]],
    [6, "카드 번호 6A 70 F4 BC 를 ASCII 글자로 바꿔 볼까요? 오른쪽 표를 보세요."],
    [7, "6A 는 10진수로 106, 글자로 j. 70 은 112, 글자로 p."],
    [9, "F4 · BC 는 글자로 찍을 수 없는 값이라 점(.)으로 나타냅니다.\n그래서 LCD 2줄에는 「ASCII: jp..」 가 나와요."],
  ]],
  [7, [
    [6, "조이스틱 Y 로는 LCD 에 나온 카드 번호를 돌릴 수 있어요."],
    [9, "Y 를 위(+)로 기울이면 오른쪽으로 한 칸씩 —\n끝으로 나간 글자는 왼쪽에서 다시 나와요.",
      [0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6].map(t => act(t, click("#l7right")))],
    [6, "아래(−)로 기울이면 왼쪽으로 돕니다.", [1, 2, 3].map(t => act(t, click("#l7left")))],
    [7, "계속 기울이고 있으면 전광판처럼 계속 돌아요.", [act(0.3, click("#l7auto"))]],
    [5, "버튼(SW)을 누르면 원래 모양으로 돌아옵니다.", [act(0.5, click("#l7sw"))]],
  ]],
  [8, [
    [7, "실습용 점퍼선은 10cm 로 짧아요. 그래서 모듈 세 개를 180° 돌려 놓습니다."],
    [6, "LCD 를 똑바로 놓으면 I2C 핀이 왼쪽 끝 — 선이 Pico 까지 닿지 않아요."],
    [7, "180° 돌리면 핀은 Pico 쪽이 되지만… 글씨가 거꾸로!", [act(0.5, click("#f8rot"))]],
    [9, "LCD 칩에는 화면을 뒤집는 기능이 없어요.\n그래서 코드(LCD_FLIP)가 글자를 하나하나 거꾸로 그립니다."],
    [6, "LCD_FLIP 을 켜면, 돌려 놓은 LCD 에서도 글씨가 똑바로!", [act(0.5, click("#f8flip"))]],
    [7, "레벨 변환기는 HV 가 왼쪽, RC522 는 핀이 왼쪽이 되게 돌려 놓습니다."],
  ]],
  [9, [
    [8, "이제 만들어 봅시다. CIRCUITPY 에 파일 3개만 넣으면 되고,\n따로 설치할 라이브러리는 없어요."],
    [6, "부품을 하나 꽂을 때마다 test1 → test4 로 하나씩 확인해요."],
    [7, "마지막으로 code.py 를 넣고, PC 점검 앱의 8칸이 모두 ✔ 이면 완성!"],
    [5, "안 될 때는 오른쪽 표를 먼저 보세요."],
    [7, "안전 3가지 — 전원 순서, 3.3V 부품, GND 공통. 꼭 지켜 주세요."],
    [5, "자, 이제 회로를 만들어 볼까요?"],
  ]],
];

// ── 시간표 만들기 ──
const GAP = 0.5;                            // 장면이 바뀔 때 쉬는 시간
const events = [];                          // { t, js } 또는 { t, tween }
const caps = [];                            // { a, b, text }
let T = 0;
for (const [scene, lines] of SCRIPT) {
  events.push({ t: T, js: `go(${scene})` });
  T += GAP;
  for (const [dur, text, acts = []] of lines) {
    caps.push({ a: T, b: T + dur, text });
    for (const a of acts) events.push(Object.assign({}, a, { t: T + a.t }));
    T += dur;
  }
}
const TOTAL = T + 1.0;
const NFRAMES = Math.min(Math.round(TOTAL * FPS), +(process.env.MAXF || 1e9));      // MAXF = 앞부분만 시험

function srtTime(s) {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}

(async () => {
  console.log(`대본: 자막 ${caps.length}개 · ${(TOTAL / 60).toFixed(1)}분 · 프레임 ${NFRAMES}장`);
  fs.writeFileSync(OUT_SRT, caps.map((c, i) => `${i + 1}\n${srtTime(c.a)} --> ${srtTime(c.b)}\n${c.text}\n`).join("\n"));
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.addInitScript(() => {
    let vnow = 0, q = [];
    performance.now = () => vnow;
    window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
    window.__tick = ms => { vnow += ms; const cbs = q; q = []; cbs.forEach(cb => cb(vnow)); };
  });
  await page.goto(pathToFileURL(DECK).href);
  await page.evaluate(({ scale, w }) => {
    const st = document.getElementById("stage");
    window.removeEventListener("resize", window.fit);
    st.style.transform = `scale(${scale})`;
    st.style.left = (w - 1600 * scale) / 2 + "px";
    st.style.top = "0px";
    document.querySelector("footer").style.display = "none";
    document.body.style.background = "#fff";
    const cap = document.createElement("div");
    cap.id = "cap";
    cap.style.cssText = "position:fixed;left:96px;right:96px;top:928px;bottom:12px;" +   // 장면 내용은 900px 위에서 끝남
      "display:flex;align-items:center;gap:22px;padding:0 30px;background:#E8F1FE;border-radius:18px;" +
      "font:700 31px/1.32 'NanumGothic','Malgun Gothic',sans-serif;color:#1C2B33;white-space:pre-line;letter-spacing:-.3px";
    cap.innerHTML = '<span style="flex:none;width:8px;align-self:stretch;margin:16px 0;border-radius:4px;background:#0064E0"></span><span id="capText"></span>';
    document.body.appendChild(cap);
  }, { scale: SCALE, w: W });

  let ei = 0, lastCap = null;
  const sorted = events.slice().sort((a, b) => a.t - b.t);
  const tweens = [];
  for (let f = 0; f < NFRAMES; f++) {
    const t = f / FPS;
    const code = [];
    while (ei < sorted.length && sorted[ei].t <= t + 1e-9) {
      const e = sorted[ei++];
      if (e.js) code.push(e.js);
      if (e.tween) tweens.push(Object.assign({ t0: e.t }, e.tween));
    }
    for (const tw of tweens) {
      const k = Math.min(1, Math.max(0, (t - tw.t0) / tw.d));
      if (t >= tw.t0 && t <= tw.t0 + tw.d + 1 / FPS) {
        const v = Math.round(tw.a + (tw.b - tw.a) * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2));
        code.push(`(() => { const e = document.querySelector(${JSON.stringify(tw.sel)}); e.value = ${v}; e.dispatchEvent(new Event('input')); })()`);
      }
    }
    const c = caps.find(c => t >= c.a && t < c.b);
    const capText = c ? c.text : "";
    await page.evaluate(({ code, capText, setCap }) => {
      for (const js of code) (0, eval)(js);
      window.__tick(100);
      if (setCap) document.getElementById("capText").textContent = capText;
      document.getElementById("cap").style.visibility = capText ? "visible" : "hidden";
    }, { code, capText, setCap: capText !== lastCap });
    lastCap = capText;
    await page.screenshot({ path: path.join(FRAMES, String(f).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 88 });
    if (f % 300 === 0) console.log(`  ${f}/${NFRAMES} (${t.toFixed(0)}초)`);
  }
  await browser.close();
  if (errs.length) console.log("페이지 오류:", errs);

  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(FRAMES, "%05d.jpg"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart",
    "-metadata", "title=3차 수행평가 — 조이스틱 · 스텝모터 · LCD · RFID", OUT_MP4], { stdio: "inherit" });
  console.log("saved", OUT_MP4, (fs.statSync(OUT_MP4).size / 1e6).toFixed(1) + "MB");
  console.log("saved", OUT_SRT);
})();
