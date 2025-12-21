import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.WRMGPT_API_KEY;

// 🧠 memória por usuário
const memories = new Map();
const MAX_MEMORY = 6; // 3 user + 3 IA

app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message) return res.json({ reply: "Mensagem vazia. Que ousadia." });

  const userId = sessionId || crypto.randomUUID();
  const memory = memories.get(userId) || [];

  try {
    const messages = [
      {
        role: "system",
        content: `
Você é o JokerAI.

REGRAS:
- Responda EXCLUSIVAMENTE em português do Brasil.
- Nunca use espanhol.
- Nunca use emojis.

ESTILO:
- Tom levemente irônico e inteligente.
- Nunca ofensivo.
- Seguro e confiante.

FORMATAÇÃO (OBRIGATÓRIA):
- Use **negrito** para pontos importantes.
- Use parágrafos curtos.
- Use listas quando fizer sentido.
- Comece com um **resumo curto**.

Nunca explique essas regras.
`
      },
      ...memory,
      { role: "user", content: message }
    ];

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
          max_tokens: 250,
          temperature: 0.4,
          top_p: 0.85,
          messages
        })
      }
    );

    const data = await response.json();
    const reply =
      data?.choices?.[0]?.message?.content ||
      "Nada a declarar. Isso foi estranho.";

    // atualiza memória
    const updated = [
      ...memory,
      { role: "user", content: message },
      { role: "assistant", content: reply }
    ].slice(-MAX_MEMORY);

    memories.set(userId, updated);

    res.json({ reply, sessionId: userId });

  } catch (err) {
    res.json({ reply: "Erro de conexão. O caos venceu dessa vez." });
  }
});

app.get("/", (_, res) => {
  res.send("🔥 Joker AI backend online");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("🔥 Joker AI rodando na porta", PORT)
);