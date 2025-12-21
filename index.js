import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(cors());

/* ================= CONFIG ================= */
const API_KEYS = (process.env.WRMGPT_API_KEYS || "").split(",").filter(Boolean);
const PORT = process.env.PORT || 3000;

if (!API_KEYS.length) {
  console.error("❌ WRMGPT_API_KEYS NÃO DEFINIDA");
  process.exit(1);
}

/* ================= PATH FIX ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= KEEP ALIVE ================= */
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100
});

/* ================= IA CALL ================= */
function callAI(apiKey, message) {
  return new Promise(async (resolve, reject) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(
        "https://api.wrmgpt.com/v1/chat/completions",
        {
          method: "POST",
          agent: { https: httpsAgent }, // ✅ CORRETO
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "wormgpt-v7",
            max_tokens: 300,
            temperature: 0.4,
            messages: [
              {
                role: "system",
                content:
                  "Você é o JokerAI. Responda sempre em português do Brasil, de forma direta."
              },
              { role: "user", content: message }
            ]
          }),
          signal: controller.signal
        }
      );

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        return reject("Resposta vazia");
      }

      resolve(content);

    } catch (err) {
      reject(err);
    } finally {
      clearTimeout(timeout);
    }
  });
}

/* ================= CHAT ================= */
app.post("/chat", async (req, res) => {
  const message = req.body.message;
  if (!message) {
    return res.json({ reply: "Mensagem vazia." });
  }

  try {
    // ⚡ primeira resposta válida vence
    const reply = await Promise.any(
      API_KEYS.map(key => callAI(key, message))
    );

    res.json({ reply });

  } catch {
    res.json({
      reply: "⚠️ IA temporariamente indisponível. Tente novamente."
    });
  }
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log("🔥 Joker AI FUNCIONANDO na porta", PORT);
});