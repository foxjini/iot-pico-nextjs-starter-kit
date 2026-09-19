// 3주차 Pico WebSocket 서버와 동일한 프로토콜을 흉내내는 테스트용 서버
// MODE=hot   → 온도 31.5 (Alert 확인용)
// MODE=dark  → 조도 18   (자동 모드 확인용)
const { WebSocketServer } = require("ws");
const MODE = process.env.MODE || "normal";
const wss = new WebSocketServer({ port: 5000, path: "/connect-websocket" });

wss.on("connection", (ws) => {
  console.log("[mock] client connected, MODE=" + MODE);
  let n = 0;
  const iv = setInterval(() => {
    n += 1;
    ws.send(
      JSON.stringify({
        temperature: MODE === "hot" ? 31.5 : Math.round((24 + Math.sin(n / 5) * 3) * 10) / 10,
        humidity: Math.round(55 + Math.cos(n / 7) * 10),
        light_percent: MODE === "dark" ? 18.0 : Math.round((60 + Math.sin(n / 3) * 20) * 10) / 10,
      })
    );
  }, 250);
  ws.on("close", () => clearInterval(iv));
  ws.on("message", (m) => console.log("[mock] RECV:", m.toString()));
});
console.log("mock Pico (MODE=" + MODE + "): ws://localhost:5000/connect-websocket");
