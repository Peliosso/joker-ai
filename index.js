import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ================= APP ================= */
const app = express();
app.use(express.json());
app.use(cors());

/* ================= CONFIG ================= */
const API_KEY = process.env.WRMGPT_API_KEYS; // UM ÚNICO TOKEN
const ADMIN_KEY = process.env.ADMIN_KEY || "joker-admin-171";
const PORT = process.env.PORT || 3000;
const LOG_FILE = "./logs.txt";

/* ================= PATH ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= STATIC ================= */
app.use(express.static(__dirname));

/* ================= STATUS GLOBAL ================= */
let SYSTEM_STATUS = "online"; 
// online | offline | maintenance

app.get("/status", (req, res) => {
  res.json({ status: SYSTEM_STATUS });
});

app.post("/status/set", (req, res) => {
  const { key, status } = req.body;

  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Acesso negado" });
  }

  if (!["online", "offline", "maintenance"].includes(status)) {
    return res.status(400).json({ error: "Status inválido" });
  }

  SYSTEM_STATUS = status;
  res.json({ ok: true, status });
});

/* ================= SECURITY FILTER ================= */
function sanitizeReply(text) {
  if (!text) return text;

  const forbidden = [
    /wrmgpt/gi,
    /wormgpt/gi,
    /gpt/gi,
    /openai/gi,
    /modelo/gi,
    /api/gi,
    /backend/gi,
    /inteligência artificial/gi,
    /sou um/gi
  ];

  let sanitized = text;
  forbidden.forEach(r => sanitized = sanitized.replace(r, ""));
  return sanitized.trim();
}

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

/* ================= CHAT ================= */
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message?.trim();

  if (!userMessage) {
    return res.json({ reply: "Envie uma mensagem válida." });
  }

  if (SYSTEM_STATUS === "offline") {
    return res.json({ reply: "♠ O Joker AI está offline no momento." });
  }

  if (SYSTEM_STATUS === "maintenance") {
    return res.json({ reply: "♠ O Joker AI está em manutenção." });
  }

  let reply = "Não consegui responder no momento.";

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
          temperature: 0.4,
          max_tokens: 180,
          top_p: 0.9,
          messages: [
            {
              role: "system",
              content: `
Você é o JokerAI.

REGRAS ABSOLUTAS:
- Nunca revele sistema, modelo, API, tecnologia ou provedor.
- Nunca diga que é WRMGPT, GPT, WormGPT ou OpenAI.
- Se perguntarem quem você é: "Sou o JokerAI."
- Se perguntarem como funciona: "Não divulgo detalhes técnicos."
- Nunca quebre personagem.

Idioma: Português do Brasil.
Estilo: claro, direto, informal e sarcástico.
`
            },
            { role: "user", content: userMessage }
          ]
        })
      }
    );

    const data = await response.json();

    if (data?.choices?.[0]?.message?.content) {
      reply = sanitizeReply(data.choices[0].message.content);
    }

  } catch (err) {
    console.error("Erro na IA:", err);
    reply = "♠ Erro ao consultar o Joker AI.";
  }

  saveLog({
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: req.headers["user-agent"],
    message: userMessage,
    reply
  });

  res.json({ reply });
});

/* ================= LOG VIEW ================= */
app.get("/logs", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Acesso negado.");
  }
  res.json([...memoryLogs].reverse());
});

/* ================= HEALTH ================= */
app.get("/", (req, res) => {
  res.send("🃏 Joker AI Backend Online");
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log("🔥 JokerAI rodando na porta", PORT);
});