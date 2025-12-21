import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.WRMGPT_API_KEY;

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.json({ reply: "Mensagem vazia." });
  }

  try {
    const response = await fetch("https://api.wrmgpt.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "wormgpt-v7",
        max_tokens: 250,
        temperature: 0.4,
        top_p: 0.9,
        messages: [
          {
            role: "system",
            content:
              "Você é o JokerAI. Responda SOMENTE em português do Brasil. Seja direto, claro e objetivo. Não use emojis."
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "Sem resposta da IA.";

    res.json({ reply });

  } catch (err) {
    res.status(500).json({
      reply: "Erro ao conectar com a IA.",
      error: err.message
    });
  }
});

app.get("/", (_, res) => {
  res.send("Joker AI backend online");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("🔥 Joker AI rodando na porta", PORT)
);