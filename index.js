import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */
const API_KEY = process.env.WRMGPT_API_KEY;
const ADMIN_KEY = process.env.ADMIN_KEY || "joker-admin-171";
const PORT = process.env.PORT || 3000;
const LOG_FILE = "./logs.txt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= LOG SYSTEM ================= */
let memoryLogs = [];

function saveLog({ ip, ua, message, reply }) {
  const time = new Date().toLocaleString("pt-BR");

  fs.appendFile(
    LOG_FILE,
    `[${time}]
IP: ${ip}
UA: ${ua}
MSG: ${message}
RES: ${reply}
--------------------\n`,
    () => {}
  );

  memoryLogs.push({ time, ip, ua, message, reply });
  if (memoryLogs.length > 300) memoryLogs.shift();
}

/* ================= ADMIN ================= */
app.get("/admin", (req, res) => {
  if (req.query.key !== ADMIN_KEY)
    return res.status(403).send("Acesso negado.");
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/logs", (req, res) => {
  if (req.query.key !== ADMIN_KEY)
    return res.status(403).send("Acesso negado.");
  res.json([...memoryLogs].reverse());
});

/* ================= CHAT STREAM ================= */
app.post("/chat-stream", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) return res.end();

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  let finalReply = "";

  try {
    const response = await fetch(
      "https://api.wrmgpt.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "wormgpt-v7",
          temperature: 0.3,
          top_p: 0.8,
          max_tokens: 250,
          stream: true,
          messages: [
            {
              role: "system",
              content:
                "Você é o JokerAI. Responda em português do Brasil. Seja direto."
            },
            {
              role: "user",
              content: userMessage
            }
          ]
        })
      }
    );

    for await (const chunk of response.body) {
      const text = chunk.toString();
      if (text.includes("[DONE]")) break;

      const lines = text.split("\n").filter(l => l.startsWith("data:"));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.replace("data:", ""));
          const token = json.choices?.[0]?.delta?.content;
          if (token) {
            finalReply += token;
            res.write(token); // 🔥 TEXTO PURO
          }
        } catch {}
      }
    }
  } catch (err) {
    res.write("⚠️ Erro ao conectar com a IA.");
  }

  res.end();

  saveLog({
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: req.headers["user-agent"],
    message: userMessage,
    reply: finalReply
  });
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log("🔥 Joker AI STREAMING rodando na porta", PORT);
});