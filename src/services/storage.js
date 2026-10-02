const STORAGE_KEYS = {
  API_KEY: "xidol_ai_api_key_v3",
  AI_PROVIDER: "xidol_ai_provider_v3",
  SELECTED_MODEL: "xidol_ai_model_v3",
  CHAT_MESSAGES: "xidol_chat_messages_v1",
  USER_PROFILE: "xidol_user_profile_v1",
  THEME_MODE: "xidol_theme_mode",
  SOUND_ENABLED: "xidol_sound_enabled",
  STREAKS_DATA: "xidol_streaks_daily_v3",
  CUSTOM_NAMES: "xidol_member_custom_names_v1",
  ACTIVE_CHATS: "xidol_active_chats_v1",
  MEMBER_STORIES: "xidol_member_stories_v2",
  MY_STATUS: "xidol_my_status_v1"
};

const DEFAULT_PROFILE = {
  name: "Fans JKT48",
  gender: "Belum disetel",
  age: "",
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

  getSelectedModel(provider) {
    const model = localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
    const prov = provider || this.getAiProvider();
    if (prov === "groq") {
      if (!model || model.startsWith("gemini") || model.includes("llama-3.3-70b") || model.includes("llama-3.1-8b")) {
        return "openai/gpt-oss-120b";
      }
      return model;
    }
    if (!model || !model.startsWith("gemini") || model.includes("1.5-flash") || model.includes("2.0-flash") || model === "gemini-1.5-pro") {
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
    const current = this.getUserProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
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
    this.clearAllActiveChats();
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

  getActiveChatIds() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHATS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addActiveChat(memberId) {
    try {
      const list = this.getActiveChatIds();
      const existingIdx = list.indexOf(memberId);
      if (existingIdx !== -1) {
        // Move to front (most recent)
        list.splice(existingIdx, 1);
      }
      list.unshift(memberId);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHATS, JSON.stringify(list));
      return list;
    } catch (e) {
      console.error("Failed to add active chat", e);
      return [];
    }
  },

  removeActiveChat(memberId) {
    try {
      let list = this.getActiveChatIds();
      list = list.filter(id => id !== memberId);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHATS, JSON.stringify(list));
      return list;
    } catch (e) {
      console.error("Failed to remove active chat", e);
      return [];
    }
  },

  clearAllActiveChats() {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHATS);
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

  // Helper to format date as "YYYY-MM-DD" in local timezone
  _getTodayString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  // Helper to calculate difference in calendar days between two "YYYY-MM-DD" strings
  _getDayDifference(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return 999;
    const [y1, m1, d1] = dateStr1.split("-").map(Number);
    const [y2, m2, d2] = dateStr2.split("-").map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
  },

  // 3-Day Consecutive Chat Streak Feature
  getMemberStreakData(memberId) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STREAKS_DATA);
      const streaks = data ? JSON.parse(data) : {};
      const memberData = streaks[memberId];

      if (!memberData || !memberData.lastDate || !memberData.count) {
        return { count: 0, lastDate: null, hasFlame: false };
      }

      const today = this._getTodayString();
      const diffDays = this._getDayDifference(memberData.lastDate, today);

      // If diffDays >= 2, user missed at least 1 full calendar day without chat.
      // Streak is broken and resets back to 0!
      if (diffDays >= 2) {
        memberData.count = 0;
        memberData.lastDate = null;
        streaks[memberId] = memberData;
        localStorage.setItem(STORAGE_KEYS.STREAKS_DATA, JSON.stringify(streaks));
        return { count: 0, lastDate: null, hasFlame: false };
      }

      return {
        count: memberData.count,
        lastDate: memberData.lastDate,
        hasFlame: memberData.count >= 3
      };
    } catch {
      return { count: 0, lastDate: null, hasFlame: false };
    }
  },

  getMemberStreak(memberId, fallbackInitial = 0) {
    const data = this.getMemberStreakData(memberId);
    return data.count || fallbackInitial || 0;
  },

  recordDailyChatStreak(memberId) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STREAKS_DATA);
      const streaks = data ? JSON.parse(data) : {};

      const today = this._getTodayString();
      let memberData = streaks[memberId] || { count: 0, lastDate: null };

      // Check if previous streak was broken due to missed day (full day without chat)
      if (memberData.lastDate) {
        const diffDays = this._getDayDifference(memberData.lastDate, today);
        if (diffDays >= 2) {
          memberData.count = 0;
          memberData.lastDate = null;
        }
      }

      const prevCount = memberData.count || 0;

      if (!memberData.lastDate) {
        // First day of chat interaction
        memberData.count = 1;
        memberData.lastDate = today;
      } else {
        const diffDays = this._getDayDifference(memberData.lastDate, today);
        if (diffDays === 0) {
          // Already chatted today: maintain current streak (does not increment multiple times on same day)
        } else if (diffDays === 1) {
          // Consecutive next calendar day! Increment streak
          memberData.count += 1;
          memberData.lastDate = today;
        } else {
          // Full day was skipped: restart streak at 1
          memberData.count = 1;
          memberData.lastDate = today;
        }
      }

      streaks[memberId] = memberData;
      localStorage.setItem(STORAGE_KEYS.STREAKS_DATA, JSON.stringify(streaks));

      const newCount = memberData.count;
      const justUnlockedFlame = prevCount < 3 && newCount >= 3;

      return {
        streak: newCount,
        hasFlame: newCount >= 3,
        justUnlockedFlame
      };
    } catch (e) {
      console.error("Streak tracking error", e);
      return { streak: 0, hasFlame: false, justUnlockedFlame: false };
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
  },

  // Manual / Testing Streak Adjuster
  setMemberStreak(memberId, count) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STREAKS_DATA);
      const streaks = data ? JSON.parse(data) : {};
      const num = Math.max(0, parseInt(count, 10) || 0);
      streaks[memberId] = {
        count: num,
        lastDate: this._getTodayString()
      };
      localStorage.setItem(STORAGE_KEYS.STREAKS_DATA, JSON.stringify(streaks));
      return {
        streak: num,
        hasFlame: num >= 3,
        isPossessive: num >= 5,
        isJealous: num >= 7
      };
    } catch (e) {
      console.error("Failed to set member streak", e);
      return { streak: 0, hasFlame: false, isPossessive: false, isJealous: false };
    }
  },

  // Member Stories / Status System
  getMemberStories() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMBER_STORIES);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveMemberStories(stories) {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBER_STORIES, JSON.stringify(stories));
    } catch (e) {
      console.error("Failed to save stories", e);
    }
  },

  addMemberStory(memberId, photoUrl, caption, memberName = "", avatar = "") {
    try {
      let stories = this.getMemberStories() || [];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const timeAgo = `Hari ini ${timeStr}`;
      const storyId = `story-${memberId}`;

      let memberStory = stories.find(s => s.memberId === memberId);
      const newPhoto = {
        id: "p_" + Date.now(),
        url: photoUrl,
        imageUrl: photoUrl,
        caption: caption || "Status terbaru ✨",
        time: timeStr
      };

      if (memberStory) {
        memberStory.timeAgo = timeAgo;
        memberStory.timestamp = timeStr;
        memberStory.time = timeStr;
        memberStory.viewed = false;
        memberStory.hasUnseen = true;
        if (!memberStory.photos) memberStory.photos = [];
        memberStory.photos.unshift(newPhoto);
        memberStory.stories = memberStory.photos;
        stories = [memberStory, ...stories.filter(s => s.memberId !== memberId)];
      } else {
        memberStory = {
          id: storyId,
          memberId: memberId,
          memberName: memberName || memberId,
          avatar: avatar || "",
          timeAgo: timeAgo,
          timestamp: timeStr,
          time: timeStr,
          viewed: false,
          hasUnseen: true,
          photos: [newPhoto],
          stories: [newPhoto]
        };
        stories.unshift(memberStory);
      }

      this.saveMemberStories(stories);
      return memberStory;
    } catch (e) {
      console.error("Failed to add member story", e);
      return null;
    }
  },

  markStoryViewed(storyId) {
    try {
      const stories = this.getMemberStories();
      if (!stories) return;
      const story = stories.find(s => s.id === storyId);
      if (story) {
        story.viewed = true;
        story.hasUnseen = false;
        this.saveMemberStories(stories);
      }
    } catch (e) {
      console.error("Failed to mark story viewed", e);
    }
  },

  getMyStatus() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MY_STATUS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setMyStatus(statusData) {
    try {
      localStorage.setItem(STORAGE_KEYS.MY_STATUS, JSON.stringify(statusData));
    } catch (e) {
      console.error("Failed to save my status", e);
    }
  }
};
