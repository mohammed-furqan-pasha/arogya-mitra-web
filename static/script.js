// Arogya Mitra Web Chat – Frontend Logic (Vanilla JS + Fetch API)

(function () {
  const chatWindow = document.getElementById("chat-window");
  const chatForm = document.getElementById("chat-form");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");

  const profileButton = document.getElementById("profile-button");
  const profileModalOverlay = document.getElementById("profile-modal-overlay");
  const profileForm = document.getElementById("profile-form");
  const profileCancel = document.getElementById("profile-cancel");
  const profileName = document.getElementById("profile-name");
  const profileAge = document.getElementById("profile-age");
  const profileDiabetes = document.getElementById("profile-diabetes");
  const profileBP = document.getElementById("profile-bp");
  const profileOther = document.getElementById("profile-other");

  const STORAGE_PROFILE_KEY = "arogya_mitra_profile";

  // --- Profile helpers ---

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_PROFILE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
  }

  function populateProfileForm() {
    const profile = loadProfile();
    if (!profile) {
      profileName.value = "";
      profileAge.value = "";
      profileDiabetes.checked = false;
      profileBP.checked = false;
      profileOther.value = "";
      return;
    }
    profileName.value = profile.name || "";
    profileAge.value = profile.age || "";
    profileDiabetes.checked = !!profile.diabetes;
    profileBP.checked = !!profile.bp;
    profileOther.value = profile.other || "";
  }

  function collectProfileFromForm() {
    const profile = {
      name: profileName.value.trim() || null,
      age: profileAge.value ? Number(profileAge.value) : null,
      diabetes: profileDiabetes.checked,
      bp: profileBP.checked,
      other: profileOther.value.trim() || null,
    };
    saveProfile(profile);
    return profile;
  }

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

    bubble.textContent = text;

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

  // --- Network / Chat logic ---

  async function sendMessage(event) {
    event.preventDefault();

    const rawText = messageInput.value.trim();
    if (!rawText) {
      return;
    }

    // Append user message immediately
    appendMessage(rawText, { isUser: true });

    // Clear input
    messageInput.value = "";
    messageInput.style.height = "auto";

    // Show loading / thinking indicator
    const thinkingBubble = showThinking();

    // Prepare payload for /api/chat
    const payload = {
      message: rawText,
    };

    const profile = loadProfile();
    if (profile) {
      payload.profile = profile; // backend can optionally use or ignore
    }

    sendButton.disabled = true;
    sendButton.classList.add("opacity-70");
    sendButton.textContent = "Sending…";

    try {
      const response = await fetch("/api/chat", {
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

      // Replace thinking message with real reply
      thinkingBubble.remove();
      appendMessage(botText, { isUser: false });
    } catch (error) {
      console.error(error);
      thinkingBubble.remove();
      appendMessage(
        "There was a problem reaching Arogya Mitra. Please check your internet connection and try again.",
        { isUser: false }
      );
    } finally {
      sendButton.disabled = false;
      sendButton.classList.remove("opacity-70");
      sendButton.textContent = "Send";
    }
  }

  // Auto-resize textarea
  function autoResizeTextarea() {
    messageInput.style.height = "auto";
    const maxHeight = 120; // px
    messageInput.style.height =
      Math.min(messageInput.scrollHeight, maxHeight) + "px";
  }

  // --- Modal handling ---

  function openProfileModal() {
    populateProfileForm();
    profileModalOverlay.classList.remove("hidden");
  }

  function closeProfileModal() {
    profileModalOverlay.classList.add("hidden");
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    const profile = collectProfileFromForm();

    appendMessage(
      `Profile updated. Age: ${
        profile.age || "N/A"
      }, Diabetes: ${profile.diabetes ? "Yes" : "No"}, BP: ${
        profile.bp ? "Yes" : "No"
      }.
`,
      { isUser: false, isMuted: true }
    );

    closeProfileModal();
  }

  // --- Init ---

  function init() {
    // Ensure profile is loaded (if present)
    loadProfile();

    chatForm.addEventListener("submit", sendMessage);
    messageInput.addEventListener("input", autoResizeTextarea);

    profileButton.addEventListener("click", openProfileModal);
    profileCancel.addEventListener("click", closeProfileModal);
    profileModalOverlay.addEventListener("click", (event) => {
      if (event.target === profileModalOverlay) {
        closeProfileModal();
      }
    });
    profileForm.addEventListener("submit", handleProfileSubmit);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
