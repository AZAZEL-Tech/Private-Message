import { MEMBERS } from "./data/members.js?v=20260917_09";
import { STORIES_DATA } from "./data/stories.js?v=20260917_09";
import { AI_MODELS } from "./data/models.js";
import { Storage } from "./services/storage.js";
import { AIService } from "./services/aiService.js";
import { soundEffects } from "./services/soundEffects.js";

// Global App State
const state = {
  currentTab: "chats",
  activeMemberId: null,
  activeFilter: "all",
  searchQuery: "",
  contactSearchQuery: "",
  contactActiveFilter: "all",
  editingContactMemberId: null,
  activeStory: null,
  storyIndex: 0,
  storyTimer: null,
  isTyping: false
};

// Safe DOM Resolver Helper
function getEl(id) {
  return document.getElementById(id);
}

function isDesktopView() {
  return window.innerWidth >= 768;
}

// Helpers for Custom Name vs Official Name
function getMemberDisplayName(member) {
  if (!member) return "";
  const custom = Storage.getMemberCustomName(member.id);
  if (custom && custom.trim()) {
    return custom.trim();
  }
  return member.shortName || member.name;
}

function hasCustomName(memberId) {
  const custom = Storage.getMemberCustomName(memberId);
  return Boolean(custom && custom.trim());
}

function getMemberOfficialName(member) {
  if (!member) return "";
  return member.fullName || member.name;
}

// Avatar Fallback Helper
const AVATAR_FALLBACK = "assets/members/freya_jayawardana.jpg";

function getAvatarImgHtml(src, alt, className = "chat-item-avatar") {
  const safeSrc = src || AVATAR_FALLBACK;
  const safeAlt = escapeHtml(alt || "Member");
  return `<img class="${className}" src="${safeSrc}" alt="${safeAlt}" loading="lazy" onerror="this.onerror=null;this.src='${AVATAR_FALLBACK}';" />`;
}

// Initialize App
function initApp() {
  setupTheme();
  setupClock();
  setupEventListeners();
  renderChatList();
  renderContactsList();
  renderUpdatesList();
  renderSettingsForm();
  updateTotalUnreadBadge();

  if (isDesktopView()) {
    openChatRoom("freya");
  }
}

// Clock updates
function setupClock() {
  const updateTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const timeDisplay = getEl("status-time");
    if (timeDisplay) {
      timeDisplay.textContent = `${hours}:${mins}`;
    }
  };
  updateTime();
  setInterval(updateTime, 10000);
}

// Theme handling
function setupTheme() {
  const currentTheme = Storage.getThemeMode();
  document.documentElement.setAttribute("data-theme", currentTheme);
  const themeToggle = getEl("theme-toggle-btn");
  if (themeToggle) {
    themeToggle.textContent = currentTheme === "dark" ? "☀️" : "🌙";
  }
}

function toggleTheme() {
  const currentTheme = Storage.getThemeMode();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  Storage.setThemeMode(nextTheme);
  setupTheme();
  showToast(nextTheme === "dark" ? "Mode Gelap Aktif" : "Mode Terang Aktif");
}

// Toast notification helper
function showToast(message, icon = "✨") {
  const toast = document.createElement("div");
  toast.className = "ios-toast";
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}
window.showToast = showToast;

// Unread badge calculation
function updateTotalUnreadBadge() {
  let total = 0;
  MEMBERS.forEach(m => {
    const history = Storage.getChatHistory(m.id);
    if (history === null) {
      total += m.unreadCount;
    }
  });
  const tabUnreadBadge = getEl("tab-unread-badge");
  if (tabUnreadBadge) {
    tabUnreadBadge.textContent = total > 0 ? total : "";
    tabUnreadBadge.style.display = total > 0 ? "flex" : "none";
  }
  const chatBackUnreadText = getEl("chat-back-unread-text");
  if (chatBackUnreadText) {
    chatBackUnreadText.textContent = total > 0 ? `${total}` : "";
  }
}

