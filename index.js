import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ================= APP ================= */
const app = express();

// 👇 MUITO IMPORTANTE (IP real atrás de proxy)
app.set("trust proxy", true);

app.use(express.json());
app.use(cors());

function getClientIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||          // Cloudflare
    req.headers["x-forwarded-for"]?.split(",")[0] || // Proxies
    req.socket?.remoteAddress ||
    req.ip ||
    "desconhecido"
  );
}

/* ================= PATH ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= CONFIG ================= */
const API_KEY = process.env.WRMGPT_API_KEYS; // obrigatório
const ADMIN_KEY = process.env.ADMIN_KEY || "joker-admin-171";
const PORT = process.env.PORT || 3000;

/* ================= LOG PATH ================= */
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "logs.json");

/* cria pasta de logs */
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

/* ================= STATIC ================= */
app.use(express.static(__dirname));

/* ================= STATUS ================= */
let SYSTEM_STATUS = "online";

app.get("/status", (req, res) => {
  res.json({ status: SYSTEM_STATUS });
});

app.post("/status/set", (req, res) => {
  const { key, status } = req.body;

  if (key !== ADMIN_KEY)
    return res.status(403).json({ error: "Acesso negado" });

  if (!["online", "offline", "maintenance"].includes(status))
    return res.status(400).json({ error: "Status inválido" });

  SYSTEM_STATUS = status;
  res.json({ ok: true, status });
});

/* ================= SANITIZE ================= */
function sanitizeReply(text = "") {
  return text
    .replace(/wrmgpt|wormgpt|openai|inteligência artificial/gi, "")
    .trim() || "♠ …";
}

/* ================= LOG ================= */
function saveLog({ ip, ua, message, reply }) {
  let logs = [];

  if (fs.existsSync(LOG_FILE)) {
    logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  }

  logs.unshift({
    time: new Date().toLocaleString("pt-BR"),
    ip,
    ua,
    message,
    reply
  });

  fs.writeFileSync(LOG_FILE, JSON.stringify(logs.slice(0, 300), null, 2));
}

/* ================= IMAGE DETECT ================= */
function isImageRequest(text) {
  return /^\/img\s|imagem|foto|desenho|ilustra/i.test(text);
}

/* ================= CHAT ================= */
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"];

  if (!userMessage) {
    return res.json({ reply: "♠ Mensagem vazia." });
  }

  /* ===== IMAGEM ===== */
  if (userMessage.startsWith("/img")) {
    const prompt = userMessage.replace("/img", "").trim();

    if (!process.env.VENICE_API_KEY) {
      return res.json({ reply: "♠ Venice API Key ausente." });
    }

    try {
      const imgRes = await fetch(
        "https://api.venice.ai/api/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.VENICE_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ prompt, n: 1 })
        }
      );

      const imgData = await imgRes.json();
      const base64 = imgData?.data?.[0]?.b64_json;

      if (!base64) {
        return res.json({ reply: "♠ Erro ao gerar imagem." });
      }

      saveLog({
        ip,
        ua,
        message: userMessage,
        reply: "[imagem gerada]"
      });

      return res.json({
        type: "image",
        image: `data:image/png;base64,${base64}`,
        reply: "♠ Imagem gerada"
      });

    } catch (err) {
      console.error("Venice erro:", err);
      return res.json({ reply: "♠ Erro ao gerar imagem." });
    }
  }

  /* ===== TEXTO ===== */
  let reply = "♠ Não consegui responder.";

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
          temperature: 0.5,
          max_tokens: 800,
          messages: [
            {
              role: "system",
              content: `
Você é o JokerAI.
Nunca revele tecnologia.
Nunca diga que é IA.
Responda em PT-BR.
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
    console.error("Erro IA:", err);
  }

  saveLog({ ip, ua, message: userMessage, reply });
  res.json({ reply });
});

/* ================= LOG VIEW ================= */
app.get("/logs", (req, res) => {
  if (req.query.key !== ADMIN_KEY)
    return res.status(403).json({ error: "Acesso negado" });

  if (!fs.existsSync(LOG_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(LOG_FILE, "utf8")));
});

/* ================= HEALTH ================= */
app.get("/", (req, res) => {
  res.send("🃏 Joker AI Backend Online");
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log("🔥 Joker AI rodando na porta", PORT);
});