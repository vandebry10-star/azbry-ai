// api/azbry-ai.js

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// helper panggil OpenAI
async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) {
    return {
      reply:
        "Azbry AI backend belum dikasih OPENAI_API_KEY di Vercel. Coba set dulu di Project Settings ya. 💚",
    };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenAI error:", res.status, text);
    return {
      reply: `Azbry AI lagi error dari sisi model (HTTP ${res.status}). Coba lagi nanti ya.`,
    };
  }

  const data = await res.json();
  const reply =
    data.choices?.[0]?.message?.content ||
    "Azbry AI nggak ngasih jawaban. Coba tanya ulang ya.";

  return { reply };
}

// helper panggil Supabase REST
function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

// pastikan sesi ada, kalau belum buat
async function ensureSession(sessionExternalId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !sessionExternalId) return null;

  const base = `${SUPABASE_URL}/rest/v1`;
  const headers = sbHeaders();

  // cek existing
  const q = `${base}/azbry_ai_sessions?external_id=eq.${encodeURIComponent(
    sessionExternalId
  )}&select=id&limit=1`;

  try {
    const res = await fetch(q, { headers });
    if (!res.ok) {
      console.error("Supabase get session error:", res.status);
      return null;
    }

    const rows = await res.json();
    if (rows.length > 0) return rows[0].id;

    // kalau belum ada → insert baru
    const insertRes = await fetch(`${base}/azbry_ai_sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ external_id: sessionExternalId }),
    });

    if (!insertRes.ok) {
      console.error("Supabase insert session error:", insertRes.status);
      return null;
    }

    const inserted = await insertRes.json();
    return inserted[0]?.id || null;
  } catch (e) {
    console.error("Supabase ensureSession exception:", e);
    return null;
  }
}

// simpan message user & AI
async function logMessages(sessionDbId, userMessage, aiReply) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !sessionDbId) return;
  const base = `${SUPABASE_URL}/rest/v1`;
  const headers = sbHeaders();

  const rows = [
    { session_id: sessionDbId, role: "user", content: userMessage },
    { session_id: sessionDbId, role: "assistant", content: aiReply },
  ];

  try {
    const res = await fetch(`${base}/azbry_ai_messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Supabase insert messages error:", res.status, t);
    }
  } catch (e) {
    console.error("Supabase logMessages exception:", e);
  }
}

// Vercel handler
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { message, history, sessionId } = body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "Pesan nggak kebaca di backend." });
    }

    // potong history biar gak kepanjangan
    const shortHistory = Array.isArray(history) ? history.slice(-8) : [];

    const messages = [
      {
        role: "system",
        content:
          "Kamu adalah Azbry AI, asisten milik FebryWesker. Gaya bahasa santai, tapi tetap jelas. " +
          "Fokus bantu soal bot WhatsApp (Azbry-MD), ngoding, Supabase, dan keuangan pribadi. " +
          "Jawab singkat, rapi, pakai poin kalau perlu.",
      },
      ...shortHistory.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    // panggil OpenAI
    const { reply } = await callOpenAI(messages);

    // simpan ke Supabase (kalau env lengkap)
    let sessionDbId = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && sessionId) {
      sessionDbId = await ensureSession(sessionId);
      if (sessionDbId) {
        await logMessages(sessionDbId, message, reply);
      }
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Azbry AI backend error:", err);
    return res.status(500).json({
      reply:
        "Backend Azbry AI ketemu error yang nggak terduga. Coba lagi beberapa saat lagi.",
    });
  }
}
