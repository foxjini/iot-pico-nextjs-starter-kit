// 10주차 예시 Pico(센서 9개 + 펌프)와 같은 프로토콜을 흉내내는 테스트용 서버
// MODE=dusty  → 미세먼지 82 (경고)
// MODE=broken → 초음파·미세먼지 측정 실패 (null)
const { WebSocketServer } = require("ws");
const MODE = process.env.MODE || "normal";
const wss = new WebSocketServer({ port: 5000, path: "/connect-websocket" });
const di = (t, h) => Math.round((0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3) * 10) / 10;

wss.on("connection", (ws) => {
  console.log("[mock] client connected, MODE=" + MODE);
  let n = 0, motion = 0;
  const iv = setInterval(() => {
    n += 1;
    if (n % 12 === 0) motion += 1;
    const broken = MODE === "broken";
    const t = Math.round((24 + Math.sin(n / 5) * 3) * 10) / 10;
    const h = Math.round(55 + Math.cos(n / 7) * 10);
    ws.send(
      JSON.stringify({
        temperature: t,
        humidity: h,
        light_percent: Math.round((60 + Math.sin(n / 3) * 20) * 10) / 10,
        cpu_temp: Math.round((38 + Math.sin(n / 11) * 2) * 10) / 10,
        discomfort: di(t, h),
        soil: Math.round((45 + Math.sin(n / 9) * 20) * 10) / 10,
        distance: broken ? null : Math.round((60 + Math.sin(n / 4) * 40) * 10) / 10,
        dust: broken ? null : MODE === "dusty" ? 82 : Math.round(25 + Math.cos(n / 6) * 12),
        motion_count: motion,
      })
    );
  }, 250);
  ws.on("close", () => clearInterval(iv));
  ws.on("message", (m) => console.log("[mock] RECV:", m.toString()));
});
console.log("mock Pico 10주차 (MODE=" + MODE + "): ws://localhost:5000/connect-websocket");
