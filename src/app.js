import { MEMBERS } from "./data/members.js?v=20260930_v5";
import { STORIES_DATA } from "./data/stories.js?v=20260930_v5";
import { AI_MODELS } from "./data/models.js?v=20260930_v5";
import { Storage } from "./services/storage.js?v=20260930_v5";
import { AIService, limitEmojis } from "./services/aiService.js?v=20260930_v5";
import { soundEffects } from "./services/soundEffects.js?v=20260930_v5";
import { PapService } from "./services/papService.js?v=20260930_v5";

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
const AVATAR_FALLBACK = "assets/pm-logo.jpg";

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
    const activeChatIds = Storage.getActiveChatIds();
    if (activeChatIds.length > 0) {
      openChatRoom(activeChatIds[0]);
    } else {
      const desktopPlaceholder = getEl("desktop-empty-placeholder");
      if (desktopPlaceholder) desktopPlaceholder.style.display = "flex";
      const chatRoomScreen = getEl("chat-room-screen");
      if (chatRoomScreen) chatRoomScreen.style.display = "none";
    }
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
  const cleanMsg = (message || "").replace(/^[⚠️✅🗑️📸🔄🔥✨❌💡\s]+/, "");
  toast.innerHTML = `<span>${icon}</span><span>${cleanMsg}</span>`;
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
  const activeChatIds = (Storage && typeof Storage.getActiveChatIds === "function") 
    ? Storage.getActiveChatIds() 
    : [];
  activeChatIds.forEach(id => {
    const m = MEMBERS.find(member => member.id === id);
    if (!m) return;
    const history = Storage.getChatHistory(m.id);
    if (history === null) {
      total += (m.unreadCount || 0);
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

  const activeChatIds = (Storage && typeof Storage.getActiveChatIds === "function") 
    ? Storage.getActiveChatIds() 
    : [];
  const chatFilterAllPill = getEl("chat-filter-all");
  if (chatFilterAllPill) {
    chatFilterAllPill.textContent = activeChatIds.length > 0 ? `Semua (${activeChatIds.length})` : "Semua";
  }

  // If no active chats have been started yet, show an inviting empty state
  if (activeChatIds.length === 0) {
    container.innerHTML = `
      <div class="empty-chats-state">
        <div class="empty-chats-icon-wrap">💬</div>
        <div class="empty-chats-title">Belum Ada Obrolan</div>
        <div class="empty-chats-desc">
          Pilih member oshi kamu di <strong>Kontak Member</strong> untuk mulai mengirim dan menerima Private Message personal!
        </div>
        <button class="empty-chats-cta-btn" id="empty-goto-contacts-btn">
          <span>👥</span>
          <span>Pilih Member di Kontak (${MEMBERS.length})</span>
        </button>
      </div>
    `;

    getEl("empty-goto-contacts-btn")?.addEventListener("click", () => {
      switchTab("contacts");
    });
    return;
  }

  // Get members matching active chats
  const activeMembers = activeChatIds
    .map(id => MEMBERS.find(m => m.id === id))
    .filter(Boolean);

  const query = state.searchQuery.toLowerCase();
  const filtered = activeMembers.filter(m => {
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
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
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
  if (Storage && typeof Storage.addActiveChat === "function") {
    Storage.addActiveChat(memberId);
  }
  soundEffects.playTapHaptic();

  // Instantly toggle screens: hide empty placeholder, show chat room
  const desktopPlaceholder = getEl("desktop-empty-placeholder");
  if (desktopPlaceholder) {
    desktopPlaceholder.style.display = "none";
  }

  const chatRoomScreen = getEl("chat-room-screen");
  if (chatRoomScreen) {
    chatRoomScreen.style.display = "flex";
    chatRoomScreen.classList.remove("closing");
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
  if (chatRoomPapBadge) {
    const photoCount = PapService.getPhotoCount(member.id);
    chatRoomPapBadge.innerHTML = photoCount > 0 ? `📸 PAP (${photoCount})` : `📸 PAP`;
  }

  // Streak calculation & badge display
  updateChatRoomStreakBadge(member);

  try {
    renderChatMessages(member);
  } catch (err) {
    console.error("Error rendering messages:", err);
  }

  const geminiBanner = getEl("chat-gemini-banner");
  if (geminiBanner) {
    geminiBanner.style.display = Storage.getApiKey() ? "none" : "flex";
  }

  const messagesArea = getEl("chat-messages-area");
  if (messagesArea) {
    setTimeout(() => {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }, 50);
  }

  renderChatList();
  updateTotalUnreadBadge();

  // Jadwalkan idle follow-up jika pesan terakhir adalah dari member dan belum dibalas
  const currentChatHist = Storage.getChatHistory(memberId) || [];
  if (currentChatHist.length > 0) {
    const last = currentChatHist[currentChatHist.length - 1];
    if (!last.isUser && !last.isIdleFollowUp) {
      scheduleIdleFollowUp(memberId, 25000);
    }
  }
}

function closeChatRoom(forceCloseDesktop = false) {
  if (isDesktopView() && !forceCloseDesktop) return;
  soundEffects.playTapHaptic();

  // Blur any focused input in the chat
  const activeEl = document.activeElement;
  if (activeEl && typeof activeEl.blur === "function") {
    activeEl.blur();
  }

  state.activeMemberId = null;

  const chatRoomScreen = getEl("chat-room-screen");
  if (chatRoomScreen) {
    chatRoomScreen.style.display = "none";
    chatRoomScreen.classList.remove("closing");
  }

  if (isDesktopView()) {
    const desktopPlaceholder = getEl("desktop-empty-placeholder");
    if (desktopPlaceholder) {
      desktopPlaceholder.style.display = "flex";
    }
  }

  renderChatList();
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
        text: member.lastMessage || `Halo! Selamat datang di room chat resmi ${member.name}! Senang banget bisa chatingan bareng kamu.`,
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

  const memberFallbackAvatar = (member && member.avatar) ? member.avatar : AVATAR_FALLBACK;

  const messagesHtml = messages.map(msg => {
    const isUser = msg.isUser;
    const bubbleClass = isUser ? "chat-bubble outgoing" : "chat-bubble incoming";

    let contentHtml = "";
    if (msg.isPhoto) {
      const rawUrl = msg.photoUrl || "";
      const safePhotoUrl = encodeURI(decodeURI(rawUrl));
      contentHtml = `
        <div class="chat-bubble-photo-wrap" data-photo-url="${escapeHtml(safePhotoUrl)}" data-photo-title="${escapeHtml(msg.text || 'Foto PAP Spesial 📸')}" data-photo-time="${escapeHtml(msg.time || '')}" title="Klik untuk memperbesar foto 📸">
          <div class="photo-placeholder-shimmer"></div>
          <img class="chat-bubble-photo" src="${escapeHtml(safePhotoUrl)}" alt="PAP Photo" loading="lazy" onload="this.style.opacity='1'; const sh=this.previousElementSibling; if(sh) sh.style.display='none'; const a=document.getElementById('chat-messages-area'); if(a) a.scrollTo({ top: a.scrollHeight, behavior: 'smooth' });" onerror="this.onerror=null; this.src='${escapeHtml(memberFallbackAvatar)}'; const sh=this.previousElementSibling; if(sh) sh.style.display='none'; this.style.opacity='1';" style="opacity: 0;" />
          <div class="chat-bubble-photo-title">${escapeHtml(msg.text || "Foto PAP Spesial 📸")}</div>
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

  // 0. Batalkan timer idle follow-up yang sedang berjalan untuk member ini
  clearIdleFollowUp(member.id);

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

    // 4. Deteksi apakah pesan meminta PAP atau foto member
    const isPap = PapService.isPapRequest(text);

    // 5. Show Typing Indicator
    state.isTyping = true;
    showTypingIndicator();
    const chatRoomNavStatus = getEl("chat-nav-status");
    if (chatRoomNavStatus) {
      chatRoomNavStatus.textContent = isPap ? "sedang menyiapkan foto..." : "sedang mengetik...";
    }

    // 6. Query AI Response (Gemini, Groq, or Contextual Idol Persona)
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
        member,
        { isPap }
      );
    } catch (aiErr) {
      hasAiError = true;
      console.error("AIService error in handleSendMessage:", aiErr);
      showToast(`⚠️ AI Error: ${aiErr.message}`, "⚠️");
      const rawName = userProfile?.name?.trim() || "";
      const userName = (rawName && rawName.toLowerCase() !== "fans jkt48") ? rawName : "kamu";
      aiReplyText = isPap
        ? `Nih fotoku khusus buat ${userName}! Disimpan yaa hehe.`
        : `Hehe ${userName}, seru banget! Seneng deh bisa ngobrol gini.`;
    }

    // 7. Hide typing indicator before rendering reply
    hideTypingIndicator();
    state.isTyping = false;

    // Restore nav status
    if (chatRoomNavStatus) {
      const curKey = Storage.getApiKey();
      const curProv = Storage.getAiProvider();
      const badge = curKey ? `✨ ${curProv === "gemini" ? "Gemini AI" : "Groq AI"}` : "📱 Mode Offline";
      chatRoomNavStatus.textContent = member.online ? (hasAiError ? "Online • ⚠️ API Gagal" : `Online • ${badge}`) : member.lastSeen;
    }

    // 8. Save and render idol reply with photo or text
    const replyNow = new Date();
    const replyTimeStr = `${String(replyNow.getHours()).padStart(2, "0")}:${String(replyNow.getMinutes()).padStart(2, "0")}`;

    const cleanedReplyText = limitEmojis(aiReplyText, 1, { chatHistory });

    let idolMsg;
    if (isPap) {
      const photoUrl = PapService.getRandomPhoto(member);
      idolMsg = {
        id: `msg_pap_${Date.now()}`,
        text: cleanedReplyText,
        isUser: false,
        time: replyTimeStr,
        date: "HARI INI",
        isPhoto: true,
        photoUrl: photoUrl
      };
    } else {
      idolMsg = {
        id: `msg_idol_${Date.now()}`,
        text: cleanedReplyText,
        isUser: false,
        time: replyTimeStr,
        date: "HARI INI",
        isPhoto: false
      };
    }

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

    // 9. Jadwalkan follow-up idle jika user tidak kunjung membalas chat member
    scheduleIdleFollowUp(member.id);

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
  handleSendMessage("pap dong");
}

// =============================================================================
// IDLE FOLLOW-UP CHAT SERVICE (Saat user tiba-tiba diam / ditinggal chatan)
// =============================================================================
const idleFollowUpTimers = new Map();

function clearIdleFollowUp(memberId) {
  if (!memberId) return;
  const id = String(memberId).toLowerCase();
  if (idleFollowUpTimers.has(id)) {
    clearTimeout(idleFollowUpTimers.get(id));
    idleFollowUpTimers.delete(id);
  }
}

function scheduleIdleFollowUp(memberId, customDelayMs = null) {
  if (!memberId) return;
  clearIdleFollowUp(memberId);

  // Waktu jeda idle alami & responsif: 20 - 35 detik (mudah diuji dan sangat pas saat chatan ditinggal)
  const delayMs = customDelayMs !== null ? customDelayMs : (20000 + Math.floor(Math.random() * 15000));

  const timer = setTimeout(async () => {
    idleFollowUpTimers.delete(memberId);

    const history = Storage.getChatHistory(memberId) || [];
    if (history.length === 0) return;

    // Pastikan pesan terakhir BUKAN dari user (user belum membalas pesan idol)
    const lastMsg = history[history.length - 1];
    if (lastMsg.isUser) return;

    // Hindari mengirimkan follow-up berulang kali jika user belum membalas
    if (lastMsg.isIdleFollowUp) return;

    const member = MEMBERS.find(m => m.id === memberId || m.id.toLowerCase() === String(memberId).toLowerCase());
    if (!member) return;

    await triggerMemberIdleFollowUp(member);
  }, delayMs);

  idleFollowUpTimers.set(memberId, timer);
}

async function triggerMemberIdleFollowUp(member) {
  if (!member) return;
  const isCurrentlyInRoom = (state.activeMemberId === member.id);

  if (isCurrentlyInRoom) {
    state.isTyping = true;
    showTypingIndicator();
    const chatRoomNavStatus = getEl("chat-nav-status");
    if (chatRoomNavStatus) chatRoomNavStatus.textContent = "sedang mengetik...";
    // Jeda mengetik 1.5 detik yang realistis
    await new Promise(r => setTimeout(r, 1500));
  }

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

  let followUpText = "";
  try {
    followUpText = await AIService.generateIdolResponse(
      "",
      effectivePrompt,
      apiKey,
      modelId,
      chatHistory,
      provider,
      userProfile,
      member,
      { isIdleFollowUp: true }
    );
  } catch (err) {
    console.warn("Idle follow-up AI error:", err);
    const offline = await AIService._simulateOfflineResponse(member, "", userProfile, chatHistory, { isIdleFollowUp: true });
    followUpText = offline.text;
  }

  if (isCurrentlyInRoom) {
    hideTypingIndicator();
    state.isTyping = false;
    const chatRoomNavStatus = getEl("chat-nav-status");
    if (chatRoomNavStatus) {
      const curKey = Storage.getApiKey();
      const curProv = Storage.getAiProvider();
      const badge = curKey ? `✨ ${curProv === "gemini" ? "Gemini AI" : "Groq AI"}` : "📱 Mode Offline";
      chatRoomNavStatus.textContent = member.online ? `Online • ${badge}` : member.lastSeen;
    }
  }

  const replyNow = new Date();
  const replyTimeStr = `${String(replyNow.getHours()).padStart(2, "0")}:${String(replyNow.getMinutes()).padStart(2, "0")}`;
  const cleanedReplyText = limitEmojis(followUpText, 1, { chatHistory });

  const idolMsg = {
    id: `msg_idle_${Date.now()}`,
    text: cleanedReplyText,
    isUser: false,
    time: replyTimeStr,
    date: "HARI INI",
    isPhoto: false,
    isIdleFollowUp: true
  };

  Storage.saveChatMessage(member.id, idolMsg);

  try {
    soundEffects.playReceiveChime();
  } catch (err) {
    console.warn("Chime error:", err);
  }

  renderChatList();

  if (isCurrentlyInRoom) {
    renderChatMessages(member);
    const msgArea = getEl("chat-messages-area");
    if (msgArea) {
      msgArea.scrollTop = msgArea.scrollHeight;
      requestAnimationFrame(() => {
        msgArea.scrollTop = msgArea.scrollHeight;
      });
    }
  } else {
    showNotificationBanner(member, cleanedReplyText);
  }
}

// In-app push notification banner when a message arrives while outside the chat
function showNotificationBanner(member, text) {
  const existing = document.querySelector(".wa-push-banner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.className = "wa-push-banner";
  const memberName = getMemberDisplayName(member);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  banner.innerHTML = `
    <img src="${member.avatar || AVATAR_FALLBACK}" alt="${memberName}" class="wa-push-avatar" onerror="this.src='${AVATAR_FALLBACK}'" />
    <div class="wa-push-content">
      <div class="wa-push-header">
        <span class="wa-push-title">${memberName}</span>
        <span class="wa-push-time">${timeStr}</span>
      </div>
      <span class="wa-push-text">${text}</span>
    </div>
  `;

  banner.addEventListener("click", () => {
    banner.classList.add("hiding");
    setTimeout(() => banner.remove(), 250);
    openChatRoom(member.id);
  });

  document.body.appendChild(banner);

  setTimeout(() => {
    if (banner.parentElement) {
      banner.classList.add("hiding");
      setTimeout(() => banner.remove(), 250);
    }
  }, 6500);
}

// Window helper to test idle chat directly
window.triggerMemberIdleChat = (memberId) => {
  const targetId = memberId || state.activeMemberId || "gita";
  const member = MEMBERS.find(m => m.id === targetId || m.id.toLowerCase() === String(targetId).toLowerCase()) || MEMBERS[0];
  if (member) {
    triggerMemberIdleFollowUp(member);
  }
};

// Typing Indicator Helpers
function showTypingIndicator() {
  const existing = document.getElementById("chat-typing-indicator");
  if (existing) return;

  const msgArea = getEl("chat-messages-area");
  if (!msgArea) return;

  const typingEl = document.createElement("div");
  typingEl.id = "chat-typing-indicator";
  typingEl.className = "chat-typing-indicator typing-bubble incoming";
  typingEl.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  msgArea.appendChild(typingEl);
  msgArea.scrollTo({ top: msgArea.scrollHeight, behavior: "smooth" });
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
  if (birthEl) {
    const yearMatch = String(member.birthDate || "").match(/\b(\d{4})\b/);
    const memberAge = yearMatch ? new Date().getFullYear() - parseInt(yearMatch[1], 10) : null;
    const ageText = memberAge ? ` (${memberAge} tahun)` : "";
    birthEl.textContent = `${member.birthDate}${ageText} (Gol. ${member.bloodType})`;
  }
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
        Storage.removeActiveChat(member.id);
        closeMemberInfoModal();
        closeChatRoom(true);
        renderChatList();
        updateTotalUnreadBadge();
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
// PHOTO LIGHTBOX MODAL
// =============================================================================
function openPhotoLightbox(photoUrl, caption, memberName, timeStr) {
  const modalEl = getEl("photo-lightbox-modal");
  const imgEl = getEl("photo-lightbox-img");
  const captionEl = getEl("photo-lightbox-caption");
  const senderEl = getEl("photo-lightbox-sender");
  const timeEl = getEl("photo-lightbox-time");
  const downloadBtn = getEl("photo-lightbox-download-btn");

  if (!modalEl || !imgEl) return;

  const member = MEMBERS.find(m => m.id === state.activeMemberId);
  const fallback = (member && member.avatar) ? member.avatar : AVATAR_FALLBACK;
  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.src = fallback;
  };
  const safeUrl = encodeURI(decodeURI(photoUrl || fallback));
  imgEl.src = safeUrl;
  if (captionEl) captionEl.textContent = caption || "Foto PAP Spesial 📸";
  if (senderEl) senderEl.textContent = memberName || "Member JKT48";
  if (timeEl) timeEl.textContent = timeStr || "";
  if (downloadBtn) {
    downloadBtn.href = safeUrl;
    downloadBtn.download = `${(memberName || "jkt48").toLowerCase().replace(/\s+/g, "_")}_pap.jpg`;
  }

  modalEl.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closePhotoLightbox() {
  const modalEl = getEl("photo-lightbox-modal");
  if (modalEl) modalEl.style.display = "none";
  document.body.style.overflow = "";
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
function applyProviderUI(provider) {
  const providerSelect = getEl("ai-provider-select");
  if (providerSelect && providerSelect.value !== provider) {
    providerSelect.value = provider;
  }

  updateModelsDropdown(provider);

  const currentModel = Storage.getSelectedModel(provider);
  const modelSelect = getEl("groq-model-select");
  if (modelSelect) modelSelect.value = currentModel;

  const keyLabel = getEl("api-key-label");
  const keySubtext = getEl("api-key-subtext");
  const tutorialTitle = getEl("tutorial-title");
  const tutorialGemini = getEl("tutorial-gemini-content");
  const tutorialGroq = getEl("tutorial-groq-content");
  const keyInput = getEl("groq-api-key-input");

  if (provider === "gemini") {
    if (keyLabel) keyLabel.textContent = "Google Gemini API Key";
    if (keySubtext) keySubtext.textContent = "Dapatkan di Google AI Studio (aistudio.google.com)";
    if (keyInput) keyInput.placeholder = "AIzaSy...";
    if (tutorialTitle) tutorialTitle.textContent = "Cara Dapatkan Google Gemini API Key (Gratis):";
    if (tutorialGemini) tutorialGemini.style.display = "block";
    if (tutorialGroq) tutorialGroq.style.display = "none";
  } else {
    if (keyLabel) keyLabel.textContent = "Groq Cloud API Key";
    if (keySubtext) keySubtext.textContent = "Dapatkan di console.groq.com/keys (Gratis, Kilat & Tanpa Batas Limit)";
    if (keyInput) keyInput.placeholder = "gsk_...";
    if (tutorialTitle) tutorialTitle.textContent = "Cara Dapatkan Groq API Key (Gratis & Kilat):";
    if (tutorialGemini) tutorialGemini.style.display = "none";
    if (tutorialGroq) tutorialGroq.style.display = "block";
  }
}

function renderSettingsForm() {
  const apiKey = Storage.getApiKey();
  const provider = AIService.getProvider(apiKey);
  const profile = Storage.getUserProfile();

  const keyInput = getEl("groq-api-key-input");
  if (keyInput) keyInput.value = apiKey;

  applyProviderUI(provider);

  const nameInput = getEl("profile-name-input");
  if (nameInput) nameInput.value = profile.name || "Fans JKT48";

  const genderSelect = getEl("profile-gender-select");
  if (genderSelect) genderSelect.value = profile.gender || "Belum disetel";

  const ageInput = getEl("profile-age-input");
  const ageHint = getEl("profile-age-status-hint");
  if (ageInput) {
    ageInput.value = (profile.age !== undefined && profile.age !== null) ? profile.age : "";
    if (ageHint) {
      const curYear = new Date().getFullYear();
      let a = parseInt(profile.age, 10);
      if (a > 1900 && a <= curYear) a = curYear - a;
      if (a && a > 0) {
        ageHint.textContent = `✓ Umur tersimpan: ${a} tahun (Member lebih muda otomatis memanggilmu Kak)`;
      } else {
        ageHint.textContent = ``;
      }
    }
  }

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
  getEl("tab-contacts-btn")?.addEventListener("click", () => switchTab("contacts"));
  getEl("tab-updates-btn")?.addEventListener("click", () => switchTab("updates"));
  getEl("tab-settings-btn")?.addEventListener("click", () => switchTab("settings"));

  // Desktop sidebar action buttons
  getEl("desktop-chats-btn")?.addEventListener("click", () => switchTab("chats"));
  getEl("desktop-contacts-btn")?.addEventListener("click", () => switchTab("contacts"));
  getEl("desktop-status-btn")?.addEventListener("click", () => switchTab("updates"));
  getEl("desktop-settings-btn")?.addEventListener("click", () => switchTab("settings"));

  // Desktop empty placeholder button
  getEl("desktop-empty-contacts-btn")?.addEventListener("click", () => switchTab("contacts"));

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
    Storage.setAiProvider(provider);
    applyProviderUI(provider);
    const modelSelect = getEl("groq-model-select");
    if (modelSelect && modelSelect.value) {
      Storage.setSelectedModel(modelSelect.value);
    }
  });

  // Auto-detect key format
  getEl("groq-api-key-input")?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (val.startsWith("AIza") || val.startsWith("AQ.")) {
      Storage.setAiProvider("gemini");
      applyProviderUI("gemini");
    } else if (val.startsWith("gsk_")) {
      Storage.setAiProvider("groq");
      applyProviderUI("groq");
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
  // Message Send Controls & Escape Handling
  getEl("chat-send-btn")?.addEventListener("click", handleSendMessage);
  getEl("chat-input-text")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
      e.preventDefault();
      e.stopPropagation();
      closeChatRoom(true);
    }
  });

  // Auto expand textarea
  getEl("chat-input-text")?.addEventListener("input", (e) => {
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  });

  // PAP Badge & Camera button click
  getEl("chat-nav-pap")?.addEventListener("click", handleRequestPap);
  getEl("chat-camera-btn")?.addEventListener("click", handleRequestPap);

  // Global Escape (Esc) key listener to exit chat room & close active modals (like WhatsApp Web)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
      // 1. Close Photo Lightbox if open
      const lightboxModal = getEl("photo-lightbox-modal");
      if (lightboxModal && (lightboxModal.style.display === "flex" || lightboxModal.offsetParent !== null)) {
        e.preventDefault();
        e.stopPropagation();
        closePhotoLightbox();
        return;
      }

      // 2. Close Story Viewer if open
      const storyModal = getEl("story-viewer-modal");
      if (storyModal && (storyModal.style.display === "flex" || storyModal.offsetParent !== null)) {
        e.preventDefault();
        e.stopPropagation();
        closeStoryViewer();
        return;
      }

      // 3. Close Member Info Modal if open
      const infoModal = getEl("member-info-modal");
      if (infoModal && (infoModal.style.display === "flex" || infoModal.offsetParent !== null)) {
        e.preventDefault();
        e.stopPropagation();
        closeMemberInfoModal();
        return;
      }

      // 4. Close Edit Contact Modal if open
      const contactModal = getEl("edit-contact-modal");
      if (contactModal && (contactModal.style.display === "flex" || contactModal.offsetParent !== null)) {
        e.preventDefault();
        e.stopPropagation();
        closeEditContactModal();
        return;
      }

      // 5. If in settings or contacts view, return to chats list
      if (state.currentTab !== "chats") {
        e.preventDefault();
        e.stopPropagation();
        switchTab("chats");
        return;
      }

      // 6. If inside an active chat room, exit/close room (like WhatsApp Web/Desktop)
      const chatRoomScreen = getEl("chat-room-screen");
      if (state.activeMemberId || (chatRoomScreen && chatRoomScreen.style.display !== "none")) {
        e.preventDefault();
        e.stopPropagation();
        closeChatRoom(true);
      }
    }
  }, true);

  // Delegasi klik foto di bubble chat untuk membuka lightbox
  const chatMsgArea = getEl("chat-messages-area");
  if (chatMsgArea) {
    chatMsgArea.addEventListener("click", (e) => {
      const photoWrap = e.target.closest(".chat-bubble-photo-wrap");
      if (photoWrap) {
        const photoUrl = photoWrap.dataset.photoUrl || photoWrap.querySelector("img")?.src;
        const caption = photoWrap.dataset.photoTitle || photoWrap.querySelector(".chat-bubble-photo-title")?.textContent;
        const time = photoWrap.dataset.photoTime || "";
        const member = MEMBERS.find(m => m.id === state.activeMemberId);
        openPhotoLightbox(photoUrl, caption, member ? getMemberDisplayName(member) : "Member JKT48", time);
      }
    });
  }

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
    const modelSelect = getEl("groq-model-select");
    if (res.switchedModel && modelSelect) {
      modelSelect.value = res.switchedModel;
      Storage.setSelectedModel(res.switchedModel);
    }
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
    const ageVal = getEl("profile-age-input")?.value?.trim();
    const age = ageVal ? parseInt(ageVal, 10) : "";
    const status = getEl("profile-status-input")?.value || "";
    const city = getEl("profile-city-input")?.value || "Jakarta";
    const testResultEl = getEl("test-connection-result");
    const saveBtn = getEl("save-settings-btn");

    Storage.setAiProvider(provider);
    Storage.setApiKey(apiKey);
    Storage.setSelectedModel(model);
    Storage.setUserProfile({ name, gender, age, status, city });

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

      const modelSelect = getEl("groq-model-select");
      if (res.switchedModel && modelSelect) {
        modelSelect.value = res.switchedModel;
        Storage.setSelectedModel(res.switchedModel);
      }

      if (testResultEl) {
        testResultEl.textContent = res.message;
        testResultEl.style.color = res.success ? "#16A34A" : "#DC2626";
      }

      const provName = provider === "gemini" ? "Google Gemini AI" : "Groq Cloud AI";
      if (res.success) {
        showToast(`${provName} Berhasil Terhubung & Aktif! ✨`, "✅");
      } else {
        showToast(`Kunci tersimpan, tapi ${provName} gagal: ${res.message}`, "⚠️");
      }
    } else {
      if (testResultEl) {
        testResultEl.textContent = "Mode offline aktif (tanpa API Key).";
        testResultEl.style.color = "var(--ios-text-secondary)";
      }
      showToast("Profil disimpan.", "✅");
    }
  });

  // Real-time auto-save for user profile fields (no need to scroll & click button)
  const autoSaveProfile = () => {
    const name = getEl("profile-name-input")?.value?.trim() || "Fans JKT48";
    const gender = getEl("profile-gender-select")?.value || "Belum disetel";
    const ageRaw = getEl("profile-age-input")?.value?.trim();
    let age = ageRaw ? parseInt(ageRaw, 10) : "";
    const curYear = new Date().getFullYear();
    if (age > 1900 && age <= curYear) age = curYear - age;

    const status = getEl("profile-status-input")?.value?.trim() || "";
    const city = getEl("profile-city-input")?.value?.trim() || "Jakarta";

    Storage.setUserProfile({ name, gender, age, status, city });

    const desktopProfileName = getEl("desktop-profile-name");
    if (desktopProfileName) {
      desktopProfileName.textContent = name;
    }

    const ageHint = getEl("profile-age-status-hint");
    if (ageHint) {
      if (age && age > 0) {
        ageHint.textContent = `✓ Umur tersimpan: ${age} tahun (Member lebih muda otomatis memanggilmu Kak)`;
      } else {
        ageHint.textContent = ``;
      }
    }
  };

  getEl("profile-name-input")?.addEventListener("input", autoSaveProfile);
  getEl("profile-age-input")?.addEventListener("input", autoSaveProfile);
  getEl("profile-gender-select")?.addEventListener("change", autoSaveProfile);
  getEl("profile-status-input")?.addEventListener("input", autoSaveProfile);
  getEl("profile-city-input")?.addEventListener("input", autoSaveProfile);

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
      state.activeMemberId = null;
      if (isDesktopView()) {
        const desktopPlaceholder = getEl("desktop-empty-placeholder");
        if (desktopPlaceholder) desktopPlaceholder.style.display = "flex";
        const chatRoomScreen = getEl("chat-room-screen");
        if (chatRoomScreen) chatRoomScreen.style.display = "none";
      }
      renderChatList();
      updateTotalUnreadBadge();
      showToast("Semua riwayat chat telah dibersihkan", "🗑️");
    }
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    if (isDesktopView() && !state.activeMemberId) {
      const activeChatIds = Storage.getActiveChatIds();
      if (activeChatIds.length > 0) {
        openChatRoom(activeChatIds[0]);
      } else {
        const desktopPlaceholder = getEl("desktop-empty-placeholder");
        if (desktopPlaceholder) desktopPlaceholder.style.display = "flex";
        const chatRoomScreen = getEl("chat-room-screen");
        if (chatRoomScreen) chatRoomScreen.style.display = "none";
      }
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
    getEl("tab-contacts-btn"),
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
    getEl("tab-contacts-btn")?.classList.add("active");
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
