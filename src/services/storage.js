const STORAGE_KEYS = {
  API_KEY: "xidol_ai_api_key_v3",
  AI_PROVIDER: "xidol_ai_provider_v3",
  SELECTED_MODEL: "xidol_ai_model_v3",
  CHAT_MESSAGES: "xidol_chat_messages_v1",
  USER_PROFILE: "xidol_user_profile_v1",
  THEME_MODE: "xidol_theme_mode",
  SOUND_ENABLED: "xidol_sound_enabled",
  STREAKS_DATA: "xidol_streaks_daily_v2",
  CUSTOM_NAMES: "xidol_member_custom_names_v1"
};

const DEFAULT_PROFILE = {
  name: "Fans JKT48",
  gender: "Belum disetel",
  status: "Ada | Mengidolakan JKT48 ✨",
  city: "Jakarta",
  avatar: ""
};

export const Storage = {
  getApiKey() {
    return localStorage.getItem(STORAGE_KEYS.API_KEY) || localStorage.getItem("xidol_groq_api_key") || "";
  },

  setApiKey(key) {
    if (key) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
    }
  },

  getAiProvider() {
    return localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || "gemini";
  },

  setAiProvider(provider) {
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
  },

  getSelectedModel() {
    const model = localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
    if (!model || model.includes("1.5-flash") || model.includes("2.0-flash") || model === "gemini-1.5-pro") {
      return "gemini-3.6-flash";
    }
    return model;
  },

  setSelectedModel(modelId) {
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelId);
  },

  getUserProfile() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? { ...DEFAULT_PROFILE, ...JSON.parse(data) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  },

  setUserProfile(profile) {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  },

  getChatHistory(memberId) {
    try {
      const all = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
      const parsed = all ? JSON.parse(all) : {};
      return parsed[memberId] || null;
    } catch {
      return null;
    }
  },

  saveChatMessage(memberId, message) {
    try {
      const all = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
      const parsed = all ? JSON.parse(all) : {};
      if (!parsed[memberId]) {
        parsed[memberId] = [];
      }
      parsed[memberId].push(message);
      localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(parsed));
    } catch (e) {
      console.error("Failed to save chat message", e);
    }
  },

  clearAllChats() {
    localStorage.removeItem(STORAGE_KEYS.CHAT_MESSAGES);
  },

  clearMemberChat(memberId) {
    try {
      const all = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
      const parsed = all ? JSON.parse(all) : {};
      delete parsed[memberId];
      localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(parsed));
    } catch (e) {
      console.error("Failed to clear member chat", e);
    }
  },

  getThemeMode() {
    return localStorage.getItem(STORAGE_KEYS.THEME_MODE) || "light";
  },

  setThemeMode(mode) {
    localStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
  },

  isSoundEnabled() {
    const val = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    return val === null ? true : val === "true";
  },

  setSoundEnabled(enabled) {
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled));
  },

  // TikTok Style 3-Day Streak Management
  getMemberStreak(memberId, fallbackInitial = 0) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STREAKS_DATA);
      const streaks = data ? JSON.parse(data) : {};
      if (streaks[memberId] !== undefined) {
        return streaks[memberId].count;
      }
      return fallbackInitial;
    } catch {
      return fallbackInitial;
    }
  },

  recordDailyChatStreak(memberId, initialStreak = 0) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STREAKS_DATA);
      const streaks = data ? JSON.parse(data) : {};
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      let memberData = streaks[memberId] || { count: initialStreak, lastDate: null };
      const prevCount = memberData.count;

      if (!memberData.lastDate) {
        memberData.count = Math.max(1, memberData.count);
        memberData.lastDate = todayStr;
      } else if (memberData.lastDate !== todayStr) {
        const lastDate = new Date(memberData.lastDate);
        const diffTime = Math.abs(now - lastDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) {
          memberData.count += 1;
        } else {
          memberData.count = 1;
        }
        memberData.lastDate = todayStr;
      }

      streaks[memberId] = memberData;
      localStorage.setItem(STORAGE_KEYS.STREAKS_DATA, JSON.stringify(streaks));

      return {
        streak: memberData.count,
        hasFlame: memberData.count >= 3,
        justUnlockedFlame: prevCount < 3 && memberData.count >= 3
      };
    } catch (e) {
      console.error("Streak tracking error", e);
      return { streak: initialStreak, hasFlame: initialStreak >= 3, justUnlockedFlame: false };
    }
  },

  // Custom Member Contact Name Management
  getAllCustomNames() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_NAMES);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  getMemberCustomName(memberId) {
    try {
      const names = this.getAllCustomNames();
      return names[memberId] || null;
    } catch {
      return null;
    }
  },

  setMemberCustomName(memberId, customName) {
    try {
      const names = this.getAllCustomNames();
      const trimmed = (customName || "").trim();
      if (trimmed) {
        names[memberId] = trimmed;
      } else {
        delete names[memberId];
      }
      localStorage.setItem(STORAGE_KEYS.CUSTOM_NAMES, JSON.stringify(names));
      return trimmed;
    } catch (e) {
      console.error("Failed to save custom name", e);
      return null;
    }
  },

  resetMemberCustomName(memberId) {
    try {
      const names = this.getAllCustomNames();
      delete names[memberId];
      localStorage.setItem(STORAGE_KEYS.CUSTOM_NAMES, JSON.stringify(names));
    } catch (e) {
      console.error("Failed to reset custom name", e);
    }
  }
};
