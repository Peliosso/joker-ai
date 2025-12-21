import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors()); // Libera acesso externo (InfinityFree, etc)

const API_KEY = process.env.WRMGPT_API_KEY;

/* =========================
   ROTA PRINCIPAL DO CHAT
========================= */
app.post("/chat", async (req, res) => {
  const userMessage = req.body?.message;

  if (!userMessage || userMessage.trim() === "") {
    return res.json({
      reply: "**Erro:** mensagem vazia."
    });
  }

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
          max_tokens: 300,
          temperature: 0.35,
          top_p: 0.9,

          messages: [
            {
              role: "system",
              content: `
Você é o JokerAI.

REGRAS OBRIGATÓRIAS:
- Responda SEMPRE em PORTUGUÊS DO BRASIL.
- Nunca use espanhol ou qualquer outro idioma.
- Use parágrafos curtos.
- Use **negrito** para títulos ou pontos importantes.
- Pule linhas para facilitar a leitura.
- Seja direto, claro e objetivo.
- Não use emojis.
`
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

    let reply =
      data?.choices?.[0]?.message?.content ||
      "**Erro:** não foi possível gerar resposta.";

    /* =========================
       PÓS-PROCESSAMENTO
    ========================= */

    // Normaliza quebras de linha
    reply = reply.replace(/\n{3,}/g, "\n\n").trim();

    // Detecta possível espanhol (proteção extra)
    const espanhol = ["usted", "respuesta", "mensaje", "puede", "hola"];
    const escapou = espanhol.some(p =>
      reply.toLowerCase().includes(p)
    );

    if (escapou) {
      reply =
        "**Aviso:** resposta corrigida automaticamente.\n\n" +
        reply;
    }

    res.json({ reply });

  } catch (err) {
    res.json({
      reply: "**Erro:** falha na conexão com a IA."
    });
  }
});

/* =========================
   ROTA DE STATUS
========================= */
app.get("/", (_, res) => {
  res.send("🔥 Joker AI backend online");
});

/* =========================
   INICIALIZAÇÃO
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Joker AI rodando na porta ${PORT}`);
});