// =============================================================================
// RENDER CHAT LIST
// =============================================================================
function renderChatList() {
  const container = getEl("chat-list-items");
  if (!container) return;
  
  const query = state.searchQuery.toLowerCase();
  const filtered = MEMBERS.filter(m => {
    const customName = (Storage.getMemberCustomName(m.id) || "").toLowerCase();
    const matchSearch = m.name.toLowerCase().includes(query) || 
                        m.fullName.toLowerCase().includes(query) ||
                        customName.includes(query) ||
                        m.generation.toLowerCase().includes(query) ||
                        (m.team && m.team.toLowerCase().includes(query)) ||
                        m.tags.some(t => t.toLowerCase().includes(query));
    if (!matchSearch) return false;

    if (state.activeFilter === "team-love") return m.team && m.team.toLowerCase().includes("love");
    if (state.activeFilter === "team-dream") return m.team && m.team.toLowerCase().includes("dream");
    if (state.activeFilter === "team-passion") return m.team && m.team.toLowerCase().includes("passion");
    if (state.activeFilter === "trainee") return m.team && (m.team.toLowerCase().includes("pelatihan") || m.team.toLowerCase().includes("trainee"));
    if (state.activeFilter === "unread") {
      const history = Storage.getChatHistory(m.id);
      return history === null ? m.unreadCount > 0 : false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--ios-text-secondary);">
        <div style="font-size: 32px; margin-bottom: 8px;">💬</div>
        <div style="font-weight: 600; font-size: 15px;">Tidak ada obrolan ditemukan</div>
        <div style="font-size: 13px; margin-top: 4px;">Coba gunakan kata kunci pencarian atau filter lain.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(member => {
    const history = Storage.getChatHistory(member.id);
    let previewText = member.lastMessage;
    let previewTime = member.lastMessageTime;
    let unread = member.unreadCount;

    if (history && history.length > 0) {
      const lastMsg = history[history.length - 1];
      previewText = (lastMsg.isUser ? "Anda: " : "") + (lastMsg.isPhoto ? "📷 Foto" : lastMsg.text);
      previewTime = lastMsg.time || member.lastMessageTime;
      unread = 0;
    }

    const currentStreak = Storage.getMemberStreak(member.id);
    const showFlame = currentStreak >= 3;
    const isSelected = isDesktopView() && state.activeMemberId === member.id;
    const displayName = getMemberDisplayName(member);
    const isCustom = hasCustomName(member.id);

    return `
      <div class="chat-item ${isSelected ? 'selected' : ''}" data-member-id="${member.id}">
        <div class="chat-item-avatar-wrap">
          ${getAvatarImgHtml(member.avatar, member.name, "chat-item-avatar")}
          ${member.online ? '<div class="chat-online-badge"></div>' : ''}
        </div>
        <div class="chat-item-content">
          <div class="chat-item-top">
            <div class="chat-item-name">
              ${displayName}
              ${isCustom ? `<span class="contact-custom-badge" title="Nama Kontak Kustom">⭐</span>` : ''}
              <span class="chat-gen-tag">${member.generation}</span>
              ${member.team ? `<span class="chat-team-tag ${member.team.toLowerCase().includes('love') ? 'love' : member.team.toLowerCase().includes('dream') ? 'dream' : member.team.toLowerCase().includes('passion') ? 'passion' : 'trainee'}">${member.team}</span>` : ''}
            </div>
            <div class="chat-item-time ${unread > 0 ? 'unread' : ''}">${previewTime}</div>
          </div>
          <div class="chat-item-bottom">
            <div class="chat-item-preview">${previewText}</div>
            <div class="chat-badge-group">
              ${showFlame ? `<span class="chat-streak-flame-pill" title="Streak ${currentStreak} Hari">🔥 ${currentStreak}</span>` : ''}
              ${unread > 0 ? `<span class="chat-unread-badge">${unread}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".chat-item").forEach(el => {
    el.addEventListener("click", () => {
      const memberId = el.getAttribute("data-member-id");
      openChatRoom(memberId);
    });
  });
}

// =============================================================================
// RENDER BUKU KONTAK (CONTACTS DIRECTORY)
// =============================================================================
function renderContactsList() {
  const container = getEl("contacts-list-items");
  if (!container) return;

  const query = state.contactSearchQuery.toLowerCase();
  const filtered = MEMBERS.filter(m => {
    const customName = (Storage.getMemberCustomName(m.id) || "").toLowerCase();
    const matchSearch = m.name.toLowerCase().includes(query) || 
                        m.fullName.toLowerCase().includes(query) ||
                        customName.includes(query) ||
                        m.generation.toLowerCase().includes(query) ||
                        (m.team && m.team.toLowerCase().includes(query));
    if (!matchSearch) return false;

    if (state.contactActiveFilter === "custom-only") return hasCustomName(m.id);
    if (state.contactActiveFilter === "team-love") return m.team && m.team.toLowerCase().includes("love");
    if (state.contactActiveFilter === "team-dream") return m.team && m.team.toLowerCase().includes("dream");
    if (state.contactActiveFilter === "team-passion") return m.team && m.team.toLowerCase().includes("passion");
    if (state.contactActiveFilter === "trainee") return m.team && (m.team.toLowerCase().includes("pelatihan") || m.team.toLowerCase().includes("trainee"));
    return true;
  });

  // Sort alphabetically by display name
  filtered.sort((a, b) => {
    const nameA = getMemberDisplayName(a).toLowerCase();
    const nameB = getMemberDisplayName(b).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--ios-text-secondary);">
        <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
        <div style="font-weight: 600; font-size: 16px;">Tidak ada kontak ditemukan</div>
        <div style="font-size: 13px; margin-top: 4px;">Coba gunakan kata kunci pencarian atau filter lain.</div>
      </div>
    `;
    return;
  }

  // Group by first letter
  const grouped = {};
  filtered.forEach(m => {
    const dName = getMemberDisplayName(m);
    const firstLetter = (dName[0] || "#").toUpperCase();
    const key = /[A-Z]/.test(firstLetter) ? firstLetter : "#";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });

  let html = "";
  Object.keys(grouped).sort().forEach(letter => {
    html += `<div class="contact-alphabet-header">${letter} (${grouped[letter].length})</div>`;
    grouped[letter].forEach(member => {
      const displayName = getMemberDisplayName(member);
      const isCustom = hasCustomName(member.id);
      const officialName = member.fullName || member.name;

      html += `
        <div class="contact-item" data-member-id="${member.id}">
          <div class="contact-avatar-wrap">
            ${getAvatarImgHtml(member.avatar, member.name, "contact-avatar")}
          </div>
          <div class="contact-details">
            <div class="contact-name-row">
              <span class="contact-display-name">${displayName}</span>
              ${isCustom ? `<span class="contact-custom-badge">⭐ Kustom</span>` : ''}
              <span class="chat-team-tag ${member.team.toLowerCase().includes('love') ? 'love' : member.team.toLowerCase().includes('dream') ? 'dream' : member.team.toLowerCase().includes('passion') ? 'passion' : 'trainee'}">${member.team}</span>
            </div>
            <div class="contact-sub-info">
              ${isCustom ? `Nama Asli: ${officialName} • ${member.generation}` : `${member.generation} • ${member.status}`}
            </div>
          </div>
          <div class="contact-actions" onclick="event.stopPropagation();">
            <button class="contact-action-btn contact-edit-btn" data-action="edit" data-member-id="${member.id}" title="Ubah Nama Kontak">
              ✏️ Ubah
            </button>
            <button class="contact-action-btn contact-chat-btn" data-action="chat" data-member-id="${member.id}" title="Mulai Chat">
              💬 Chat
            </button>
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = html;

  // Add click listeners to contact items
  container.querySelectorAll(".contact-item").forEach(item => {
    item.addEventListener("click", () => {
      const memberId = item.getAttribute("data-member-id");
      switchTab("chats");
      openChatRoom(memberId);
    });
  });

  container.querySelectorAll(".contact-action-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.getAttribute("data-action");
      const memberId = btn.getAttribute("data-member-id");
      if (action === "chat") {
        switchTab("chats");
        openChatRoom(memberId);
      } else if (action === "edit") {
        openEditContactModal(memberId);
      }
    });
  });
}

// =============================================================================
// STREAK BADGE HELPER
// =============================================================================
function updateChatRoomStreakBadge(member) {
  const chatRoomStreakBadge = getEl("chat-nav-streak");
  if (!chatRoomStreakBadge || !member) return;

  const streakData = Storage.getMemberStreakData(member.id);
  const currentStreak = streakData.count;

  if (currentStreak >= 3) {
    chatRoomStreakBadge.className = "chat-room-streak-flame";
    chatRoomStreakBadge.innerHTML = `🔥 ${currentStreak}`;
    chatRoomStreakBadge.title = `Streak Api Aktif: ${currentStreak} Hari Berturut-turut!`;
  } else if (currentStreak > 0) {
    chatRoomStreakBadge.className = "chat-room-streak-progress";
    chatRoomStreakBadge.innerHTML = `⚡ ${currentStreak}/3 Hari`;
    chatRoomStreakBadge.title = `Streak: ${currentStreak}/3 Hari (Butuh ${3 - currentStreak} hari lagi untuk membuka Api 🔥)`;
  } else {
    chatRoomStreakBadge.className = "chat-room-streak-progress";
    chatRoomStreakBadge.innerHTML = `⚡ 0/3 Hari`;
    chatRoomStreakBadge.title = `Belum ada streak. Chat 3 hari berturut-turut untuk menyalakan Api 🔥`;
  }
}

// =============================================================================
// OPEN & MANAGE CHAT ROOM
// =============================================================================
function openChatRoom(memberId) {
  const member = MEMBERS.find(m => m.id === memberId);
  if (!member) return;

  state.activeMemberId = memberId;
  soundEffects.playTapHaptic();

  const desktopPlaceholder = getEl("desktop-empty-placeholder");
  if (desktopPlaceholder) {
    desktopPlaceholder.style.display = "none";
  }

  // Populate header with custom or official name
  const displayName = getMemberDisplayName(member);
  const chatRoomNavName = getEl("chat-nav-name");
  const chatRoomNavAvatar = getEl("chat-nav-avatar");
  const chatRoomNavStatus = getEl("chat-nav-status");
  const chatRoomPapBadge = getEl("chat-nav-pap");

  if (chatRoomNavName) chatRoomNavName.textContent = displayName;
  if (chatRoomNavAvatar) {
    chatRoomNavAvatar.src = member.avatar;
    chatRoomNavAvatar.onerror = () => {
      chatRoomNavAvatar.src = AVATAR_FALLBACK;
    };
  }
  const currentKey = Storage.getApiKey();
  const currentProvider = Storage.getAiProvider();
  const aiBadge = currentKey ? `✨ ${currentProvider === "gemini" ? "Gemini AI" : "Groq AI"}` : "📱 Mode Offline";
  if (chatRoomNavStatus) {
    chatRoomNavStatus.textContent = member.online ? `Online • ${aiBadge}` : member.lastSeen;
  }
  if (chatRoomPapBadge) chatRoomPapBadge.innerHTML = `📸 PAP ${member.papsRemaining}/4`;

  // Streak calculation & badge display
  updateChatRoomStreakBadge(member);

  renderChatMessages(member);

  const geminiBanner = getEl("chat-gemini-banner");
  if (geminiBanner) {
    geminiBanner.style.display = Storage.getApiKey() ? "none" : "flex";
  }

  const chatRoomScreen = getEl("chat-room-screen");
  if (chatRoomScreen) {
    chatRoomScreen.style.display = "flex";
    chatRoomScreen.classList.remove("closing");
  }

  const messagesArea = getEl("chat-messages-area");
  if (messagesArea) {
    setTimeout(() => {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }, 50);
  }

  renderChatList();
  updateTotalUnreadBadge();
}

function closeChatRoom() {
  if (isDesktopView()) return;
  soundEffects.playTapHaptic();
  const chatRoomScreen = getEl("chat-room-screen");
  if (chatRoomScreen) {
    chatRoomScreen.classList.add("closing");
    setTimeout(() => {
      chatRoomScreen.style.display = "none";
      chatRoomScreen.classList.remove("closing");
      state.activeMemberId = null;
      renderChatList();
    }, 220);
  }
}

// =============================================================================
// RENDER CHAT MESSAGES
// =============================================================================
function renderChatMessages(member) {
  const container = getEl("chat-messages-area");
  if (!container) return;

  let messages = Storage.getChatHistory(member.id);
  const displayName = getMemberDisplayName(member);
  const officialName = member.fullName || member.name;

  if (!messages || messages.length === 0) {
    messages = [
      {
        id: `msg_init_${member.id}`,
        text: member.lastMessage || `Halo! Selamat datang di room chat resmi ${member.name}! ✨ Senang banget bisa chatingan bareng kamu.`,
        isUser: false,
        time: member.lastMessageTime || "10:30",
        date: "HARI INI",
        isPhoto: false
      }
    ];
    Storage.saveChatMessage(member.id, messages[0]);
  }

  const datePill = `<div class="chat-date-pill">HARI INI</div>`;
  const introCard = `
    <div class="idol-intro-card">
      <img class="idol-intro-avatar" src="${member.avatar}" alt="${displayName}" onerror="this.onerror=null;this.src='${AVATAR_FALLBACK}';" />
      <div class="idol-intro-name">${displayName}</div>
      <div style="font-size: 12px; color: var(--ios-text-secondary); margin-bottom: 6px;">
        ${hasCustomName(member.id) ? `Nama Resmi: ${officialName} • ` : ''}${member.generation} • ${member.team}
      </div>
      <div class="idol-intro-quote">"${member.bio}"</div>
      <div class="idol-intro-meta">
        🎂 Lahir: ${member.birthDate} | 🩸 Gol: ${member.bloodType}
      </div>
      <div class="idol-intro-lock">
        🔒 Pesan ini diproses secara real-time melalui Google Gemini / Groq AI
      </div>
    </div>
  `;

  const messagesHtml = messages.map(msg => {
    const isUser = msg.isUser;
    const bubbleClass = isUser ? "chat-bubble outgoing" : "chat-bubble incoming";

    let contentHtml = "";
    if (msg.isPhoto) {
      contentHtml = `
        <div class="chat-bubble-photo-wrap">
          <img class="chat-bubble-photo" src="${msg.photoUrl}" alt="PAP Photo" loading="lazy" />
          <div class="chat-bubble-photo-title">${msg.text || "Foto PAP Spesial 📸"}</div>
        </div>
      `;
    } else {
      contentHtml = `<div class="chat-bubble-text">${escapeHtml(msg.text || "")}</div>`;
    }

    const checkIcon = isUser ? `
      <svg class="chat-check-icon double read" viewBox="0 0 16 15" width="16" height="15" fill="none">
        <path d="M15.01 3.316l-7.96 7.96a1 1 0 01-1.414 0L1.67 7.31a1 1 0 011.414-1.414l3.25 3.25 7.25-7.25a1 1 0 011.414 1.414z" fill="currentColor"/>
        <path d="M11.01 3.316l-7.96 7.96a1 1 0 01-1.414 0L.67 8.31a1 1 0 011.414-1.414l1.65 1.65 7.25-7.25a1 1 0 011.414 1.414z" fill="currentColor"/>
      </svg>
    ` : "";

    return `
      <div class="${bubbleClass}">
        ${contentHtml}
        <div class="chat-bubble-meta">
          <span class="chat-bubble-time">${msg.time}</span>
          ${checkIcon}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = datePill + introCard + messagesHtml;
}

// =============================================================================
// SEND MESSAGE & AI RESPONSE HANDLER
// =============================================================================
async function handleSendMessage() {
  const member = MEMBERS.find(m => m.id === state.activeMemberId);
  const inputEl = getEl("chat-input-text");
  if (!member || !inputEl || state.isTyping) return;

  const text = inputEl.value.trim();
  if (!text) return;

  // Clear input immediately
  inputEl.value = "";
  inputEl.style.height = "auto";

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const userMsg = {
    id: `msg_user_${Date.now()}`,
    text: text,
    isUser: true,
    time: timeStr,
    date: "HARI INI",
    isPhoto: false
  };

  try {
    // 1. Save and render user message immediately to the screen
    Storage.saveChatMessage(member.id, userMsg);
    renderChatMessages(member);

    const msgArea = getEl("chat-messages-area");
    if (msgArea) {
      msgArea.scrollTop = msgArea.scrollHeight;
      requestAnimationFrame(() => {
        msgArea.scrollTop = msgArea.scrollHeight;
      });
    }
    renderChatList();

    // 2. Play send audio effect safely
    try {
      soundEffects.playSendPop();
    } catch (err) {
      console.warn("Sound play error:", err);
    }

    // 3. Streak calculation safely
    try {
      const streakResult = Storage.recordDailyChatStreak(member.id);
      updateChatRoomStreakBadge(member);
      renderChatList();
      if (streakResult && streakResult.justUnlockedFlame) {
        soundEffects.playStreakUnlocked();
        showToast(`Selamat! Kamu dan ${getMemberDisplayName(member)} sudah aktif chatingan 3 hari berturut-turut! Mode Api 🔥 Aktif!`, "🔥");
      }
    } catch (err) {
      console.warn("Streak tracking error:", err);
    }

    // 4. Show Typing Indicator
    state.isTyping = true;
    showTypingIndicator();
    const chatRoomNavStatus = getEl("chat-nav-status");
    if (chatRoomNavStatus) chatRoomNavStatus.textContent = "sedang mengetik...";

    // 5. Query AI Response (Gemini, Groq, or Contextual Idol Persona)
    const apiKey = Storage.getApiKey();
    const modelId = Storage.getSelectedModel();
    const provider = Storage.getAiProvider();
    const chatHistory = Storage.getChatHistory(member.id) || [];
    const userProfile = Storage.getUserProfile();

    const customName = Storage.getMemberCustomName(member.id);
    let effectivePrompt = member.systemPrompt;
    if (customName) {
      effectivePrompt += `\nCatatan Tambahan: Penggemar memanggilmu dengan nama panggilan spesial: "${customName}".`;
    }

    let aiReplyText = "";
    let hasAiError = false;
    try {
      aiReplyText = await AIService.generateIdolResponse(
        text,
        effectivePrompt,
        apiKey,
        modelId,
        chatHistory,
        provider,
        userProfile,
        member
      );
    } catch (aiErr) {
      hasAiError = true;
      console.error("AIService error in handleSendMessage:", aiErr);
      showToast(`⚠️ AI Error: ${aiErr.message}`, "⚠️");
      const rawName = userProfile?.name?.trim() || "";
      const userName = (rawName && rawName.toLowerCase() !== "fans jkt48") ? rawName : "kamu";
      aiReplyText = `Hehe ${userName}, seru banget! Aku suka deh ngobrol sama kamu. Tetap semangat yaa! ✨`;
    }

    // 6. Hide typing indicator before rendering reply
    hideTypingIndicator();
    state.isTyping = false;

    // Restore nav status
    if (chatRoomNavStatus) {
      const curKey = Storage.getApiKey();
      const curProv = Storage.getAiProvider();
      const badge = curKey ? `✨ ${curProv === "gemini" ? "Gemini AI" : "Groq AI"}` : "📱 Mode Offline";
      chatRoomNavStatus.textContent = member.online ? (hasAiError ? "Online • ⚠️ API Gagal" : `Online • ${badge}`) : member.lastSeen;
    }

    // 7. Save and render idol reply
    const replyNow = new Date();
    const replyTimeStr = `${String(replyNow.getHours()).padStart(2, "0")}:${String(replyNow.getMinutes()).padStart(2, "0")}`;

    const idolMsg = {
      id: `msg_idol_${Date.now()}`,
      text: aiReplyText,
      isUser: false,
      time: replyTimeStr,
      date: "HARI INI",
      isPhoto: false
    };

    Storage.saveChatMessage(member.id, idolMsg);

    try {
      soundEffects.playReceiveChime();
    } catch (err) {
      console.warn("Chime error:", err);
    }

    renderChatMessages(member);
    if (msgArea) {
      msgArea.scrollTop = msgArea.scrollHeight;
      requestAnimationFrame(() => {
        msgArea.scrollTop = msgArea.scrollHeight;
      });
    }
    renderChatList();

  } catch (criticalErr) {
    console.error("Critical error in handleSendMessage:", criticalErr);
    hideTypingIndicator();
    state.isTyping = false;
    showToast("Gagal memproses pesan. Silakan coba lagi.", "⚠️");
  } finally {
    hideTypingIndicator();
    state.isTyping = false;
  }
}

// =============================================================================
// PAP PHOTO REQUEST
// =============================================================================
function handleRequestPap() {
  const member = MEMBERS.find(m => m.id === state.activeMemberId);
  if (!member || state.isTyping) return;

  soundEffects.playCameraShutter();
  const randomPhoto = member.photos[Math.floor(Math.random() * member.photos.length)];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const papMsg = {
    id: `msg_pap_${Date.now()}`,
    text: randomPhoto.title || `Foto PAP spesial dari ${getMemberDisplayName(member)} 📸`,
    isUser: false,
    time: timeStr,
    date: "HARI INI",
    isPhoto: true,
    photoUrl: randomPhoto.url
  };

  showToast(`Menerima foto PAP dari ${getMemberDisplayName(member)}! 📸`, "📷");
  Storage.saveChatMessage(member.id, papMsg);
  renderChatMessages(member);
  const msgArea = getEl("chat-messages-area");
  if (msgArea) msgArea.scrollTop = msgArea.scrollHeight;
  renderChatList();
}

// Typing Indicator Helpers
function showTypingIndicator() {
  const existing = document.getElementById("chat-typing-indicator");
  if (existing) return;

  const msgArea = getEl("chat-messages-area");
  if (!msgArea) return;

  const typingEl = document.createElement("div");
  typingEl.id = "chat-typing-indicator";
  typingEl.className = "chat-typing-indicator incoming";
  typingEl.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  msgArea.appendChild(typingEl);
  msgArea.scrollTop = msgArea.scrollHeight;
}

function hideTypingIndicator() {
  const existing = document.getElementById("chat-typing-indicator");
  if (existing) existing.remove();
}

// =============================================================================
// MODAL: EDIT / SIMPAN NAMA KONTAK KUSTOM
// =============================================================================
function openEditContactModal(memberId) {
  const member = MEMBERS.find(m => m.id === memberId);
  if (!member) return;

  state.editingContactMemberId = memberId;
  const currentCustom = Storage.getMemberCustomName(memberId) || "";

  const avatarEl = getEl("edit-contact-avatar");
  const officialNameEl = getEl("edit-contact-official-name");
  const teamBadgeEl = getEl("edit-contact-team-badge");
  const customInputEl = getEl("custom-contact-name-input");
  const suggestionsEl = getEl("edit-contact-suggestions");
  const modalEl = getEl("edit-contact-modal");

  if (avatarEl) {
    avatarEl.src = member.avatar;
    avatarEl.onerror = () => {
      avatarEl.src = AVATAR_FALLBACK;
    };
  }
  if (officialNameEl) officialNameEl.textContent = member.fullName || member.name;
  if (teamBadgeEl) teamBadgeEl.textContent = `${member.team} • ${member.generation}`;
  if (customInputEl) {
    customInputEl.value = currentCustom;
    setTimeout(() => customInputEl.focus(), 100);
  }

  if (suggestionsEl) {
    const chips = suggestionsEl.querySelectorAll(".suggestion-chip");
    chips.forEach(chip => {
      const template = chip.getAttribute("data-template");
      const short = member.shortName || member.name.split(" ")[0];
      const previewName = template.replace("{name}", short);
      chip.textContent = previewName;
      chip.onclick = () => {
        if (customInputEl) customInputEl.value = previewName;
      };
    });
  }

  if (modalEl) {
    modalEl.style.display = "flex";
  }
}

function closeEditContactModal() {
  const modalEl = getEl("edit-contact-modal");
  if (modalEl) {
    modalEl.style.display = "none";
  }
  state.editingContactMemberId = null;
}

function handleSaveCustomName() {
  if (!state.editingContactMemberId) return;
  const member = MEMBERS.find(m => m.id === state.editingContactMemberId);
  if (!member) return;

  const customInputEl = getEl("custom-contact-name-input");
  const customVal = customInputEl?.value?.trim() || "";
  Storage.setMemberCustomName(member.id, customVal);

  showToast(
    customVal ? `Nama kontak tersimpan: "${customVal}"` : `Nama kontak direset ke "${member.name}"`,
    "✅"
  );

  closeEditContactModal();
  renderChatList();
  renderContactsList();

  if (state.activeMemberId === member.id) {
    const navName = getEl("chat-nav-name");
    if (navName) navName.textContent = getMemberDisplayName(member);
    renderChatMessages(member);
  }
}

function handleResetCustomName() {
  if (!state.editingContactMemberId) return;
  const member = MEMBERS.find(m => m.id === state.editingContactMemberId);
  if (!member) return;

  Storage.resetMemberCustomName(member.id);
  const customInputEl = getEl("custom-contact-name-input");
  if (customInputEl) customInputEl.value = "";

  showToast(`Nama kontak dikembalikan ke nama resmi: "${member.name}"`, "🔄");
  closeEditContactModal();
  renderChatList();
  renderContactsList();

  if (state.activeMemberId === member.id) {
    const navName = getEl("chat-nav-name");
    if (navName) navName.textContent = getMemberDisplayName(member);
    renderChatMessages(member);
  }
}

// =============================================================================
// MODAL: INFO PROFIL MEMBER
// =============================================================================
function openMemberInfoModal(memberId) {
  const member = MEMBERS.find(m => m.id === memberId);
  if (!member) return;

  const displayName = getMemberDisplayName(member);
  const officialName = member.fullName || member.name;
  const currentStreak = Storage.getMemberStreak(member.id);

  const avatarEl = getEl("info-modal-avatar");
  const nameEl = getEl("info-modal-display-name");
  const subEl = getEl("info-modal-official-sub");
  const bioEl = getEl("info-modal-bio");
  const teamEl = getEl("info-modal-team");
  const birthEl = getEl("info-modal-birth");
  const streakEl = getEl("info-modal-streak");
  const modalEl = getEl("member-info-modal");

  if (avatarEl) {
    avatarEl.src = member.avatar;
    avatarEl.onerror = () => {
      avatarEl.src = AVATAR_FALLBACK;
    };
  }
  if (nameEl) nameEl.textContent = displayName;
  if (subEl) {
    subEl.textContent = hasCustomName(member.id) 
      ? `Nama Resmi: ${officialName} (${member.shortName})`
      : `Nama Lengkap: ${officialName}`;
  }
  if (bioEl) bioEl.textContent = `"${member.bio}"`;
  if (teamEl) teamEl.textContent = `${member.team} • ${member.generation}`;
  if (birthEl) birthEl.textContent = `${member.birthDate} (Gol. ${member.bloodType})`;
  if (streakEl) {
    if (currentStreak >= 3) {
      streakEl.innerHTML = `🔥 ${currentStreak} Hari Berturut-turut <span style="font-size:11px;color:#f97316;font-weight:700;">(Streak Api Menyala!)</span>`;
    } else if (currentStreak > 0) {
      streakEl.innerHTML = `⚡ ${currentStreak}/3 Hari <span style="font-size:11px;color:var(--ios-text-secondary);">(Butuh ${3 - currentStreak} hari lagi untuk buka Api 🔥)</span>`;
    } else {
      streakEl.innerHTML = `0 Hari <span style="font-size:11px;color:var(--ios-text-secondary);">(Chat 3 hari berturut-turut untuk buka Api 🔥)</span>`;
    }
  }

  const editNameBtn = getEl("info-action-edit-name");
  if (editNameBtn) {
    editNameBtn.onclick = () => {
      closeMemberInfoModal();
      openEditContactModal(member.id);
    };
  }

  const papBtn = getEl("info-action-request-pap");
  if (papBtn) {
    papBtn.onclick = () => {
      closeMemberInfoModal();
      handleRequestPap();
    };
  }

  const clearBtn = getEl("info-action-clear-chat");
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm(`Hapus seluruh riwayat chat dengan ${displayName}?`)) {
        Storage.clearMemberChat(member.id);
        renderChatMessages(member);
        renderChatList();
        closeMemberInfoModal();
        showToast("Riwayat chat member telah dibersihkan", "🗑️");
      }
    };
  }

  if (modalEl) {
    modalEl.style.display = "flex";
  }
}

function closeMemberInfoModal() {
  const modalEl = getEl("member-info-modal");
  if (modalEl) {
    modalEl.style.display = "none";
  }
}

// =============================================================================
// STORIES & STATUS VIEWER
// =============================================================================
function renderUpdatesList() {
  const container = getEl("status-items-list");
  if (!container) return;

  container.innerHTML = STORIES_DATA.map((story) => {
    const member = MEMBERS.find(m => m.id === story.memberId);
    if (!member) return "";
    const displayName = getMemberDisplayName(member);

    return `
      <div class="status-item-card" data-story-id="${story.id}">
        <div class="status-avatar-ring ${story.viewed ? 'viewed' : ''}">
          <img class="status-member-avatar" src="${story.avatar}" alt="${displayName}" loading="lazy" onerror="this.onerror=null;this.src='${AVATAR_FALLBACK}';" />
        </div>
        <div class="status-info-col">
          <div class="status-member-name">${displayName}</div>
          <div class="status-timestamp">${story.time}</div>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".status-item-card").forEach(card => {
    card.addEventListener("click", () => {
      const storyId = card.getAttribute("data-story-id");
      openStoryViewer(storyId);
    });
  });
}

function openStoryViewer(storyId) {
  const story = STORIES_DATA.find(s => s.id === storyId);
  if (!story) return;

  state.activeStory = story;
  state.storyIndex = 0;
  story.viewed = true;

  const member = MEMBERS.find(m => m.id === story.memberId);
  const displayName = member ? getMemberDisplayName(member) : story.name;

  const avatarEl = getEl("story-viewer-avatar");
  const nameEl = getEl("story-viewer-name");
  const timeEl = getEl("story-viewer-time");
  const imgEl = getEl("story-viewer-img");
  const captionEl = getEl("story-viewer-caption");
  const progressWrap = getEl("story-progress-wrap");
  const modalEl = getEl("story-viewer-modal");

  if (avatarEl) avatarEl.src = story.avatar;
  if (nameEl) nameEl.textContent = displayName;
  if (timeEl) timeEl.textContent = story.time;
  if (imgEl) imgEl.src = story.photos[0].url;
  if (captionEl) captionEl.textContent = story.photos[0].caption;

  if (progressWrap) {
    progressWrap.innerHTML = story.photos.map((_, i) => `
      <div class="story-progress-bar">
        <div class="story-progress-fill" id="story-progress-fill-${i}"></div>
      </div>
    `).join("");
  }

  if (modalEl) modalEl.style.display = "flex";
  startStoryProgress();
}

function startStoryProgress() {
  clearInterval(state.storyTimer);
  const story = state.activeStory;
  if (!story) return;

  const fillEl = document.getElementById(`story-progress-fill-${state.storyIndex}`);
  if (fillEl) fillEl.style.width = "0%";

  let width = 0;
  state.storyTimer = setInterval(() => {
    width += 2;
    if (fillEl) fillEl.style.width = `${width}%`;

    if (width >= 100) {
      clearInterval(state.storyTimer);
      state.storyIndex++;
      if (state.storyIndex < story.photos.length) {
        const imgEl = getEl("story-viewer-img");
        const captionEl = getEl("story-viewer-caption");
        if (imgEl) imgEl.src = story.photos[state.storyIndex].url;
        if (captionEl) captionEl.textContent = story.photos[state.storyIndex].caption;
        startStoryProgress();
      } else {
        closeStoryViewer();
      }
    }
  }, 100);
}

function closeStoryViewer() {
  clearInterval(state.storyTimer);
  const modalEl = getEl("story-viewer-modal");
  if (modalEl) modalEl.style.display = "none";
  state.activeStory = null;
  renderUpdatesList();
}

// =============================================================================
// SETTINGS & AI CONFIGURATION
// =============================================================================
function renderSettingsForm() {
  const provider = Storage.getAiProvider();
  const apiKey = Storage.getApiKey();
  const currentModel = Storage.getSelectedModel();
  const profile = Storage.getUserProfile();

  const providerSelect = getEl("ai-provider-select");
  if (providerSelect) providerSelect.value = provider;

  const keyInput = getEl("groq-api-key-input");
  if (keyInput) keyInput.value = apiKey;

  updateModelsDropdown(provider);

  const modelSelect = getEl("groq-model-select");
  if (modelSelect) modelSelect.value = currentModel;

  const nameInput = getEl("profile-name-input");
  if (nameInput) nameInput.value = profile.name || "Fans JKT48";

  const genderSelect = getEl("profile-gender-select");
  if (genderSelect) genderSelect.value = profile.gender || "Belum disetel";

  const statusInput = getEl("profile-status-input");
  if (statusInput) statusInput.value = profile.status || "";

  const cityInput = getEl("profile-city-input");
  if (cityInput) cityInput.value = profile.city || "Jakarta";

  const desktopProfileName = getEl("desktop-profile-name");
  if (desktopProfileName) {
    desktopProfileName.textContent = profile.name || "Fans JKT48";
  }

  const testResultEl = getEl("test-connection-result");
  if (testResultEl) {
    if (apiKey) {
      const masked = apiKey.length > 8 ? `${apiKey.slice(0, 5)}...${apiKey.slice(-4)}` : "tersimpan";
      testResultEl.innerHTML = `<span style="color: #2563EB;">🔑 Key ${provider === "gemini" ? "Gemini" : "Groq"} (${masked}) tersimpan. Klik <strong>⚡ Tes Koneksi</strong> untuk cek server.</span>`;
    } else {
      testResultEl.innerHTML = `<span style="color: var(--ios-text-secondary);">⚪ Mode Offline aktif. Masukkan API Key lalu klik <strong>Simpan & Aktifkan</strong>.</span>`;
    }
  }
}

function updateModelsDropdown(provider) {
  const select = getEl("groq-model-select");
  if (!select) return;

  const filtered = AI_MODELS.filter(m => m.provider === provider);
  select.innerHTML = filtered.map(m => `
    <option value="${m.id}">${m.name} (${m.description})</option>
  `).join("");
}

// =============================================================================
// SETUP EVENT LISTENERS
// =============================================================================
function setupEventListeners() {
  // Mobile tab switching
  getEl("tab-chats-btn")?.addEventListener("click", () => switchTab("chats"));
  getEl("tab-updates-btn")?.addEventListener("click", () => switchTab("updates"));
  getEl("tab-settings-btn")?.addEventListener("click", () => switchTab("settings"));

  // Desktop sidebar action buttons
  getEl("desktop-chats-btn")?.addEventListener("click", () => switchTab("chats"));
  getEl("desktop-contacts-btn")?.addEventListener("click", () => switchTab("contacts"));
  getEl("desktop-status-btn")?.addEventListener("click", () => switchTab("updates"));
  getEl("desktop-settings-btn")?.addEventListener("click", () => switchTab("settings"));

  // Nav buttons for Contacts
  getEl("chats-contacts-btn")?.addEventListener("click", () => switchTab("contacts"));
  getEl("chats-new-chat-btn")?.addEventListener("click", () => switchTab("contacts"));
  getEl("back-to-chats-from-contacts")?.addEventListener("click", () => switchTab("chats"));

  // Back to chats from other sub-screens
  getEl("back-to-chats-from-settings")?.addEventListener("click", () => switchTab("chats"));
  getEl("back-to-chats-from-updates")?.addEventListener("click", () => switchTab("chats"));

  // AI Provider change listener
  getEl("ai-provider-select")?.addEventListener("change", (e) => {
    const provider = e.target.value;
    updateModelsDropdown(provider);
    const keyLabel = getEl("api-key-label");
    const keySubtext = getEl("api-key-subtext");
    const tutorialTitle = getEl("tutorial-title");
    const tutorialGemini = getEl("tutorial-gemini-content");
    const tutorialGroq = getEl("tutorial-groq-content");

    if (provider === "gemini") {
      if (keyLabel) keyLabel.textContent = "Google Gemini API Key";
      if (keySubtext) keySubtext.textContent = "Dapatkan di Google AI Studio (aistudio.google.com)";
      if (tutorialTitle) tutorialTitle.textContent = "Cara Dapatkan Google Gemini API Key (Gratis):";
      if (tutorialGemini) tutorialGemini.style.display = "block";
      if (tutorialGroq) tutorialGroq.style.display = "none";
    } else {
      if (keyLabel) keyLabel.textContent = "Groq Cloud API Key";
      if (keySubtext) keySubtext.textContent = "Dapatkan di console.groq.com/keys";
      if (tutorialTitle) tutorialTitle.textContent = "Cara Dapatkan Groq API Key (Gratis):";
      if (tutorialGemini) tutorialGemini.style.display = "none";
      if (tutorialGroq) tutorialGroq.style.display = "block";
    }
  });

  // Auto-detect key format
  getEl("groq-api-key-input")?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    const providerSelect = getEl("ai-provider-select");
    if (val.startsWith("AIza") && providerSelect && providerSelect.value !== "gemini") {
      providerSelect.value = "gemini";
      updateModelsDropdown("gemini");
    } else if (val.startsWith("gsk_") && providerSelect && providerSelect.value !== "groq") {
      providerSelect.value = "groq";
      updateModelsDropdown("groq");
    }
  });

  // Theme toggle
  getEl("theme-toggle-btn")?.addEventListener("click", toggleTheme);

  // Search input on Chats
  getEl("chat-search-input")?.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderChatList();
  });

  // Search input on Contacts
  getEl("contact-search-input")?.addEventListener("input", (e) => {
    state.contactSearchQuery = e.target.value;
    renderContactsList();
  });

  // Filter tags on Chats
  getEl("filter-tags-wrap")?.querySelectorAll(".filter-tag-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      getEl("filter-tags-wrap").querySelectorAll(".filter-tag-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.activeFilter = pill.getAttribute("data-filter");
      renderChatList();
    });
  });

  // Filter tags on Contacts
  getEl("contacts-filter-tags-wrap")?.querySelectorAll(".filter-tag-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      getEl("contacts-filter-tags-wrap").querySelectorAll(".filter-tag-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.contactActiveFilter = pill.getAttribute("data-filter");
      renderContactsList();
    });
  });

  // Chat room navigation & header click for member info
  getEl("chat-back-btn")?.addEventListener("click", closeChatRoom);
  getEl("chat-header-profile-click")?.addEventListener("click", () => {
    if (state.activeMemberId) {
      openMemberInfoModal(state.activeMemberId);
    }
  });

  // Edit Contact Modal Controls
  getEl("close-edit-contact-modal")?.addEventListener("click", closeEditContactModal);
  getEl("save-contact-name-btn")?.addEventListener("click", handleSaveCustomName);
  getEl("reset-contact-name-btn")?.addEventListener("click", handleResetCustomName);
  getEl("clear-custom-name-input")?.addEventListener("click", () => {
    const input = getEl("custom-contact-name-input");
    if (input) input.value = "";
  });

  // Member Info Modal Controls
  getEl("close-member-info-modal")?.addEventListener("click", closeMemberInfoModal);

  // Message Send Controls
  getEl("chat-send-btn")?.addEventListener("click", handleSendMessage);
  getEl("chat-input-text")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Auto expand textarea
  getEl("chat-input-text")?.addEventListener("input", (e) => {
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  });

  // PAP Badge click
  getEl("chat-nav-pap")?.addEventListener("click", handleRequestPap);
  getEl("chat-camera-btn")?.addEventListener("click", handleRequestPap);

  // Story close & reply
  getEl("story-close-btn")?.addEventListener("click", closeStoryViewer);
  getEl("story-reply-send-btn")?.addEventListener("click", () => {
    const input = getEl("story-reply-input");
    if (input && input.value.trim() && state.activeStory) {
      const memberId = state.activeStory.memberId;
      const text = `Membalas Status: "${input.value.trim()}"`;
      closeStoryViewer();
      openChatRoom(memberId);
      setTimeout(() => {
        const chatInput = getEl("chat-input-text");
        if (chatInput) {
          chatInput.value = text;
          handleSendMessage();
        }
      }, 300);
    }
  });

  // Live auto-save & auto-detection when user types/pastes API Key
  let keyTestDebounce = null;
  getEl("groq-api-key-input")?.addEventListener("input", (e) => {
    const rawVal = e.target.value || "";
    const cleanKey = rawVal.trim().replace(/^["']|["']$/g, "");
    
    // Auto-detect provider if key format is clear
    const providerSelect = getEl("ai-provider-select");
    if ((cleanKey.startsWith("AIza") || cleanKey.startsWith("AQ.")) && providerSelect && providerSelect.value !== "gemini") {
      providerSelect.value = "gemini";
      Storage.setAiProvider("gemini");
      updateModelsDropdown("gemini");
    } else if (cleanKey.startsWith("gsk_") && providerSelect && providerSelect.value !== "groq") {
      providerSelect.value = "groq";
      Storage.setAiProvider("groq");
      updateModelsDropdown("groq");
    }

    // Auto-save key immediately
    Storage.setApiKey(cleanKey);

    // Update banner
    const geminiBanner = getEl("chat-gemini-banner");
    if (geminiBanner) {
      geminiBanner.style.display = cleanKey ? "none" : "flex";
    }

    const testResultEl = getEl("test-connection-result");
    if (!cleanKey) {
      if (testResultEl) {
        testResultEl.innerHTML = `<span style="color: var(--ios-text-secondary);">⚪ Mode offline aktif (tanpa key).</span>`;
      }
      return;
    }

    if (testResultEl) {
      testResultEl.innerHTML = `<span style="color: #2563EB;">💾 Kunci tersimpan otomatis. Menguji koneksi...</span>`;
    }

    // Debounce 700ms to test connection automatically
    clearTimeout(keyTestDebounce);
    keyTestDebounce = setTimeout(async () => {
      const provider = providerSelect?.value || "gemini";
      const model = getEl("groq-model-select")?.value;
      const res = await AIService.testConnection(cleanKey, model, provider);
      if (testResultEl) {
        testResultEl.textContent = res.message;
        testResultEl.style.color = res.success ? "#16A34A" : "#DC2626";
      }
      if (res.success) {
        showToast(`✅ ${res.message}`, "✨");
      }
    }, 700);
  });

  // Auto-save provider change
  getEl("ai-provider-select")?.addEventListener("change", (e) => {
    const newProv = e.target.value;
    Storage.setAiProvider(newProv);
    updateModelsDropdown(newProv);
    const modelSelect = getEl("groq-model-select");
    if (modelSelect && modelSelect.value) {
      Storage.setSelectedModel(modelSelect.value);
    }
  });

  // Auto-save model change
  getEl("groq-model-select")?.addEventListener("change", (e) => {
    Storage.setSelectedModel(e.target.value);
  });

  // Settings Save & Test
  getEl("test-connection-btn")?.addEventListener("click", async () => {
    const provider = getEl("ai-provider-select")?.value || "gemini";
    const rawVal = getEl("groq-api-key-input")?.value || "";
    const apiKey = rawVal.trim().replace(/^["']|["']$/g, "");
    const model = getEl("groq-model-select")?.value;
    const testResultEl = getEl("test-connection-result");

    if (testResultEl) {
      testResultEl.textContent = `Menguji koneksi ke ${provider === "gemini" ? "Google Gemini AI" : "Groq Cloud AI"}...`;
      testResultEl.style.color = "var(--ios-blue)";
    }

    const res = await AIService.testConnection(apiKey, model, provider);
    if (testResultEl) {
      testResultEl.textContent = res.message;
      testResultEl.style.color = res.success ? "#16A34A" : "#DC2626";
    }
    if (res.success) {
      showToast(res.message, "✅");
    } else {
      showToast(res.message, "⚠️");
    }
  });

  getEl("save-settings-btn")?.addEventListener("click", async () => {
    const provider = getEl("ai-provider-select")?.value || "gemini";
    const apiKey = (getEl("groq-api-key-input")?.value || "").trim().replace(/^["']|["']$/g, "");
    const model = getEl("groq-model-select")?.value;
    const name = getEl("profile-name-input")?.value || "Fans JKT48";
    const gender = getEl("profile-gender-select")?.value || "Belum disetel";
    const status = getEl("profile-status-input")?.value || "";
    const city = getEl("profile-city-input")?.value || "Jakarta";
    const testResultEl = getEl("test-connection-result");
    const saveBtn = getEl("save-settings-btn");

    Storage.setAiProvider(provider);
    Storage.setApiKey(apiKey);
    Storage.setSelectedModel(model);
    Storage.setUserProfile({ name, gender, status, city });

    const desktopProfileName = getEl("desktop-profile-name");
    if (desktopProfileName) {
      desktopProfileName.textContent = name;
    }

    const geminiBanner = getEl("chat-gemini-banner");
    if (geminiBanner) {
      geminiBanner.style.display = Storage.getApiKey() ? "none" : "flex";
    }

    if (apiKey) {
      if (testResultEl) {
        testResultEl.textContent = `Menguji koneksi ke ${provider === "gemini" ? "Google Gemini AI" : "Groq Cloud"}...`;
        testResultEl.style.color = "var(--ios-blue)";
      }
      if (saveBtn) saveBtn.textContent = "Menguji...";

      const res = await AIService.testConnection(apiKey, model, provider);

      if (saveBtn) saveBtn.textContent = "Simpan & Aktifkan";

      if (testResultEl) {
        testResultEl.textContent = res.message;
        testResultEl.style.color = res.success ? "#16A34A" : "#DC2626";
      }

      if (res.success) {
        showToast("Google Gemini AI Berhasil Terhubung & Aktif! ✨", "✅");
      } else {
        showToast(`Kunci tersimpan, tapi Google menolak: ${res.message}`, "⚠️");
      }
    } else {
      if (testResultEl) {
        testResultEl.textContent = "Mode offline aktif (tanpa API Key).";
        testResultEl.style.color = "var(--ios-text-secondary)";
      }
      showToast("Profil disimpan (Mode Simulasi Offline).", "✅");
    }
  });

  // Gemini Setup Banner button
  getEl("btn-setup-gemini")?.addEventListener("click", () => {
    switchTab("settings");
    setTimeout(() => {
      const keyInput = getEl("groq-api-key-input");
      if (keyInput) {
        keyInput.scrollIntoView({ behavior: "smooth", block: "center" });
        keyInput.focus();
      }
    }, 150);
  });

  getEl("clear-all-chats-btn")?.addEventListener("click", () => {
    if (confirm("Apakah Anda yakin ingin menghapus semua riwayat chat dengan idol?")) {
      Storage.clearAllChats();
      renderChatList();
      updateTotalUnreadBadge();
      showToast("Semua riwayat chat telah dibersihkan", "🗑️");
    }
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    if (isDesktopView() && !state.activeMemberId) {
      openChatRoom("freya");
    }
  });
}

// =============================================================================
// SWITCH TAB / VIEW
// =============================================================================
function switchTab(tabName) {
  state.currentTab = tabName;
  soundEffects.playTapHaptic();

  [
    getEl("tab-chats-btn"),
    getEl("tab-updates-btn"),
    getEl("tab-settings-btn"),
    getEl("desktop-chats-btn"),
    getEl("desktop-contacts-btn"),
    getEl("desktop-status-btn"),
    getEl("desktop-settings-btn")
  ].forEach(b => b?.classList.remove("active"));
  
  const views = [
    getEl("view-chats"),
    getEl("view-contacts"),
    getEl("view-updates"),
    getEl("view-settings")
  ];
  
  views.forEach(v => {
    if (v) v.style.display = "none";
  });

  if (tabName === "chats") {
    getEl("tab-chats-btn")?.classList.add("active");
    getEl("desktop-chats-btn")?.classList.add("active");
    const v = getEl("view-chats");
    if (v) v.style.display = "flex";
    renderChatList();
  } else if (tabName === "contacts") {
    getEl("desktop-contacts-btn")?.classList.add("active");
    const v = getEl("view-contacts");
    if (v) v.style.display = "flex";
    renderContactsList();
  } else if (tabName === "updates") {
    getEl("tab-updates-btn")?.classList.add("active");
    getEl("desktop-status-btn")?.classList.add("active");
    const v = getEl("view-updates");
    if (v) v.style.display = "flex";
    renderUpdatesList();
  } else if (tabName === "settings") {
    getEl("tab-settings-btn")?.classList.add("active");
    getEl("desktop-settings-btn")?.classList.add("active");
    const v = getEl("view-settings");
    if (v) v.style.display = "flex";
    renderSettingsForm();
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", initApp);
