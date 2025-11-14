/* ============================
   SUPABASE CLIENT
============================ */
const SUPABASE_URL = "https://mxmnmujsqhzrmivdiqvk.supabase.co"; // <-- punyamu
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bW5tdWpzcWh6cm1pdmRpcXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjYyMzAsImV4cCI6MjA3ODYwMjIzMH0.BZHHWmSXPwuF1jtIxd4tvIFHke7c5QyiP55lE1oBNVo";  // <-- ganti

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* ============================
   AZBRY AI API ENDPOINT
============================ */
const AZBRY_AI_ENDPOINT = "/api/azbry-ai";

/* ============================
   STATE
============================ */
let sessionId = null; // id percakapan per browser
let chatHistory = []; // { role: 'user'|'assistant', content: '...' }
let isLoginMode = true; // true = login, false = daftar

/* ============================
   ELEMENTS
============================ */

// Auth
const authSection = document.getElementById("authSection");
const chatSection = document.getElementById("chatSection");

const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const toggleAuthModeBtn = document.getElementById("toggleAuthMode");
const authAlert = document.getElementById("authAlert");
const userEmailLabel = document.getElementById("userEmailLabel");
const logoutButton = document.getElementById("logoutButton");

// Chat
const chatContainer = document.getElementById("chatContainer");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

/* ============================
   SESSION ID (LOCAL)
============================ */
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

/* ============================
   AUTH UI HELPERS
============================ */
function showAuthSection() {
  authSection.style.display = "flex";
  chatSection.style.display = "none";
}

function showChatSection(user) {
  authSection.style.display = "none";
  chatSection.style.display = "block";
  userEmailLabel.textContent = user?.email || "-";

  // kalau baru login, tampilin welcome message
  if (!chatHistory.length) {
    appendMessage(
      "assistant",
      "Halo, I am Azbry-AI, Ada yang bisa saya bantu?"
    );
  }
}

function setAuthMode(loginMode) {
  isLoginMode = loginMode;
  clearAuthAlert();

  if (isLoginMode) {
    document.querySelector(".auth-title").textContent = "Login Azbry AI";
    authSubmit.textContent = "Login";
    toggleAuthModeBtn.textContent = "Belum punya akun? Daftar";
  } else {
    document.querySelector(".auth-title").textContent = "Daftar Azbry AI";
    authSubmit.textContent = "Daftar";
    toggleAuthModeBtn.textContent = "Sudah punya akun? Login";
  }
}

function setAuthLoading(loading) {
  authSubmit.disabled = loading;
  authSubmit.textContent = loading
    ? isLoginMode
      ? "Memproses..."
      : "Mendaftar..."
    : isLoginMode
    ? "Login"
    : "Daftar";
}

function showAuthAlert(message, type = "error") {
  if (!authAlert) return;
  authAlert.style.display = "block";
  authAlert.textContent = message;
  authAlert.className = "auth-alert " + type; // "error" atau "success"
}

function clearAuthAlert() {
  if (!authAlert) return;
  authAlert.style.display = "none";
  authAlert.textContent = "";
  authAlert.className = "auth-alert";
}

