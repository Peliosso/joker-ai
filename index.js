import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AbortController from "abort-controller";

/* ================= APP ================= */
const app = express();
app.use(express.json());
app.use(cors());

/* ================= CONFIG ================= */
const API_KEYS = (process.env.WRMGPT_API_KEYS || "").split(",").filter(Boolean);
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

/* ================= TOKEN ROTATION ================= */
let currentKeyIndex = 0;
function getNextApiKey() {
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

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

function saveLog({ ip, ua, message, reply, tokenIndex }) {
  const time = new Date().toLocaleString("pt-BR");

  const logText =
`[${time}]
Token: ${tokenIndex}
IP: ${ip}
UA: ${ua}
Mensagem: ${message}
Resposta: ${reply}
------------------------------\n`;

  fs.appendFile(LOG_FILE, logText, () => {});
  memoryLogs.push({ time, ip, ua, message, reply, tokenIndex });
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
  let usedTokenIndex = currentKeyIndex;

  const MAX_TRIES = Math.min(2, API_KEYS.length);

for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const apiKey = getNextApiKey();
    usedTokenIndex = currentKeyIndex;

    try {
      const response = await fetch(
        "https://api.wrmgpt.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "wormgpt-v7",
            max_tokens: 500,
            temperature: 0.4,
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
Estilo: Claro, direto, informal, sarcástico.
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
        break;
      }

    } catch (err) {
      console.error("Erro com token", usedTokenIndex);
    }
  }

  saveLog({
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: req.headers["user-agent"],
    message: userMessage,
    reply,
    tokenIndex: usedTokenIndex
  });

  res.json({ reply });
});

app.post("/chat/continue", async (req, res) => {
  const { lastReply } = req.body;

  const apiKey = getNextApiKey();

  const response = await fetchWithTimeout(
    "https://api.wrmgpt.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "wormgpt-v7",
        max_tokens: 200,
        messages: [
          { role: "system", content: "Continue a resposta exatamente de onde parou." },
          { role: "assistant", content: lastReply }
        ]
      })
    },
    8000
  );

  const data = await response.json();
  res.json({ reply: data.choices?.[0]?.message?.content || "" });
});

async function fetchWithTimeout(url, options, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

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