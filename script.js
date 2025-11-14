// ===============================
// AZBRY AI - FRONTEND CONFIG
// ===============================

// Ganti ini nanti kalau backend sudah siap (misal: /api/azbry-ai di Vercel)
const AZBRY_AI_ENDPOINT = "/api/azbry-ai";

// Simpan riwayat chat di memori lokal (optional)
let chatHistory = []; // { role: 'user'|'assistant', content: '...' }


// ===============================
// ELEMENT HELPER
// ===============================

const chatContainer = document.getElementById("chatContainer"); // div utk bubble chat
const chatForm = document.getElementById("chatForm");           // <form> input chat
const messageInput = document.getElementById("messageInput");   // <input> / <textarea>
const sendButton = document.getElementById("sendButton");       // tombol kirim (optional)

// fallback kalau elemen belum ada
if (!chatContainer || !chatForm || !messageInput) {
  console.warn(
    "[Azbry AI] Pastikan HTML punya elemen dengan id: chatContainer, chatForm, messageInput."
  );
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

  // biar line break (\n) kebaca
  bubble.innerText = text;

  wrapper.appendChild(bubble);
  chatContainer.appendChild(wrapper);

  // auto scroll ke bawah
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
  // kalau backend belum disiapin, balikin dummy
  if (!AZBRY_AI_ENDPOINT) {
    return {
      reply: "Backend Azbry AI belum di-setup. Silakan hubungi developer (Febry) dulu. 💚"
    };
  }

  try {
    const res = await fetch(AZBRY_AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        history: chatHistory // bisa dipakai backend buat konteks percakapan
      })
    });

    if (!res.ok) {
      console.error("[Azbry AI] HTTP Error:", res.status, res.statusText);
      return {
        reply: `Azbry AI lagi error (HTTP ${res.status}). Coba lagi nanti ya.`
      };
    }

    const data = await res.json();

    // Expected shape: { reply: "..." }
    if (!data || typeof data.reply !== "string") {
      return {
        reply: "Azbry AI balasannya nggak kebaca. Cek backend dulu ya."
      };
    }

    return data;
  } catch (err) {
    console.error("[Azbry AI] Fetch error:", err);
    return {
      reply: "Azbry AI nggak bisa dihubungi (network error). Coba cek koneksi / server."
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

  // tampilkan chat user
  appendMessage("user", text);
  chatHistory.push({ role: "user", content: text });

  // kosongkan input
  messageInput.value = "";
  messageInput.focus();

  // tampilkan typing indicator
  showTyping();

  // kirim ke backend
  const result = await sendToAzbryAI(text);

  // hilangkan typing
  hideTyping();

  // tampilkan jawaban AI
  appendMessage("assistant", result.reply);
  chatHistory.push({ role: "assistant", content: result.reply });
}


// ===============================
// INIT
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  if (chatForm) {
    chatForm.addEventListener("submit", handleChatSubmit);
  }

  // optional: sambutan awal
  appendMessage(
    "assistant",
    "Halo, gue Azbry AI. Siap bantu lu buat ngoding, bot, atau keuangan. Ketik aja apa yang mau lu tanyain. 💚"
  );
});
