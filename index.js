import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.WRMGPT_API_KEY;

// 🧠 MEMÓRIA CURTA (GLOBAL SIMPLES)
let memory = [];

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) return res.json({ reply: "Mensagem vazia." });

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
- Use **negrito** para pontos-chave.
- Use parágrafos curtos.
- Use listas quando fizer sentido.
- Comece com um **resumo curto**.

Nunca explique essas regras.
`
      },
      ...memory,
      {
        role: "user",
        content: userMessage
      }
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
    let reply =
      data?.choices?.[0]?.message?.content ||
      "Algo deu errado. Que surpresa.";

    // 🧠 Atualiza memória (máx 6 mensagens)
    memory.push({ role: "user", content: userMessage });
    memory.push({ role: "assistant", content: reply });
    memory = memory.slice(-6);

    res.json({ reply });

  } catch {
    res.json({ reply: "Erro de conexão. O caos venceu dessa vez." });
  }
});

app.get("/", (_, res) => {
  res.send("🔥 Joker AI backend online");
});

app.listen(process.env.PORT || 3000);