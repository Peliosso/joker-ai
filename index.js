import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(cors());

/* ================= CONFIG ================= */
const API_KEY = process.env.WRMGPT_API_KEY;
const ADMIN_KEY = process.env.ADMIN_KEY || "joker-admin-171";
const PORT = process.env.PORT || 3000;
const LOG_FILE = "./logs.txt";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== DASHBOARD PAGE ===== */
app.get("/admin", (req, res) => {
  const key = req.query.key;

  if (key !== ADMIN_KEY) {
    return res.status(403).send("Acesso negado.");
  }

  res.sendFile(path.join(__dirname, "admin.html"));
});

/* ================= LOG SYSTEM ================= */
let memoryLogs = [];

function saveLog({ ip, ua, message, reply }) {
  const time = new Date().toLocaleString("pt-BR");

  const logText =
`[${time}]
IP: ${ip}
User-Agent: ${ua}
Mensagem: ${message}
Resposta: ${reply}
----------------------------------\n`;

  // salva em arquivo
  fs.appendFile(LOG_FILE, logText, err => {
    if (err) console.error("Erro ao salvar log:", err);
  });

  // salva em memória (para painel)
  memoryLogs.push({ time, ip, ua, message, reply });

  // evita memória infinita
  if (memoryLogs.length > 500) memoryLogs.shift();
}

/* ================= CHAT ================= */
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.json({ reply: "Mensagem vazia." });
  }

  let reply = "Sem resposta da IA.";

  try {
    const response = await fetch(
      "https://api.wrmgpt.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "wormgpt-v7",
          max_tokens: 900,
          temperature: 0.4,
          top_p: 0.9,
          messages: [
            {
              role: "system",
              content:
                "Você é o JokerAI. Responda em português do Brasil. Se a resposta for longa, divida em partes numeradas (Parte 1, Parte 2, Parte 3). Use títulos, listas e negrito."
            },
            {
              role: "user",
              content: userMessage
            }
          ]
        })
      }
    );

    const data = await response.json();
    reply =
      data?.choices?.[0]?.message?.content ||
      reply;

  } catch (err) {
    reply = "Erro ao conectar com a IA.";
  }

  /* ===== SALVAR LOG ===== */
  saveLog({
    ip:
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress,
    ua: req.headers["user-agent"],
    message: userMessage,
    reply
  });

  res.json({ reply });
});

/* ================= ADMIN LOG VIEW ================= */
app.get("/logs", (req, res) => {
  const key = req.query.key;

  if (key !== ADMIN_KEY) {
    return res.status(403).send("Acesso negado.");
  }

  // mais recentes primeiro
  res.json([...memoryLogs].reverse());
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log("🔥 Joker AI rodando na porta", PORT);
});