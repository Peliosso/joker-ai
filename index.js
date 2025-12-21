import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors()); // libera para InfinityFree

const API_KEY = process.env.WRMGPT_API_KEY;

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Mensagem vazia" });
    }

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
          messages: [
            { role: "user", content: message }
          ]
        })
      }
    );

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
