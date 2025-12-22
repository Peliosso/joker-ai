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
const API_KEY = process.env.WRMGPT_API_KEYS; // OBRIGATÓRIO
const ADMIN_KEY = process.env.ADMIN_KEY || "joker-admin-171";
const PORT = process.env.PORT || 3000;
const LOG_FILE = "./logs.txt";

/* ================= PATH ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= STATIC ================= */
app.use(express.static(__dirname));

/* ================= STATUS ================= */
let SYSTEM_STATUS = "online"; // online | offline | maintenance

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

/* ================= SANITIZE ================= */
function sanitizeReply(text) {
  if (!text) return "";

  const forbidden = [
    /wrmgpt/gi,
    /wormgpt/gi,
    /openai/gi,
    /inteligência artificial/gi
  ];

  let sanitized = text;
  forbidden.forEach(r => {
    sanitized = sanitized.replace(r, "");
  });

  return sanitized.trim() || "♠ …";
}

/* ================= LOG ================= */
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
}

/* ================= CHAT ================= */
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.json({
        reply: "♠ Mensagem vazia. Digite algo."
      });
    }

    // decide se é imagem ou texto
    if (isImageRequest(message)) {
      return await handleImage(message, res);
    }

    return await handleText(message, res);

  } catch (err) {
    console.error("🔥 ERRO GERAL:", err);

    return res.json({
      reply: "♠ O sistema está instável agora. Tente novamente."
    });
  }
});

  // ===================== /IMG =====================
  // ===================== /IMG =====================
if (userMessage.startsWith("/img")) {
  const prompt = userMessage.replace("/img", "").trim();

  if (!process.env.VENICE_API_KEY) {
    return res.json({ reply: "♠ Venice API Key ausente." });
  }

  if (!prompt) {
    return res.json({ reply: "♠ Use /img + descrição da imagem." });
  }

  try {
    const imgRes = await fetch(
      "https://api.venice.ai/api/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.VENICE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          n: 1
        })
      }
    );

    const imgData = await imgRes.json();

    console.log("VENICE RESPONSE:", JSON.stringify(imgData));

    const base64 =
      imgData?.data?.[0]?.b64_json ||
      imgData?.data?.[0]?.image_base64;

    if (!base64) {
      return res.json({
        reply: "♠ Venice respondeu sem imagem."
      });
    }

    return res.json({
      type: "image",
      image: `data:image/png;base64,${base64}`,
      reply: `♠ Imagem gerada`
    });

  } catch (err) {
    console.error("Erro Venice:", err);
    return res.json({ reply: "♠ Erro ao conectar com Venice." });
  }
}

function isImageRequest(text) {
  return /(imagem|foto|desenho|ilustra|criar imagem|gera imagem)/i.test(text);
}

  // ===================== TEXTO NORMAL =====================
  let reply = "♠ Não consegui responder.";

  try {
    const response = await fetch(
      "https://api.wrmgpt.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WRMGPT_API_KEYS}`,
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

  res.json({ reply });
});

/* ================= LOG VIEW ================= */
app.get("/logs", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Acesso negado.");
  }
  res.sendFile(path.resolve(LOG_FILE));
});

/* ================= HEALTH ================= */
app.get("/", (req, res) => {
  res.send("🃏 Joker AI Backend Online");
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log("🔥 Joker AI rodando na porta", PORT);
});