import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

/* ================= APP ================= */
const app = express();
app.use(express.json());
app.use(cors());

/* ================= CONFIG ================= */
const API_KEYS = (process.env.WRMGPT_API_KEYS || "").split(",").filter(Boolean);
const ADMIN_KEY = process.env.ADMIN_KEY || "joker-admin-171";
const PORT = process.env.PORT || 3000;
const LOG_FILE = "./logs.txt";

if (!API_KEYS.length) {
  console.error("❌ Nenhuma WRMGPT_API_KEYS definida");
}

/* ================= PATH FIX ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= HTTPS KEEP ALIVE ================= */
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 100
});

/* ================= LOG SYSTEM ================= */
let memoryLogs = [];

function saveLog({ ip, ua, message, reply }) {
  const time = new Date().toLocaleString("pt-BR");

  const logText =
`[${time}]
IP: ${ip}
UA: ${ua}
Mensagem: ${message}
Resposta: ${reply}
------------------------------\n`;

  fs.appendFile(LOG_FILE, logText, () => {});
  memoryLogs.push({ time, ip, ua, message, reply });

  if (memoryLogs.length > 500) memoryLogs.shift();
}

/* ================= IA CALL (RÁPIDA) ================= */
async function callAI(apiKey, message) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s máx

  try {
    const response = await fetch(
      "https://api.wrmgpt.com/v1/chat/completions",
      {
        agent,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "wormgpt-v7",
          max_tokens: 300, // 🚀 velocidade
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content:
                "Você é o JokerAI. Responda sempre em português do Brasil. Seja direto, claro e organizado."
            },
            { role: "user", content: message }
          ]
        }),
        signal: controller.signal
      }
    );

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;

  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ================= CHAT (PARALELO) ================= */
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.json({ reply: "Mensagem vazia." });
  }

  const calls = API_KEYS.map(key => callAI(key, userMessage));
  let reply;

  try {
    // ⚡ primeira resposta válida vence
    reply = await Promise.any(calls);
  } catch {
    reply = "⚠️ IA temporariamente indisponível.";
  }

  saveLog({
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: req.headers["user-agent"],
    message: userMessage,
    reply
  });

  res.json({ reply });
});

/* ================= ADMIN ================= */
app.get("/admin", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Acesso negado.");
  }
  res.send("Painel ativo.");
});

/* ================= LOGS ================= */
app.get("/logs", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Acesso negado.");
  }
  res.json([...memoryLogs].reverse());
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log("🔥 Joker AI ULTRA RÁPIDO rodando na porta", PORT);
});