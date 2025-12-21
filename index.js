import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.WRMGPT_API_KEY;

/* MEMÓRIA CURTA POR USUÁRIO */
const memory = new Map();
const MAX_MEMORY = 6;

/* TIMEOUT */
const fetchWithTimeout = (url, options, timeout = 15000) =>
  Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout da IA")), timeout)
    )
  ]);

app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.json({
      reply: "Começou errado. Mas vamos tentar de novo."
    });
  }

  const history = memory.get(sessionId) || [];

  history.push({ role: "user", content: message });
  if (history.length > MAX_MEMORY) history.shift();

  try {
    const response = await fetchWithTimeout(
      "https://api.wrmgpt.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "wormgpt-v7",
          temperature: 0.45,
          max_tokens: 280,
          top_p: 0.9,
          messages: [
            {
              role: "system",
              content:
                "Você é o Joker AI. Responda SOMENTE em português do Brasil. Tom irônico leve, inteligente, elegante. Use markdown (**negrito**, listas, quebras de linha). Nunca use espanhol. Nunca use emojis."
            },
            ...history
          ]
        })
      }
    );

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Resposta inválida da IA");
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("Resposta vazia da IA");
    }

    history.push({ role: "assistant", content: reply });
    memory.set(sessionId, history);

    res.json({ reply });

  } catch (err) {
    console.error("❌ ERRO IA:", err.message);

    res.json({
      reply:
        "**Algo saiu do controle.**\n\n" +
        "A IA tropeçou no próprio ego.\n" +
        "Tente novamente em alguns segundos."
    });
  }
});

app.get("/", (_, res) => {
  res.send("🃏 Joker AI backend online");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("🔥 Joker AI rodando na porta", PORT)
);