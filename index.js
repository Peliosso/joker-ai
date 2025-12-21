import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(cors());

/* ================= CONFIG ================= */
const API_KEYS = (process.env.WRMGPT_API_KEYS || "").split(",").filter(Boolean);
const ADMIN_KEY = process.env.ADMIN_KEY || "joker-admin-171";
const PORT = process.env.PORT || 3000;
const LOG_FILE = "./logs.txt";

if (!API_KEYS.length) {
  console.error("❌ Nenhuma API key configurada");
}

/* ================= PATH FIX ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= TOKEN ROTATION ================= */
let currentKeyIndex = 0;
function getNextApiKey() {
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

/* ================= LOG SYSTEM ================= */
function saveLog({ ip, ua, message, reply, tokenIndex }) {
  const time = new Date().toLocaleString("pt-BR");
  const logText =
`[${time}]
Token: ${tokenIndex}
IP: ${ip}
User-Agent: ${ua}
Mensagem: ${message}
Resposta: ${reply}
----------------------------------\n`;

  fs.appendFile(LOG_FILE, logText, () => {});
}

/* ================= CHAT (ULTRA FAST) ================= */
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.json({ reply: "Mensagem vazia." });
  }

  let reply = null;
  let retried = false;
  let usedTokenIndex = null;

  const MAX_ATTEMPTS = Math.min(2, API_KEYS.length);
  const TIMEOUT_MS = 12000; // ⬅️ MAIS REALISTA

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const apiKey = getNextApiKey();
    usedTokenIndex = currentKeyIndex;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(
        "https://api.wrmgpt.com/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "wormgpt-v7",
            max_tokens: 250,
            temperature: 0.3,
            messages: [
              {
                role: "system",
                content:
                  "Você é o JokerAI. Responda em português do Brasil de forma direta e objetiva."
              },
              {
                role: "user",
                content: userMessage
              }
            ]
          })
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        console.error("HTTP erro:", response.status);
        retried = true;
        continue;
      }

      let data;
      try {
        data = await response.json();
      } catch {
        const text = await response.text();
        console.error("Resposta não JSON:", text.slice(0, 200));
        retried = true;
        continue;
      }

      const content = data?.choices?.[0]?.message?.content?.trim();

      if (content) {
        reply = content;
        break;
      } else {
        retried = true;
      }

    } catch (err) {
      console.error("Erro fetch:", err.name);
      retried = true;
    }
  }

  if (!reply) {
    reply = "⚠️ A IA está instável no momento. Tente novamente em alguns segundos.";
  }

  saveLog({
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: req.headers["user-agent"],
    message: userMessage,
    reply,
    tokenIndex: usedTokenIndex
  });

  res.json({ reply, retried });
});

/* ================= ADMIN ================= */
app.get("/admin", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Acesso negado.");
  }
  res.sendFile(path.join(__dirname, "admin.html"));
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log("⚡ Joker AI ULTRA FAST rodando na porta", PORT);
});