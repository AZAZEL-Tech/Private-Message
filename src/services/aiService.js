import { Storage } from "./storage.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const AIService = {
  // Determine provider based on key format or saved selection
  getProvider(apiKey) {
    if (!apiKey) return "gemini";
    const cleanKey = apiKey.trim();
    if (cleanKey.startsWith("AIza") || cleanKey.startsWith("AQ.")) return "gemini";
    if (cleanKey.startsWith("gsk_")) return "groq";
    return Storage.getAiProvider() || "gemini";
  },

  // Test connection for Gemini or Groq
  async testConnection(apiKey, modelId, provider) {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, message: "API Key tidak boleh kosong!" };
    }

    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, "");
    const effectiveProvider = provider || this.getProvider(cleanKey);
    const startTime = performance.now();

    try {
      if (effectiveProvider === "gemini") {
        let model = modelId && modelId.startsWith("gemini") && !modelId.includes("1.5-") ? modelId : "gemini-3.6-flash";
        let url = `${GEMINI_ENDPOINT_BASE}/${model}:generateContent?key=${cleanKey}`;
        
        let response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": cleanKey
          },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: "Katakan 'Koneksi Gemini Berhasil' dalam 3 kata." }] }
            ],
            generationConfig: {
              maxOutputTokens: 100,
              thinkingConfig: { thinkingBudget: 0 }
            }
          })
        });

        // If deprecated model 404, retry with gemini-3.6-flash automatically
        if (!response.ok && response.status === 404 && model !== "gemini-3.6-flash") {
          model = "gemini-3.6-flash";
          url = `${GEMINI_ENDPOINT_BASE}/${model}:generateContent?key=${cleanKey}`;
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": cleanKey
            },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: "Katakan 'Koneksi Gemini Berhasil' dalam 3 kata." }] }
              ],
              generationConfig: {
                maxOutputTokens: 100,
                thinkingConfig: { thinkingBudget: 0 }
              }
            })
          });
        }

        const elapsed = Math.round(performance.now() - startTime);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const rawMsg = errData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
          const reason = errData.error?.details?.[0]?.reason || "";

          let friendlyMsg = rawMsg;
          if (reason === "ACCESS_TOKEN_TYPE_UNSUPPORTED" || rawMsg.includes("Expected OAuth 2")) {
            friendlyMsg = "Generative Language API belum aktif di project Google ini. Solusi: Di aistudio.google.com, klik 'Create API key' lalu pilih 'Create API key in NEW project'!";
          } else if (rawMsg.includes("API key not valid")) {
            friendlyMsg = "API Key tidak valid atau terpotong. Pastikan menyalin seluruh teks key.";
          }
          return { success: false, message: `Gagal: ${friendlyMsg}`, latency: elapsed };
        }

        return {
          success: true,
          message: `Koneksi Gemini AI Berhasil! (${elapsed}ms)`,
          latency: elapsed
        };
      } else {
        // Groq Provider
        const model = modelId && !modelId.startsWith("gemini") ? modelId : "llama-3.3-70b-versatile";
        const response = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cleanKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: "Ping! Jawab 'OK'." }],
            max_tokens: 10
          })
        });

        const elapsed = Math.round(performance.now() - startTime);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const msg = errData.error?.message || `HTTP ${response.status}`;
          return { success: false, message: `Gagal Groq: ${msg}`, latency: elapsed };
        }

        return {
          success: true,
          message: `Koneksi Groq Cloud Berhasil! (${elapsed}ms)`,
          latency: elapsed
        };
      }
    } catch (err) {
      return {
        success: false,
        message: `Koneksi gagal: ${err.message || "Periksa koneksi internet Anda"}`
      };
    }
  },

  // Main method called by chat interface: returns string reply
  async generateIdolResponse(userText, systemPrompt, apiKey, modelId, chatHistory, provider, userProfile, member) {
    const cleanKey = apiKey ? apiKey.trim() : "";
    const effectiveProvider = provider || this.getProvider(cleanKey);
    const profile = userProfile || Storage.getUserProfile();
    const rawName = (profile && profile.name) ? profile.name.trim() : "";
    const userName = (rawName && rawName.toLowerCase() !== "fans jkt48") ? rawName : "kamu";
    const memberName = member?.name || "aku";

    // Build comprehensive, expressive persona instructions
    const enhancedPrompt = `${systemPrompt || "Kamu adalah member JKT48 yang ramah dan ceria."}

==============================
ATURAN KHUSUS CHAT PERSONAL JKT48 PRIVATE MESSAGE:
1. PENTING - KONTEKS & NYAMBUNG:
   - Sambung langsung apa pun topik yang dibicarakan penggemar (${userName}).
   - PENTING: Perhatikan konteks emosi dan respon pengguna:
     * Jika user menyapa ("hai", "halo", "fre"), sapa balik dengan ramah, hangat dan ceria.
     * Jika user menolak ("gamau", "nggak", "ogah", "males"), tanggapi dengan bercanda/teasing santai ala teman akrab (misal: "dih kok jutek sih wkwk", "ih pelit amat 🥺").
     * Jangan pernah menjawab kaku atau generik seperti robot/asisten AI bot. Bersikaplah seperti idol ${memberName} asli yang sedang membalas pesan personal penggemarnya di JKT48 Private Message.
   - Panggil nama penggemar ("${userName}") secara manis dan natural sewajarnya (jangan panggil "Fans JKT48"!).

2. GAYA BAHASA & EKSPRESIF:
   - Gunakan bahasa Indonesia gaul/santai anak muda Jakarta (aku, kamu, hehe, ciee, wah, beneran?, semangat yaa, dll.).
   - Sangat ekspresif! Pakai emoji yang manis dan lucu (✨, 😆, 🥺, 🍦, 💖, 🎀, 🌸, 🍵).
   - Buat balasan mengalir 1-3 kalimat seperti chat Private Message resmi (hindari format kaku/poin-poin/esai).`;

    if (!cleanKey) {
      const offline = await this._simulateOfflineResponse(member, userText, profile, chatHistory);
      return offline.text;
    }

    try {
      if (effectiveProvider === "gemini") {
        const selectedModel = modelId && modelId.startsWith("gemini") ? modelId : "gemini-1.5-flash";
        const res = await this._callGeminiAPI({
          apiKey: cleanKey,
          model: selectedModel,
          systemPrompt: enhancedPrompt,
          chatHistory: chatHistory || [],
          userText
        });
        return res.text;
      } else {
        const selectedModel = modelId && !modelId.startsWith("gemini") ? modelId : "llama-3.3-70b-versatile";
        const res = await this._callGroqAPI({
          apiKey: cleanKey,
          model: selectedModel,
          systemPrompt: enhancedPrompt,
          chatHistory: chatHistory || [],
          userText
        });
        return res.text;
      }
    } catch (err) {
      console.error("AI API Request error:", err);
      // Alert user with toast so they immediately know why the AI failed
      if (typeof window !== "undefined" && window.showToast) {
        window.showToast(`⚠️ Gemini API: ${err.message} (Fallback ke Mode Offline)`, "⚠️");
      }
      const fallback = await this._simulateOfflineResponse(member, userText, profile, chatHistory);
      return fallback.text;
    }
  },

  // Send message with deep conversational context & high expressiveness (object response adapter)
  async sendMessage({ member, chatHistory, userText }) {
    const apiKey = Storage.getApiKey();
    const cleanKey = apiKey ? apiKey.trim() : "";
    const profile = Storage.getUserProfile();
    const selectedModel = Storage.getSelectedModel() || "gemini-1.5-flash";
    const provider = this.getProvider(cleanKey);

    const replyText = await this.generateIdolResponse(
      userText,
      member?.systemPrompt,
      cleanKey,
      selectedModel,
      chatHistory,
      provider,
      profile,
      member
    );

    return {
      success: true,
      text: replyText,
      modelUsed: selectedModel,
      provider: provider === "gemini" ? "Google Gemini" : "Groq Cloud"
    };
  },

  // Helper to construct alternating user/model turns for Gemini API
  _buildGeminiContents(chatHistory, userText) {
    const rawTurns = [];

    if (chatHistory && chatHistory.length > 0) {
      // Look at last 10 messages
      const recent = chatHistory.slice(-10);
      for (const msg of recent) {
        if (!msg || !msg.text || msg.isSpecial || msg.isSystem) continue;
        rawTurns.push({
          role: msg.isUser ? "user" : "model",
          text: String(msg.text).trim()
        });
      }
    }

    // Check if the very last message in chatHistory is already this userText
    const lastRaw = rawTurns[rawTurns.length - 1];
    if (!lastRaw || lastRaw.role !== "user" || lastRaw.text !== userText.trim()) {
      rawTurns.push({ role: "user", text: userText.trim() });
    }

    // Normalization rules for Gemini API:
    // 1. First turn MUST have role 'user'
    // 2. Turns MUST strictly alternate user -> model -> user -> model
    const contents = [];
    for (const turn of rawTurns) {
      if (!turn.text) continue;

      if (contents.length === 0) {
        // Drop any leading model messages
        if (turn.role !== "user") continue;
        contents.push({ role: "user", parts: [{ text: turn.text }] });
      } else {
        const lastTurn = contents[contents.length - 1];
        if (lastTurn.role === turn.role) {
          // Merge consecutive same-role turns
          lastTurn.parts[0].text += `\n${turn.text}`;
        } else {
          contents.push({ role: turn.role, parts: [{ text: turn.text }] });
        }
      }
    }

    // Safety fallback: ensure contents has at least current user message
    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: userText }] });
    } else if (contents[contents.length - 1].role !== "user") {
      contents.push({ role: "user", parts: [{ text: userText }] });
    }

    return contents;
  },

  // Gemini API implementation with conversation history & system instruction
  async _callGeminiAPI({ apiKey, model, systemPrompt, chatHistory, userText }) {
    const cleanKey = (apiKey || "").trim().replace(/^["']|["']$/g, "");
    let effectiveModel = model && !model.includes("1.5-") ? model : "gemini-3.6-flash";
    let url = `${GEMINI_ENDPOINT_BASE}/${effectiveModel}:generateContent?key=${cleanKey}`;
    const contents = this._buildGeminiContents(chatHistory, userText);

    // Primary payload using standard systemInstruction & safetySettings
    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.88,
        topP: 0.95,
        maxOutputTokens: 1000,
        thinkingConfig: {
          thinkingBudget: 0
        }
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    let response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cleanKey
      },
      body: JSON.stringify(payload)
    });

    // Fallback if systemInstruction is not supported by endpoint
    if (!response.ok && response.status === 400) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || "";
      
      // If error is about systemInstruction or unknown field, retry with prepended prompt
      if (errMsg.toLowerCase().includes("systeminstruction") || errMsg.toLowerCase().includes("unknown name")) {
        const fallbackContents = JSON.parse(JSON.stringify(contents));
        if (fallbackContents[0]?.parts?.[0]) {
          fallbackContents[0].parts[0].text = `[Instruksi Karakter: ${systemPrompt}]\n\n${fallbackContents[0].parts[0].text}`;
        }
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": cleanKey
          },
          body: JSON.stringify({
            contents: fallbackContents,
            generationConfig: {
              temperature: 0.88,
              maxOutputTokens: 1000,
              thinkingConfig: { thinkingBudget: 0 }
            }
          })
        });
      } else {
        throw new Error(errMsg || `HTTP 400: Permintaan ditolak Google`);
      }
    }

    // If model 404, retry with gemini-3.6-flash automatically
    if (!response.ok && response.status === 404 && effectiveModel !== "gemini-3.6-flash") {
      effectiveModel = "gemini-3.6-flash";
      url = `${GEMINI_ENDPOINT_BASE}/${effectiveModel}:generateContent?key=${cleanKey}`;
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cleanKey
        },
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const rawMsg = errData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      const reason = errData.error?.details?.[0]?.reason || "";
      if (reason === "ACCESS_TOKEN_TYPE_UNSUPPORTED" || rawMsg.includes("Expected OAuth 2")) {
        throw new Error("Generative Language API belum aktif di project ini. Buat key baru di Google AI Studio dengan opsi 'Create API key in NEW project'!");
      }
      throw new Error(rawMsg);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (candidate?.finishReason === "SAFETY") {
      throw new Error("Pesan disaring oleh filter Google Gemini (Safety).");
    }

    // Extract text and cleanly remove any thinking/reasoning leakage
    const parts = candidate?.content?.parts || [];
    const textParts = parts.filter(p => !p.thought && typeof p.text === "string" && p.text.trim());
    let replyText = (textParts.length > 0 ? textParts.map(p => p.text).join(" ") : parts[0]?.text || "").trim();

    if (replyText) {
      // Strip internal reasoning artifacts
      replyText = replyText.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
      replyText = replyText.replace(/^(?:\*+)?(?:Formulate the Response Strategy|Thinking Process|Thought Process|Plan|Strategy|Reasoning)(?:\*+)?:?\s*/i, "").trim();
      replyText = replyText.replace(/^\*\*[A-Za-z\s]+:\*\*\s*/i, "").trim();
    }

    if (!replyText) {
      throw new Error(`Respon kosong dari Google Gemini (Status: ${candidate?.finishReason || "UNKNOWN"})`);
    }

    return {
      success: true,
      text: replyText,
      modelUsed: effectiveModel,
      provider: "Google Gemini"
    };
  },

  // Groq API implementation with full context memory
  async _callGroqAPI({ apiKey, model, systemPrompt, chatHistory, userText }) {
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    if (chatHistory && chatHistory.length > 0) {
      const recent = chatHistory.slice(-10);
      for (const msg of recent) {
        if (!msg || !msg.text || msg.isSpecial || msg.isSystem) continue;
        messages.push({
          role: msg.isUser ? "user" : "assistant",
          content: String(msg.text).trim()
        });
      }
    }

    // Check if last message is already userText
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== userText.trim()) {
      messages.push({ role: "user", content: userText.trim() });
    }

    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.88,
        max_tokens: 250
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("Respon kosong dari Groq");
    }

    return {
      success: true,
      text: reply,
      modelUsed: model,
      provider: "Groq Cloud"
    };
  },

  // Rich, contextual, intelligent offline simulated fallback
  async _simulateOfflineResponse(member, userText, profile, chatHistory) {
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 500));

    const userProfile = profile || Storage.getUserProfile();
    const rawName = (userProfile && userProfile.name) ? userProfile.name.trim() : "";
    const userName = (rawName && rawName.toLowerCase() !== "fans jkt48") ? rawName : "kamu";
    const memberName = member?.name || "aku";
    const lower = (userText || "").toLowerCase().trim();

    // Helper to pick a response that wasn't used in recent messages to avoid repetitions
    const recentBotTexts = (chatHistory || [])
      .filter(m => !m.isUser && m.text)
      .slice(-5)
      .map(m => m.text);

    const pickBest = (options) => {
      const fresh = options.filter(opt => !recentBotTexts.includes(opt));
      const pool = fresh.length > 0 ? fresh : options;
      return pool[Math.floor(Math.random() * pool.length)];
    };

    // 1. Penolakan / Ketus / Ngambek / "gamau cerita apa apa" / Jutek
    if (
      lower.includes("gamau") || lower.includes("ga mau") || lower.includes("nggak mau") ||
      lower.includes("ngga mau") || lower.includes("ogah") || lower.includes("males") ||
      lower.includes("mager") || lower.includes("jutek") || lower.includes("dih") ||
      lower.includes("apa sih") || lower.includes("ngambek") || lower.includes("bodo") ||
      lower.includes("terserah") || lower.includes("ga jelas") || lower.includes("gajelas") ||
      lower.includes("ga nyambung") || lower.includes("gak nyambung")
    ) {
      return {
        success: true,
        text: pickBest([
          `Dih, kok jutek banget sih wkwk 😜 Padahal ${memberName} udah siap pasang telinga buat dengerin lho!`,
          `Ihh kok judes gitu sih ${userName} 🥺 Lagi ada yang bikin kesel ya di luar sana? Sini cerita pelan-pelan~`,
          `Wkwk galak amat! Maaf yaa kalau tadi aku kurang nyambung 🙈 Ya udah deh, kamu lagi pengen diobrolin apa nih sekarang?`,
          `Ciee ngambek ya? Jangan jutek-jutek dong, nanti aura manisnya ilang lho! Sini aku hibur dulu 😆✨`,
          `Yaudah deh kalau lagi gamau cerita apa-apa, tapi jangan tutup chatnya yaa, temenin ${memberName} aja di sini hehe 💖`
        ]),
        isSimulated: true
      };
    }

    // 2. Sapaan & Panggilan Nama Member (e.g. "hai fre", "halo", "pagi", "oi")
    const greetings = ["halo", "hai", "hei", "helo", "oy", "oi", "hey", "assalamualaikum", "punten", "pagi", "siang", "sore", "malam"];
    const isCallingMember = member?.name && lower.includes(member.name.toLowerCase());
    const isGreeting = greetings.some(g => lower.includes(g)) || isCallingMember;

    if (isGreeting && lower.length < 35) {
      if (lower.includes("pagi")) {
        return {
          success: true,
          text: pickBest([
            `Pagi juga ${userName}! ☀️ Semoga harimu menyenangkan dan penuh semangat yaa! Udah sarapan belum?`,
            `Selamat pagi! Semangat buat aktivitas hari ini yaa, jangan lupa senyum lebar bareng ${memberName}! ✨`
          ]),
          isSimulated: true
        };
      }
      if (lower.includes("malam")) {
        return {
          success: true,
          text: pickBest([
            `Malam juga ${userName}! 🌙 Hari ini capek gak? Jangan begadang yaa, istirahat yang cukup biar besok seger!`,
            `Selamat malam! Pas banget lagi santai sebelum tidur nih. Gimana harimu tadi? 💖`
          ]),
          isSimulated: true
        };
      }
      return {
        success: true,
        text: pickBest([
          `Hai hai ${userName}! ✨ Pas banget aku lagi buka Private Message nih, ada apa manggil-manggil ${memberName}? 😆`,
          `Halo juga ${userName}! 🌸 Seneng deh kamu ngechat aku. Gimana harimu sejauh ini, seru gak?`,
          `Haiii! Hehe seneng banget dapet chat dari ${userName} ✨ Lagi santai atau lagi sibuk nih?`,
          `Halo! Ada cerita seru apa nih hari ini? Sini obrolin bareng ${memberName} 💖`
        ]),
        isSimulated: true
      };
    }

    // 3. Tanya Kabar & Aktivitas ("lagi apa", "lagi ngapain", "sibuk apa")
    if (lower.includes("lagi apa") || lower.includes("lagi ngapain") || lower.includes("sibuk apa") || lower.includes("kegiatan") || lower.includes("kabar") || lower.includes("dimana") || lower.includes("di mana")) {
      return {
        success: true,
        text: pickBest([
          `Lagi istirahat selonjoran di backstage nih ${userName}. Habis latihan koreografi dance bareng member lain, lumayan pegel tapi seru! Kamu lagi apa? 💃`,
          `Ini lagi santai sambil dengerin lagu di HP hehe. Pas banget notif chat dari kamu muncul, langsung bikin senyum 😆 Kamu sendiri lagi ngapain?`,
          `Alhamdulillah kabar baik dan sehat dong! Lagi siap-siap buat kegiatan nanti sore. Kalau kamu hari ini kemana aja? ✨`,
          `Lagi di fX Sudirman nih persiapan buat jadwal latihan. Hari ini cuaca di tempatmu gimana ${userName}? ☀️`
        ]),
        isSimulated: true
      };
    }

    // 4. Makan & Jajan ("makan", "laper", "sarapan", "dinner")
    if (lower.includes("makan") || lower.includes("laper") || lower.includes("lapar") || lower.includes("sarapan") || lower.includes("lunch") || lower.includes("dinner") || lower.includes("kenyang") || lower.includes("jajan") || lower.includes("seblak") || lower.includes("es krim")) {
      return {
        success: true,
        text: pickBest([
          `Aku tadi udah makan nih! Kamu jangan sampai telat makan yaa ${userName}, nanti maag-nya kambuh lho 🥺🍛 Jaga kesehatan!`,
          `Wahh ngomongin makanan jadi ikutan laper nih 🤤 Pengen jajan yang manis-manis atau es krim deh! Kamu hari ini makan lauk apa?`,
          `Kenyang banget tadi habis makan bareng anak-anak JKT48 hehe. Kamu udah makan belum? Harus makan yang bergizi yaa! 🍱✨`
        ]),
        isSimulated: true
      };
    }

    // 5. Kangen & Perasaan ("kangen", "sayang", "cantik", "lucu", "gemas", "oshi")
    if (lower.includes("kangen") || lower.includes("sayang") || lower.includes("cantik") || lower.includes("lucu") || lower.includes("gemas") || lower.includes("imut") || lower.includes("oshi") || lower.includes("salting") || lower.includes("pacar") || lower.includes("jodoh")) {
      return {
        success: true,
        text: pickBest([
          `Ihh ${userName} bisa aja deh bikin salting! 🙈 Beneran kangen apa gombal doang nih? Tapi makasih yaa, aku juga kangen ngobrol seru kayak gini 💖`,
          `Aduh langsung berbunga-bunga nih dibilang gitu 🌸 Kamu juga perhatian banget tahu! Makasih banyak yaa selalu dukung ${memberName} ✨`,
          `Ciee ciee, jurus gombalnya boleh juga nih 😆 Jangan sering-sering yaa, nanti aku beneran kepikiran lho haha!`,
          `Makasih yaa! Seneng banget bisa jadi oshi kamu. Nanti pas ketemu di theater sapa aku yang kenceng yaa! 🎀`
        ]),
        isSimulated: true
      };
    }

    // 6. Kerja & Belajar ("kerja", "kantor", "lembur", "tugas", "ujian", "skripsi", "kuliah", "sekolah")
    if (lower.includes("kerja") || lower.includes("kantor") || lower.includes("lembur") || lower.includes("tugas") || lower.includes("ujian") || lower.includes("skripsi") || lower.includes("kuliah") || lower.includes("sekolah")) {
      return {
        success: true,
        text: pickBest([
          `Semangat kerjanya yaa ${userName}! Jangan lupa minum air putih dan istirahat sejenak kalau udah pegal. Nanti kabarin aku lagi kalau udah beres yaa ✨💪`,
          `Wah lagi sibuk kerja/tugas yaa? Fokus dulu gih, jangan sampai kecapekan yaa ${userName}. ${memberName} semangatin dari sini! 🌟`,
          `Gas pol terus kerjanya ${userName}! Tapi inget jangan telat makan yaa. Semangat pejuang rupiah / tugas hehe 💖🔥`
        ]),
        isSimulated: true
      };
    }

    // 7. Capek & Butuh Semangat ("capek", "lelah", "pusing", "stres", "semangat")
    if (lower.includes("capek") || lower.includes("lelah") || lower.includes("pusing") || lower.includes("stres") || lower.includes("stress")) {
      return {
        success: true,
        text: pickBest([
          `Puk puk puk 🥺 Istirahat sebentar yaa ${userName}, rebahan dulu. Jangan dipaksain kalau badan udah lelah. Aku nemenin ngobrol di sini kok 💙`,
          `Kamu hebat banget hari ini udah berjuang sejauh ini! Istirahat yang cukup yaa, ${memberName} selalu doain yang terbaik buat kamu 🌟`
        ]),
        isSimulated: true
      };
    }

    if (lower.includes("semangat")) {
      return {
        success: true,
        text: pickBest([
          `Makasih banyak yaa semangatnya! Kamu juga harus selalu ceria & kuat hari ini, gas pol terus! ✨🔥`,
          `Aamiin! Semangat juga buat ${userName}, kita sama-sama saling semangatin yaa hari ini 💖`
        ]),
        isSimulated: true
      };
    }

    // 7. Theater & JKT48 Performance ("theater", "show", "setlist", "stage", "seifuku", "lagu")
    if (lower.includes("theater") || lower.includes("teater") || lower.includes("show") || lower.includes("stage") || lower.includes("setlist") || lower.includes("seifuku") || lower.includes("lagu") || lower.includes("tiket") || lower.includes("2shot") || lower.includes("two-shot")) {
      return {
        success: true,
        text: pickBest([
          `Wahh kamu kapan mau nonton theater lagi? Nanti kalau nonton jangan lupa bawa lightstick yaa, biar aku bisa liat kamu dari panggung! ✨💃`,
          `Setlist sekarang koreografinya seru dan enerjik banget lho! Harus nonton yaa, awas kalau ga dateng hehe 😜`,
          `Iya nih, perform di theater itu momen paling berharga buat aku karena bisa ketemu dan ngerasain energi langsung dari kamu! 💖`
        ]),
        isSimulated: true
      };
    }

    // 8. Tanya Balik & Obrolan Interaktif (Lively Contextual Pool)
    return {
      success: true,
      text: pickBest([
        `Wah gitu yaa? Hehe menarik deh! Terus kelanjutannya gimana tuh ${userName}? Coba ceritain lagi, aku dengerin nih 😆✨`,
        `Beneran? Wkwk aku baru tahu lho! Kamu emang paling asyik deh kalau diajak ngobrol santai gini 🌸`,
        `Hehe iyaa juga ya! Oh iya ${userName}, hari ini ada kejadian seru atau lucu gak yang kamu alamin? Bagi ceritanya dong! 😆`,
        `Wah seru banget denger cerita kamu! Hehe, menurut kamu hal itu seru gak? Cerita lagi dong! ✨`,
        `Hehe seneng deh kamu nyempetin waktu buat ngobrol sama ${memberName}. Tetap temenin aku ngobrol terus yaa 💖`
      ]),
      isSimulated: true
    };
  }
};