/* ============================
   CHAT RENDER
============================ */
function appendMessage(role, text) {
  if (!chatContainer) return;

  const row = document.createElement("div");
  row.classList.add("chat-row");

  const bubble = document.createElement("div");
  bubble.classList.add("chat-bubble");

  if (role === "user") {
    // ===== USER (KANAN) =====
    row.classList.add("chat-row-user");
    bubble.classList.add("bubble-user");
    bubble.innerText = text;
    row.appendChild(bubble);
  } else {
    // ===== AZBRY (KIRI + AVATAR) =====
    row.classList.add("chat-row-ai", "chat-row-ai-avatar");

    const avatar = document.createElement("div");
    avatar.classList.add("chat-avatar");

    const img = document.createElement("img");
    img.src = "https://imgkub.com/images/2025/11/13/image.jpg";
    img.alt = "Azbry AI";
    avatar.appendChild(img);

    bubble.classList.add("bubble-ai");
    bubble.innerText = text;

    row.appendChild(avatar);
    row.appendChild(bubble);
  }

  chatContainer.appendChild(row);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* TYPING INDICATOR */
let typingEl = null;

function showTyping() {
  if (!chatContainer) return;
  typingEl = document.createElement("div");
  typingEl.classList.add("chat-row", "chat-row-ai");

  const bubble = document.createElement("div");
  bubble.classList.add("chat-bubble", "bubble-ai", "typing-bubble");
  bubble.innerText = "Wait Azbry sedang berfikir keras..";

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

/* ============================
   CALL BACKEND AZBRY AI
============================ */
async function sendToAzbryAI(message) {
  try {
    const res = await fetch(AZBRY_AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: chatHistory,
        sessionId,
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
      return {
        reply: "Azbry AI balasannya nggak kebaca. Cek backend dulu ya.",
      };
    }

    return data;
  } catch (err) {
    console.error("[Azbry AI] Fetch error:", err);
    return {
      reply:
        "Azbry AI nggak bisa dihubungi (network error). Coba cek koneksi / server.",
    };
  }
}

/* ============================
   HANDLE CHAT SUBMIT
============================ */
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

/* ============================
   AUTH HANDLERS (LOGIN / REGISTER)
============================ */
async function handleAuthSubmit(e) {
  e.preventDefault();
  clearAuthAlert();

  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    showAuthAlert("Email dan password wajib diisi.", "error");
    return;
  }
  if (password.length < 6) {
    showAuthAlert("Password minimal 6 karakter.", "error");
    return;
  }

  setAuthLoading(true);

  try {
    if (isLoginMode) {
      // LOGIN
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Beberapa pesan umum dari Supabase
        if (
          error.message &&
          error.message.toLowerCase().includes("invalid login credentials")
        ) {
          showAuthAlert(
            "Email atau password salah, atau akun belum terdaftar.",
            "error"
          );
        } else if (
          error.message &&
          error.message.toLowerCase().includes("email not confirmed")
        ) {
          showAuthAlert(
            "Email kamu belum terverifikasi. Cek inbox / spam dan klik link verifikasi dulu.",
            "error"
          );
        } else {
          showAuthAlert("Gagal login: " + error.message, "error");
        }
        return;
      }

      if (!data?.user) {
        showAuthAlert("Gagal login: user tidak ditemukan.", "error");
        return;
      }

      showAuthAlert("Login berhasil. Selamat datang kembali!", "success");
      setTimeout(() => {
        showChatSection(data.user);
      }, 400);
    } else {
      // REGISTER
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin, // setelah klik verif, balik ke web ini
        },
      });

      if (error) {
        if (
          error.message &&
          error.message.toLowerCase().includes("user already registered")
        ) {
          showAuthAlert(
            "Email sudah terdaftar. Silakan login pakai email tersebut.",
            "error"
          );
        } else {
          showAuthAlert("Gagal daftar: " + error.message, "error");
        }
        return;
      }

      showAuthAlert(
        "Pendaftaran berhasil. Cek email kamu untuk verifikasi, lalu login.",
        "success"
      );
      // balik ke mode login biar user langsung login setelah verif
      setAuthMode(true);
    }
  } catch (err) {
    console.error(err);
    showAuthAlert("Terjadi error saat proses auth.", "error");
  } finally {
    setAuthLoading(false);
  }
}

/* ============================
   LOGOUT
============================ */
async function handleLogout() {
  await supabase.auth.signOut();
  chatHistory = [];
  if (chatContainer) chatContainer.innerHTML = "";
  showAuthSection();
  clearAuthAlert();
  authEmail.value = "";
  authPassword.value = "";
}

/* ============================
   INIT
============================ */
document.addEventListener("DOMContentLoaded", async () => {
  initSession();
  setAuthMode(true); // default: login

  // Cek kalau user sudah login (refresh page)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    showChatSection(user);
  } else {
    showAuthSection();
  }

  // Event auth
  if (authForm) authForm.addEventListener("submit", handleAuthSubmit);
  if (toggleAuthModeBtn)
    toggleAuthModeBtn.addEventListener("click", () =>
      setAuthMode(!isLoginMode)
    );
  if (logoutButton) logoutButton.addEventListener("click", handleLogout);

  // Event chat
  if (chatForm) chatForm.addEventListener("submit", handleChatSubmit);
});
