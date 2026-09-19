// 9주차 Pico WebSocket 서버(센서 5개)와 같은 프로토콜을 흉내내는 테스트용 서버
// MODE=hot    → 온도 31.5, 습도 85 (경고 2개 동시)
// MODE=dark   → 조도 18 (자동 모드 확인)
// MODE=broken  → DHT11 고장 (temperature/humidity/discomfort = null)
// MODE=nolight → 조도 센서 고장 (light_percent = null)
const { WebSocketServer } = require("ws");
const MODE = process.env.MODE || "normal";
const wss = new WebSocketServer({ port: 5000, path: "/connect-websocket" });

const di = (t, h) =>
  t === null || h === null
    ? null
    : Math.round((0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3) * 10) / 10;

wss.on("connection", (ws) => {
  console.log("[mock] client connected, MODE=" + MODE);
  let n = 0;
  const iv = setInterval(() => {
    n += 1;
    const broken = MODE === "broken";
    const t = broken ? null : MODE === "hot" ? 31.5 : Math.round((24 + Math.sin(n / 5) * 3) * 10) / 10;
    const h = broken ? null : MODE === "hot" ? 85 : Math.round(55 + Math.cos(n / 7) * 10);
    ws.send(
      JSON.stringify({
        temperature: t,
        humidity: h,
        light_percent:
          MODE === "nolight" ? null
          : MODE === "dark" ? 18.0
          : Math.round((60 + Math.sin(n / 3) * 20) * 10) / 10,
        cpu_temp: Math.round((38 + Math.sin(n / 11) * 2) * 10) / 10,
        discomfort: di(t, h),
      })
    );
  }, 250);
  ws.on("close", () => clearInterval(iv));
  ws.on("message", (m) => console.log("[mock] RECV:", m.toString()));
});
console.log("mock Pico 9주차 (MODE=" + MODE + "): ws://localhost:5000/connect-websocket");
