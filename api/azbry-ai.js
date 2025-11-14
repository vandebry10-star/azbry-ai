// api/azbry-ai.js

// ===== ENV VARS =====
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODEL_NAME = "llama-3.1-70b-versatile"; // model Groq

// ===== CALL GROQ (CHAT COMPLETIONS) =====
async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    return {
      reply:
        "GROQ_API_KEY belum di-set di Vercel. Tambahin dulu di Environment Variables ya.",
    };
  }

  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages,
          stream: false,
        }),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      console.error("Groq HTTP error:", res.status, txt);

      let msg = `Azbry AI lagi error dari sisi model (HTTP ${res.status}).`;
      try {
        const j = JSON.parse(txt);
        if (j.error?.message) msg = `Groq: ${j.error.message}`;
      } catch (_) {}

      return { reply: msg };
    }

    const data = await res.json();
    const reply =
      data.choices?.[0]?.message?.content ||
      "Model Groq nggak ngasih jawaban. Coba tanya ulang ya.";

    return { reply };
  } catch (err) {
    console.error("Groq fetch error:", err);
    return {
      reply:
        "Azbry AI nggak bisa nyambung ke Groq (network error). Coba cek koneksi / tunggu sebentar.",
    };
  }
}

// ===== SUPABASE HELPERS =====
function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function ensureSession(sessionExternalId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !sessionExternalId) return null;

  const base = `${SUPABASE_URL}/rest/v1`;
  const headers = sbHeaders();

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

// ===== VERCEL API HANDLER =====
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

    const shortHistory = Array.isArray(history) ? history.slice(-8) : [];

    const messages = [
      {
        role: "system",
        content:
          "Kamu adalah Azbry AI, asisten milik FebryWesker. Gaya bahasa santai, jelas, dan fokus ke: " +
          "bot WhatsApp (Baileys / Azbry-MD), ngoding JS/Node, Supabase, dan keuangan pribadi. " +
          "Jawab rapi, jangan kepanjangan, pakai poin kalau perlu.",
      },
      ...shortHistory.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const { reply } = await callGroq(messages);

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
