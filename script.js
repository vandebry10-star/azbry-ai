// ===============================
// SUPABASE CONFIG (AUTH)
// ===============================
const SUPABASE_URL = "https://mxmnmujsqhzrmivdiqvk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bW5tdWpzcWh6cm1pdmRpcXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjYyMzAsImV4cCI6MjA3ODYwMjIzMH0.BZHHWmSXPwuF1jtIxd4tvIFHke7c5QyiP55lE1oBNVo";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// chat
const chatContainer = document.getElementById("chatContainer");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

// auth
const authSection = document.getElementById("authSection");
const chatSection = document.getElementById("chatSection");
const authForm = document.getElementById("authForm");
const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmit");
const toggleAuthModeBtn = document.getElementById("toggleAuthMode");
const logoutButton = document.getElementById("logoutButton");
const userEmailLabel = document.getElementById("userEmailLabel");

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
    sessionId =
      "session-" + Date.now() + "-" + Math.random().toString(16).slice(2);
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
    // ambil access token supabase (biar nanti bisa dipake backend kalau perlu)
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token || null;

    const headers = { "Content-Type": "application/json" };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const res = await fetch(AZBRY_AI_ENDPOINT, {
      method: "POST",
      headers,
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

    const dataJson = await res.json();
    if (!dataJson || typeof dataJson.reply !== "string") {
      return {
        reply: "Azbry AI balasannya nggak kebaca. Cek backend dulu ya.",
      };
    }

    return dataJson;
  } catch (err) {
    console.error("[Azbry AI] Fetch error:", err);
    return {
      reply:
        "Azbry AI nggak bisa dihubungi (network error). Coba cek koneksi / server.",
    };
  }
}

// ===============================
// HANDLE CHAT FORM
// ===============================
async function handleChatSubmit(e) {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  // pastikan user sudah login
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    alert("Lu harus login dulu sebelum chat sama Azbry AI.");
    showAuth();
    return;
  }

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
// AUTH UI HELPERS
// ===============================
function showAuth() {
  if (authSection) authSection.style.display = "flex";
  if (chatSection) chatSection.style.display = "none";
}

function showChat(user) {
  if (authSection) authSection.style.display = "none";
  if (chatSection) chatSection.style.display = "flex";

  if (userEmailLabel) {
    userEmailLabel.innerText = user?.email || "";
  }
}

// ===============================
// AUTH LOGIC (LOGIN / REGISTER)
// ===============================
let authMode = "login"; // 'login' | 'register'

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value.trim();

  if (!email || !password) {
    alert("Email & password wajib diisi.");
    return;
  }

  try {
    if (authMode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // berhasil login
      showChat(data.user);
    } else {
      // REGISTER → kirim email konfirmasi
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin, // setelah klik verif balik ke site ini
        },
      });
      if (error) throw error;

      alert(
        "Registrasi berhasil! Cek email lu buat konfirmasi akun sebelum login."
      );
    }
  } catch (err) {
    console.error("[Azbry AI Auth] error:", err);
    alert(err.message || "Gagal proses auth. Coba lagi.");
  }
}

function toggleAuthMode() {
  if (!authSubmitBtn || !toggleAuthModeBtn) return;

  if (authMode === "login") {
    authMode = "register";
    authSubmitBtn.textContent = "Daftar & Kirim Link Verif";
    toggleAuthModeBtn.textContent = "Sudah punya akun? Login";
  } else {
    authMode = "login";
    authSubmitBtn.textContent = "Login";
    toggleAuthModeBtn.textContent = "Belum punya akun? Daftar";
  }
}

// ===============================
// LOGOUT
// ===============================
async function handleLogout() {
  await supabase.auth.signOut();
  chatHistory = [];
  chatContainer.innerHTML = "";
  appendMessage(
    "assistant",
    "Halo, gue Azbry AI. Silakan login lagi buat lanjut ngobrol. 💚"
  );
  showAuth();
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  initSession();

  // listen auth state
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      showChat(session.user);
    } else {
      showAuth();
    }
  });

  // cek session awal
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    showChat(data.session.user);
  } else {
    showAuth();
  }

  // bind form
  if (chatForm) {
    chatForm.addEventListener("submit", handleChatSubmit);
  }

  if (authForm) {
    authForm.addEventListener("submit", handleAuthSubmit);
  }

  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAuthMode();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // pesan pembuka (cuma kalau container masih kosong)
  if (chatContainer && chatContainer.children.length === 0) {
    appendMessage(
      "assistant",
      "Halo, gue Azbry AI. Siap bantu lu buat ngoding, bot, atau keuangan. Login dulu, terus ketik apa aja yang mau lu tanyain. 💚"
    );
  }
});
