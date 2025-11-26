// Arogya Mitra Web Frontend Logic (Decoupled)

const API_URL = "https://arogya-mitra-web.onrender.com/api/chat";
const STORAGE_USER_ID_KEY = "arogya_mitra_user_id";

// --- User identity helpers ---

function generateUUID() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getUserId() {
  let id = localStorage.getItem(STORAGE_USER_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(STORAGE_USER_ID_KEY, id);
  }
  return id;
}

// --- DOM references ---

const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");

// --- Chat UI helpers ---

function scrollChatToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function createMessageBubble(text, { isUser = false, isMuted = false } = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = [
    "flex",
    "gap-3",
    "max-w-full",
    isUser ? "justify-end" : "justify-start",
  ].join(" ");

  const avatar = document.createElement("div");
  avatar.className =
    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold";

  if (isUser) {
    avatar.classList.add("bg-emerald-600", "text-white", "order-2");
    avatar.textContent = "YOU";
  } else {
    avatar.classList.add("bg-teal-700", "text-white");
    avatar.textContent = "AM";
  }

  const bubble = document.createElement("div");
  bubble.className = [
    "px-4",
    "py-3",
    "rounded-2xl",
    "text-sm",
    "shadow-sm",
    "max-w-[80%]",
    isUser
      ? "bg-emerald-600 text-white rounded-br-sm"
      : "bg-white text-slate-900 border border-slate-200 rounded-tl-sm",
    isMuted ? "opacity-70 italic" : "",
  ].join(" ");

  if (!isUser && typeof marked !== "undefined") {
    bubble.innerHTML = marked.parse(text);
  } else {
    bubble.textContent = text;
  }

  if (isUser) {
    wrapper.appendChild(bubble);
    wrapper.appendChild(avatar);
  } else {
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
  }

  return wrapper;
}

function appendMessage(text, options) {
  const bubble = createMessageBubble(text, options);
  chatWindow.appendChild(bubble);
  scrollChatToBottom();
  return bubble;
}

function showThinking() {
  return appendMessage("Thinking…", { isUser: false, isMuted: true });
}

// Auto-resize textarea for nicer UX
function autoResizeTextarea() {
  messageInput.style.height = "auto";
  const maxHeight = 120; // px
  messageInput.style.height =
    Math.min(messageInput.scrollHeight, maxHeight) + "px";
}

// --- Network / Chat logic ---

async function sendMessage(event) {
  if (event) {
    event.preventDefault();
  }

  const rawText = messageInput.value.trim();
  if (!rawText) return;

  const userId = getUserId();

  // Append user message immediately
  appendMessage(rawText, { isUser: true });

  // Clear input
  messageInput.value = "";
  messageInput.style.height = "auto";

  // Show loading / thinking indicator
  const thinkingBubble = showThinking();

  const payload = {
    user_id: userId,
    message: rawText,
  };

  sendButton.disabled = true;
  sendButton.textContent = "Sending…";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Chat request failed with status " + response.status);
    }

    const data = await response.json();
    const botText =
      data.response ||
      data.answer ||
      data.message ||
      "I'm sorry, I could not process your request.";

    // Replace thinking bubble with real reply
    thinkingBubble.remove();
    appendMessage(botText, { isUser: false });
  } catch (error) {
    console.error(error);
    thinkingBubble.remove();
    appendMessage(
      "There was a problem reaching Arogya Mitra API. Please check that the backend is running on http://127.0.0.1:8000 and try again.",
      { isUser: false }
    );
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send";
  }
}

// --- Initialization ---

function init() {
  // Ensure user_id exists
  getUserId();

  // Submit on form submit
  chatForm.addEventListener("submit", sendMessage);

  // Submit on Enter (but allow Shift+Enter for newline)
  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener("input", autoResizeTextarea);
}

document.addEventListener("DOMContentLoaded", init);
