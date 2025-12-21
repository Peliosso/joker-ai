import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors()); // libera para InfinityFree

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
        "Authorization": `Bearer ${process.env.WRMGPT_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "wormgpt-v7",

        // 🔥 CONTROLE TOTAL AQUI
        max_tokens: 250,            // limita resposta
        temperature: 0.4,           // menos variação = mais rápido
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
      "Erro ao obter resposta.";

    res.json({ reply });

  } catch (err) {
    res.json({ reply: "Erro de conexão com a IA." });
  }
});

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({
      error: "Erro no servidor",
      details: err.message
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


