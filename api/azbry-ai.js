// api/azbry-ai.js

// Vercel serverless function
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    // fallback kalau belum set API key, biar frontend tetap hidup
    return res.status(200).json({
      reply:
        "Azbry AI backend belum dikasih OPENAI_API_KEY di Vercel. Coba set dulu di Project Settings ya. 💚",
    });
  }

  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "Pesan nggak kebaca di backend." });
    }

    // potong history biar nggak kepanjangan
    const shortHistory = Array.isArray(history)
      ? history.slice(-8)
      : [];

    // bentuk messages buat model
    const messages = [
      {
        role: "system",
        content:
          "Kamu adalah Azbry AI, asisten milik FebryWesker. Gaya bahasa santai, tapi tetap jelas. " +
          "Fokus bantu soal bot WhatsApp (Azbry-MD), ngoding, dan keuangan pribadi. " +
          "Jawab singkat, rapi, dan kalau perlu pakai poin.",
      },
      ...shortHistory.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      {
        role: "user",
        content: message,
      },
    ];

    // Panggil OpenAI (Chat Completions)
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages,
        temperature: 0.4,
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, text);
      return res.status(500).json({
        reply: `Azbry AI lagi error dari sisi model (HTTP ${openaiRes.status}). Coba lagi nanti ya.`,
      });
    }

    const data = await openaiRes.json();
    const reply =
      data.choices?.[0]?.message?.content ||
      "Azbry AI nggak ngasih jawaban. Coba tanya ulang ya.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Azbry AI backend error:", err);
    return res.status(500).json({
      reply:
        "Backend Azbry AI ketemu error yang nggak terduga. Coba lagi beberapa saat lagi.",
    });
  }
}
