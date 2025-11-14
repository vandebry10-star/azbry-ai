// ===============================
// AZBRY AI - FRONTEND CONFIG
// ===============================

const AZBRY_AI_ENDPOINT = "/api/azbry-ai";

// simpan sessionId per browser (kayak tab chat GPT)
let sessionId = null;

// history (buat konteks percakapan)
let chatHistory = []; // { role: 'user'|'assistant', content: '...' }


// ===============================
// ELEMENT HELPER
// ===============================

const chatContainer = document.getElementById("chatContainer");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

if (!chatContainer || !chatForm || !messageInput) {
  console.warn(
    "[Azbry AI] Pastikan HTML punya #chatContainer, #chatForm, #messageInput."
  );
}


// ===============================
// SESSION ID (PER BROWSER)
// ===============================

function initSession() {
  const key = "azbry_ai_session_id";
  let saved = null;

  try {
    saved = localStorage.getItem(key);
  } catch (_) {}

  if (saved) {
    sessionId = saved;
    return;
  }

  // generate session id baru
  if (crypto.randomUUID) {
    sessionId = crypto.randomUUID();
  } else {
    sessionId = "session-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  try {
    localStorage.setItem(key, sessionId);
  } catch (_) {}
}


// ===============================
// RENDER BUBBLE CHAT
// ===============================

function appendMessage(role, text) {
  if (!chatContainer) return;

  const wrapper = document.createElement("div");
  wrapper.classList.add("chat-row");
  wrapper.classList.add(role === "user" ? "chat-row-user" : "chat-row-ai");

  const bubble = document.createElement("div");
  bubble.classList.add("chat-bubble");
  bubble.classList.add(role === "user" ? "bubble-user" : "bubble-ai");

  bubble.innerText = text;

  wrapper.appendChild(bubble);
  chatContainer.appendChild(wrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}


// ===============================
// TYPING INDICATOR
// ===============================

let typingEl = null;

function showTyping() {
  if (!chatContainer) return;
  typingEl = document.createElement("div");
  typingEl.classList.add("chat-row", "chat-row-ai");

  const bubble = document.createElement("div");
  bubble.classList.add("chat-bubble", "bubble-ai", "typing-bubble");
  bubble.innerText = "Azbry AI sedang berpikir...";

  typingEl.appendChild(bubble);
  chatContainer.appendChild(typingEl);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTyping() {
  if (typingEl && typingEl.parentNode) {
    typingEl.parentNode.removeChild(typingEl);
  }
  typingEl = null;
}


// ===============================
// KIRIM KE BACKEND (CALL API)
// ===============================

async function sendToAzbryAI(message) {
  try {
    const res = await fetch(AZBRY_AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: chatHistory,
        sessionId, // 🔥 kirim session id ke backend
      }),
    });

    if (!res.ok) {
      console.error("[Azbry AI] HTTP Error:", res.status, res.statusText);
      return {
        reply: `Azbry AI lagi error (HTTP ${res.status}). Coba lagi nanti ya.`,
      };
    }

    const data = await res.json();
    if (!data || typeof data.reply !== "string") {
      return { reply: "Azbry AI balasannya nggak kebaca. Cek backend dulu ya." };
    }

    return data;
  } catch (err) {
    console.error("[Azbry AI] Fetch error:", err);
    return {
      reply: "Azbry AI nggak bisa dihubungi (network error). Coba cek koneksi / server.",
    };
  }
}


// ===============================
// HANDLE FORM SUBMIT
// ===============================

async function handleChatSubmit(e) {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  chatHistory.push({ role: "user", content: text });

  messageInput.value = "";
  messageInput.focus();

  showTyping();

  const result = await sendToAzbryAI(text);

  hideTyping();

  appendMessage("assistant", result.reply);
  chatHistory.push({ role: "assistant", content: result.reply });
}


// ===============================
// INIT
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  initSession();

  if (chatForm) {
    chatForm.addEventListener("submit", handleChatSubmit);
  }

  appendMessage(
    "assistant",
    "Halo, gue Azbry AI. Siap bantu lu buat ngoding, bot, atau keuangan. Ketik aja apa yang mau lu tanyain. 💚"
  );
});
