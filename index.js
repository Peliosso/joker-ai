import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ================= SETUP ================= */
const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "joker-admin-171";
const API_KEYS = (process.env.WRMGPT_API_KEYS || "")
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

if (!API_KEYS.length) {
  console.error("❌ WRMGPT_API_KEYS não configurado");
}

/* ================= PATH ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= TOKEN ROTATION ================= */
let tokenIndex = 0;
function getNextApiKey() {
  const key = API_KEYS[tokenIndex];
  tokenIndex = (tokenIndex + 1) % API_KEYS.length;
  return key;
}

/* ================= MEMORY ================= */
const responses = {};   // respostas prontas
const jobs = {};        // jobs em processamento
const LOG_FILE = "./logs.txt";

/* ================= LOG ================= */
function saveLog({ ip, ua, message, reply, token }) {
  const time = new Date().toLocaleString("pt-BR");
  const log = `
[${time}]
Token: ${token}
IP: ${ip}
UA: ${ua}
Mensagem: ${message}
Resposta: ${reply}
-------------------------------
`;
  fs.appendFile(LOG_FILE, log, () => {});
}

/* ================= IA BACKGROUND ================= */
async function generateAI(message, jobId) {
  let reply = "Sem resposta da IA.";

  for (let i = 0; i < API_KEYS.length; i++) {
    const apiKey = getNextApiKey();

    try {
      const r = await fetch("https://api.wrmgpt.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "wormgpt-v7",
          max_tokens: 350,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "Você é o JokerAI. Responda SEMPRE em português do Brasil. Seja direto, claro e evite textos longos."
            },
            {
              role: "user",
              content: message
            }
          ]
        })
      });

      const data = await r.json();

      if (data?.choices?.[0]?.message?.content) {
        reply = data.choices[0].message.content;
        break;
      }

    } catch (e) {
      console.error("Erro token", i);
    }
  }

  responses[jobId] = reply;
  jobs[jobId].done = true;

  saveLog({
    ip: jobs[jobId].ip,
    ua: jobs[jobId].ua,
    message,
    reply,
    token: tokenIndex
  });

  // limpeza
  setTimeout(() => {
    delete responses[jobId];
    delete jobs[jobId];
  }, 5 * 60 * 1000);
}

/* ================= CHAT ================= */
app.post("/chat", (req, res) => {
  const message = req.body.message;
  if (!message) {
    return res.json({ reply: "Mensagem vazia." });
  }

  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2);

  jobs[jobId] = {
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: req.headers["user-agent"],
    done: false
  };

  // resposta imediata
  res.json({
    reply: "✔️ Mensagem recebida. Gerando resposta…",
    jobId
  });

  // roda em background
  generateAI(message, jobId);
});

/* ================= RESULT ================= */
app.get("/chat/result/:id", (req, res) => {
  const id = req.params.id;

  if (!jobs[id]) {
    return res.json({ status: "expired" });
  }

  if (!jobs[id].done) {
    return res.json({ status: "processing" });
  }

  return res.json({
    status: "done",
    reply: responses[id]
  });
});

/* ================= ADMIN ================= */
app.get("/admin", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Acesso negado.");
  }
  res.send("Joker AI rodando ✔️");
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🔥 Joker AI rodando na porta", PORT);
});