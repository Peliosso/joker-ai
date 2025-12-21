import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.WRMGPT_API_KEY;

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) return res.json({ reply: "Mensagem vazia." });

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
          max_tokens: 900,            // 🔥 rápido
          temperature: 0.4,           // 🔥 responde direto
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

app.listen(process.env.PORT || 3000);
  console.log("🔥 Joker AI rodando na porta", PORT)
);