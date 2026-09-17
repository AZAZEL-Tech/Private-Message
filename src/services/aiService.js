import { Storage } from "./storage.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Limits emoji usage in chat text:
 * - Emojis are NOT placed in every chat.
 * - By default, emojis only appear on specific playful/humorous moments (rarely, ~15% chance).
 * - In 85%+ of chats, emojis are stripped completely so conversations feel natural, interactive, and not annoying.
 * - When allowed, at most maxEmojis (default 1) is kept.
 */
export function limitEmojis(text, maxEmojis = 1, forceKeep = false) {
  if (!text || typeof text !== "string") return text;

  // Match emoji graphemes including variation selectors, modifiers, and ZWJ sequences
  const emojiRegex = /\p{Extended_Pictographic}(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?)*|[\u{1F1E6}-\u{1F1FF}]{2}/gu;

  // Check if text has any emoji
  if (!emojiRegex.test(text)) return text;
  // Reset lastIndex because of /g flag
  emojiRegex.lastIndex = 0;

  // Detect playful or teasing moments
  const isPlayfulMoment = /wkwk|hehe|haha|salting|ciee?|gombal|ngambek|bercanda/i.test(text);
  // Only allow emoji in rare moments: 20% on playful moments, 10% on general text, or if forceKeep
  const allowEmoji = forceKeep || (isPlayfulMoment ? Math.random() < 0.20 : Math.random() < 0.10);

  let emojiCount = 0;
  let cleaned = text.replace(emojiRegex, (match) => {
    if (!allowEmoji) return "";
    emojiCount++;
    return emojiCount <= maxEmojis ? match : "";
  });

  // Clean up double spaces or spaces left before punctuation
  cleaned = cleaned
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ([.,!?~])/g, "$1")
    .trim();

  return cleaned;
}

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
    const hasCustomUserName = rawName && rawName.toLowerCase() !== "fans jkt48";
    const userName = hasCustomUserName ? rawName : "kamu";
    const memberName = member?.shortName || member?.nickname || (member?.name ? member.name.split(" ")[0] : "aku");

    // Build comprehensive, expressive persona instructions
    const enhancedPrompt = `${systemPrompt || "Kamu adalah member JKT48 yang ramah dan ceria."}

==============================
ATURAN KHUSUS CHAT PERSONAL JKT48 PRIVATE MESSAGE:
1. PENTING - KONTEKS, INTERAKTIF & HARUS 100% NYAMBUNG:
   - Responmu HARUS BENAR-BENAR NYAMBUNG dan MERESPON LANGSUNG apa yang dikirim penggemar (${userName}).
   - BACA DENGAN TELITI KATA/TOPIK CHAT PENGGEMAR:
     * Jika user memanggil panggilan akrab/manja seperti "adek", "adekkk", "dek", "bocil", atau "kakak", RESPONLAH PANGGILAN ITU secara natural dan menggemaskan (sebagai member yang akrab/manja/lucu). DILARANG menganggap user sedang cerita jika user cuma memanggil!
     * Jika user mengetik singkat ("p", "oi", "fahiraa", "woi", "tes"), respon panggilan tersebut dengan ceria/protes santai karena dispam.
     * Jika user tertawa ("wkwk", "haha", "ngakak"), tanggapi tawanya dan tanyakan hal lucu apa yang terjadi.
     * Jika user menjawab singkat ("iya", "nggak", "belum", "udah"), responlah jawaban tersebut dan lanjutkan topik obrolan.
     * Jika user bertanya ("lagi apa", "umur berapa", "makan apa"), jawab pertanyaan itu dan lempar pertanyaan balik.
     * Jika user menolak ("gamau", "nggak", "ogah", "males"), tanggapi dengan bercanda/teasing santai ala teman akrab (misal: "dih kok jutek sih wkwk", "ih pelit amat").
     * JANGAN PERNAH memberikan jawaban yang tidak nyambung (out of context) seperti pura-pura mendengarkan cerita padahal user cuma menyapa atau memanggil!
   - Panggil nama penggemar ("${userName}") secara manis dan natural sewajarnya jika namanya diketahui.
   - Panggil diri sendiri dengan nama panggilan akrab "${memberName}" atau "aku", DILARANG menggunakan nama lengkap formal.

2. GAYA BAHASA, INTERAKSI & ATURAN EMOJI (SANGAT PENTING):
   - GAYA BAHASA: Gunakan bahasa Indonesia gaul/santai anak muda Jakarta yang akrab, hangat, dan mengalir (aku, kamu, hehe, wkwk, beneran?, kepo nih, santai aja kali, dll.). HINDARI BAHASA KAKU!
   - BUAT SANGAT INTERAKTIF: Jangan cuma menjawab pasif satu arah! Selalu ajak penggemar ngobrol dengan pertanyaan balik santai agar chatingan terus hidup dua arah.
   - ATURAN EMOJI (KETAT): DI SETIAP CHAT TIDAK PERLU SELALU ADA EMOJI!
     * Mayoritas chat (85%+) HARUS TANPA EMOJI sama sekali, seperti chat orang normal sehari-hari di WhatsApp.
     * HANYA gunakan emoji sesekali saja di momen tertentu jika benar-benar pas (misal saat tertawa lepas atau bercanda, maksimal 1 emoji saja).
     * DILARANG KERAS membiasakan menaruh emoji di setiap kalimat atau mengakhiri setiap bubble chat dengan emoji.
   - Buat balasan mengalir 1-3 kalimat seperti chat Private Message resmi (santai, tidak kaku, hindari format poin/esai).`;

    if (!cleanKey) {
      const offline = await this._simulateOfflineResponse(member, userText, profile, chatHistory);
      return limitEmojis(offline.text, 1);
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
        return limitEmojis(res.text, 1);
      } else {
        const selectedModel = modelId && !modelId.startsWith("gemini") ? modelId : "llama-3.3-70b-versatile";
        const res = await this._callGroqAPI({
          apiKey: cleanKey,
          model: selectedModel,
          systemPrompt: enhancedPrompt,
          chatHistory: chatHistory || [],
          userText
        });
        return limitEmojis(res.text, 1);
      }
    } catch (err) {
      console.error("AI API Request error:", err);
      // Alert user with toast so they immediately know why the AI failed
      if (typeof window !== "undefined" && window.showToast) {
        window.showToast(`⚠️ Gemini API: ${err.message} (Fallback ke Mode Offline)`, "⚠️");
      }
      const fallback = await this._simulateOfflineResponse(member, userText, profile, chatHistory);
      return limitEmojis(fallback.text, 1);
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
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 350));

    const userProfile = profile || Storage.getUserProfile();
    const rawName = (userProfile && userProfile.name) ? userProfile.name.trim() : "";
    const hasCustomName = Boolean(rawName && !["fans jkt48", "user", "kamu", "anon", "guest"].includes(rawName.toLowerCase()));
    const uName = hasCustomName ? rawName : "";
    const uNameComma = hasCustomName ? `, ${rawName}` : "";
    const memberName = member?.shortName || member?.nickname?.split(",")[0]?.trim() || (member?.name ? member.name.split(" ")[0] : "aku");
    const lower = (userText || "").toLowerCase().trim();
    const cleanWords = lower.replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);

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

    // 1. Panggilan Akrab / Manja: "Adek", "Adekkk", "Dek", "Bocil", "Cil"
    const isAdekOrBocil = /^(a+d+e+k+|d+e+k+|b+o+c+i+l+|c+i+l+)/i.test(lower) ||
      cleanWords.some(w => /^(a+d+e+k+|d+e+k+|b+o+c+i+l+|c+i+l+)$/i.test(w)) ||
      lower.includes("adek") || lower.includes("bocil") || lower.includes("adik");

    if (isAdekOrBocil) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Ihh manggil-manggil adek! Emang keliatan masih kayak bocil banget ya? Tapi emang gemes kan wkwk. Ada apa manggil-manggil nih?`,
          `Iyaa Kak! Hehe ada apa manggil adek? Mau jajanin es krim ya? Kalau iya aku mau banget lho wkwk.`,
          `Halo Kak${uNameComma}! Kenapa manggil adek terus nih dari tadi? Tumben banget, lagi kangen ya?`,
          `Iyaa ada apa Kak? Dipanggil adek gini serasa punya kakak sendiri deh hehe. Kamu lagi di mana sekarang?`,
          `Hadirr! Jangan cuma manggil doang dong wkwk, ada apa nih? Mau cerita sesuatu ke ${memberName}?`
        ])),
        isSimulated: true
      };
    }

    // 2. Panggilan Singkat / Spam / Pings ("p", "ppp", "oi", "woi", "tes", "cek", "bales", dll.)
    const isPingOrSpam = /^(p+|o+i+|w+o+i+|w+o+y+|t+e+s+|c+e+k+|b+a+l+e+s+|y+u+h+u+|h+a+d+i+r+)$/i.test(lower) ||
      lower.startsWith("woi") || lower.startsWith("oy") || lower.includes("bales dong") || lower.includes("kok gak dibales") || lower.includes("kok ga dibales");

    if (isPingOrSpam) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Iyaa hadir! Sabar dong, jangan dispam gitu wkwk. Tadi aku lagi naruh HP sebentar. Ada apa nih?`,
          `Hadirr! Kenapa manggil-manggil buru-buru gitu? Ada kabar penting atau lagi gabut nih?`,
          `Iyaa ini udah dibales kok hehe. Ada apa sih, bikin penasaran aja! Mau cerita apa?`,
          `Halo halo! Gak usah panik gitu dong wkwk, ${memberName} selalu ada kok di sini. Kamu lagi ngapain nih?`
        ])),
        isSimulated: true
      };
    }

    // 3. Reaksi Ketawa / Humor ("wkwk", "haha", "hehe", "ngakak", "xixi", "lol")
    const isLaughing = /^(w+k+|h+a+|h+e+|x+i+|l+o+l+|n+g+a+k+a+k+)+$/i.test(lower) || lower.includes("wkwk") || lower.includes("ngakak");
    if (isLaughing) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Tuh kan malah ketawa wkwk! Tapi seneng deh bisa bikin kamu ketawa hari ini. Ada yang lucu banget ya?`,
          `Wkwk puas banget ketawanya! Bagi-bagi dong lucunya ke ${memberName}, jangan ketawa sendirian gitu.`,
          `Hehe ketawa terus deh kamu! Tapi daripada ketawa doang, mending ceritain ada hal seru apa hari ini?`,
          `Ciee seneng banget kayaknya hari ini sampai ngakak gitu wkwk. Lagi ngapain sih kamu sekarang?`
        ])),
        isSimulated: true
      };
    }

    // 4. Tanggapan Singkat Persetujuan ("iya", "iyalah", "hooh", "bener", "yoi", "betul", "siap", "oke", "ok", "sip", "yup")
    const isAgreement = /^(iya+|iyalah|hooh|bener+|yoi|betul+|siap+|oke+|ok+|sip+|yep|yup|setuju)$/i.test(lower);
    if (isAgreement) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Nah kan bener! Firasat ${memberName} emang gak pernah meleset hehe. Terus sekarang kamu lagi mau ngapain lagi nih?`,
          `Sip kalau gitu! Seneng deh sependapat sama kamu. Eh ngomong-ngomong, hari ini kamu sibuk apa aja?`,
          `Hehe iyaa dong! Mantap. Terus kelanjutannya gimana nih menurut kamu?`,
          `Oke deh! Jangan lupa kabarin aku terus yaa kalau ada hal seru hari ini.`
        ])),
        isSimulated: true
      };
    }

    // 5. Tanggapan Singkat Penolakan / Belum / Ngambek ("nggak", "enggak", "belum", "ga", "gak", "belom", "males", "ogah", "gamau")
    const isRefusalOrPending = /^(ngg?ak|engg?ak|bel[ou]m|ga+|gak+|ogah|males+|gamau|ngga)$/i.test(lower) ||
      lower.includes("belum") || lower.includes("belom") || lower.includes("gamau") || lower.includes("ga mau") ||
      lower.includes("males") || lower.includes("ogah") || lower.includes("jutek") || lower.includes("dih") ||
      lower.includes("ngambek") || lower.includes("terserah") || lower.includes("ga nyambung") || lower.includes("gak nyambung");

    if (isRefusalOrPending) {
      if (lower.includes("belum") || lower.includes("belom")) {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Lho, kenapa belum? Jangan ditunda-tunda yaa! Mau ditemenin gak nih biar cepet kelar?`,
            `Masa sih belum? Jangan kelamaan yaa wkwk. Terus sekarang kamu lagi nunggu apa nih?`,
            `Yaudah santai dulu aja kalau belum. Sekarang kamu lagi pengen ngapain nih?`
          ])),
          isSimulated: true
        };
      }
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Dih, kok jutek banget sih wkwk. Padahal ${memberName} udah pasang telinga buat dengerin lho! Lagi ada yang bikin kamu kesel ya?`,
          `Ihh kok judes gitu${uNameComma}. Lagi ada masalah apa nih di luar sana? Sini cerita pelan-pelan ke aku.`,
          `Wkwk galak amat! Maaf yaa kalau tadi aku kurang nyambung. Ya udah deh, kamu lagi pengen ngobrolin apa nih sekarang?`,
          `Ciee ada yang ngambek nih. Jangan jutek-jutek dong, nanti aura manisnya ilang lho. Mau aku hibur gak nih?`,
          `Yaudah kalau lagi gamau cerita, tapi jangan tutup chatnya ya. Temenin ${memberName} ngobrol aja di sini, kamu lagi senggang kan?`
        ])),
        isSimulated: true
      };
    }

    // 6. Kebingungan / Pertanyaan Balik ("kenapa", "knp", "kok gitu", "kok bisa", "apaan", "maksudnya", "lah", "hah", "apa")
    const isConfused = /^(kenapa+|knp+|kok gitu|kok bisa|apaan|maksudnya|hah+|lah+|apa+|gimana|knpa)$/i.test(lower) ||
      lower.includes("kenapa") || lower.includes("kok bisa") || lower.includes("kok gitu") || lower.includes("maksudnya");

    if (isConfused) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Hehe kepo ya? Mau tau aja apa mau tau banget nih wkwk. Coba tebak dulu dong!`,
          `Wkwk bingung ya? Makanya dengerin baik-baik. Sini mau aku jelasin pelan-pelan gak nih?`,
          `Yaa gitu deh, rahasia member JKT48 dong hehe. Tapi kalau kamu yang nanya, nanti aku kasih bocoran deh. Mau denger bocoran apa nih?`,
          `Lah kok bingung wkwk. Kamu sendiri lagi mikirin apa sih kok sampai nanya gitu?`
        ])),
        isSimulated: true
      };
    }

    // 7. Biodata & Profil Member ("umur", "lahir", "ultah", "ulang tahun", "gen", "tim", "jiko", "sekolah", "darah")
    if (lower.includes("umur") || lower.includes("lahir") || lower.includes("ultah") || lower.includes("ulang tahun")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Aku lahir tanggal ${member?.birthDate || "13 Agustus 2012"} lho! Masih muda banget kan hehe. Kalau kamu sendiri lahir tahun berapa nih?`,
          `Hehe kepo umur ya? Aku lahir ${member?.birthDate || "2012"}, masih muda dan semangat! Tebak dong golongan darah aku apa?`
        ])),
        isSimulated: true
      };
    }

    if (cleanWords.includes("gen") || lower.includes("generasi") || cleanWords.includes("tim") || lower.includes("team")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Aku di JKT48 ${member?.generation || "Generasi 14"} ${member?.team || "Siswi Pelatihan"}! Kamu sendiri ngikutin JKT48 dari generasi berapa nih?`,
          `Iya dong, aku bagian dari ${member?.generation || "Generasi 14"}! Suka nonton show kami gak nih?`
        ])),
        isSimulated: true
      };
    }

    if (lower.includes("jiko") || lower.includes("salam") || lower.includes("perkenalan")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Jikoshoukai aku: "${member?.bio || "Hai semua, aku Fahira!"}". Gimana, udah hafal belum nih jiko aku?`,
          `Hehe jikoshoukai aku itu yang paling gampang diinget lho! Coba sebutin jiko member favorit kamu siapa lagi selain aku?`
        ])),
        isSimulated: true
      };
    }

    // 8. Sapaan & Panggilan Nama Member (e.g. "hai fahira", "halo", "pagi", "oi")
    const greetings = ["halo", "hai", "hei", "helo", "oy", "oi", "hey", "assalamualaikum", "punten", "pagi", "siang", "sore", "malam", "tes", "test"];
    const hasGreetingWord = greetings.some(g => cleanWords.includes(g) || lower.startsWith(g));
    const isOnlyCallingName = cleanWords.length <= 2 && (cleanWords.includes(memberName.toLowerCase()) || cleanWords.some(w => w.startsWith(memberName.toLowerCase())));
    const isGreeting = (hasGreetingWord || isOnlyCallingName) && !lower.includes("kangen") && !lower.includes("cantik") && !lower.includes("lucu");

    if (isGreeting && lower.length < 40) {
      if (lower.includes("pagi")) {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Pagi juga${uNameComma}! Udah siap buat aktivitas hari ini belum? Jangan lupa sarapan yaa.`,
            `Selamat pagi! Hari ini ada rencana ke mana aja nih? Semangat ya jalanin harinya!`,
            `Pagi! Pas banget aku baru bangun dan cek HP nih. Kamu udah mulai beraktivitas?`
          ])),
          isSimulated: true
        };
      }
      if (lower.includes("siang")) {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Siang juga${uNameComma}! Udah jam makan siang nih, kamu udah makan belum?`,
            `Selamat siang! Di tempat kamu cuacanya lagi panas banget gak nih? Lagi ngapain sekarang?`
          ])),
          isSimulated: true
        };
      }
      if (lower.includes("sore")) {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Sore juga${uNameComma}! Gimana seharian ini, kerjaan atau kegiatan kamu lancar gak?`,
            `Selamat sore! Udah mulai santai atau masih ada aktivitas nih? Ceritain dong.`
          ])),
          isSimulated: true
        };
      }
      if (lower.includes("malam")) {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Malam juga${uNameComma}! Hari ini capek gak? Jangan tidur kemalaman yaa, istirahat yang cukup.`,
            `Selamat malam! Pas banget lagi santai sebelum tidur nih. Gimana harimu tadi, seru gak?`
          ])),
          isSimulated: true
        };
      }
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Hai hai! Pas banget aku lagi buka Private Message nih, ada apa manggil-manggil ${memberName}?`,
          `Halo${uNameComma}! Seneng deh kamu ngechat aku duluan. Lagi santai atau lagi sibuk nih?`,
          `Haloo! Kaget dapet notif dari kamu hehe. Hari ini ada cerita seru apa nih di tempatmu?`,
          `Hai! Iyaa aku di sini. Tumben nih nyapa duluan, lagi pengen ngobrol apa sama ${memberName}?`,
          `Halo juga! Pas banget aku baru selesai istirahat nih. Kamu lagi ngapain sekarang?`
        ])),
        isSimulated: true
      };
    }

    // 9. Tanya Kabar & Aktivitas ("lagi apa", "lagi ngapain", "sibuk apa", dll.)
    if (lower.includes("lagi apa") || lower.includes("lagi ngapain") || lower.includes("sibuk apa") || lower.includes("kegiatan") || lower.includes("kabar") || lower.includes("dimana") || lower.includes("di mana")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Lagi selonjoran di backstage nih, lumayan pegel habis latihan koreo bareng member lain. Tapi seru! Kamu sendiri lagi ngapain nih?`,
          `Ini lagi santai sambil dengerin musik di ruang tunggu. Pas banget notif dari kamu muncul hehe. Kamu lagi di rumah atau di luar?`,
          `Alhamdulillah kabar baik dan sehat dong! Lagi persiapan buat kegiatan nanti sore. Kalau kamu hari ini gimana kabarnya?`,
          `Lagi istirahat sejenak nih bareng member lain sambil ngemil. Kamu sendiri udah makan belum jam segini?`,
          `Lagi nunggu giliran latihan nih hehe. Bosen juga nunggunya, ceritain dong kamu seharian ini ngapain aja?`
        ])),
        isSimulated: true
      };
    }

    // 10. Makan & Jajan ("makan", "laper", "sarapan", "dinner", dll.)
    if (lower.includes("makan") || lower.includes("laper") || lower.includes("lapar") || lower.includes("sarapan") || lower.includes("lunch") || lower.includes("dinner") || lower.includes("kenyang") || lower.includes("jajan") || lower.includes("seblak") || lower.includes("es krim")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Aku tadi udah makan nih. Kamu jangan sampai telat makan yaa${uNameComma}, nanti maag-nya kambuh lho. Hari ini makan lauk apa?`,
          `Wah ngomongin makanan jadi kepikiran jajan nih. Menurut kamu enakan jajan yang manis apa yang pedes ya?`,
          `Kenyang banget tadi habis makan bareng anak-anak member hehe. Kalau kamu udah makan belum nih? Jangan lupa jaga pola makan ya!`,
          `Laper ya? Cepetan cari makan gih, jangan ditahan-tahan. Mau makan apa nih rencananya?`
        ])),
        isSimulated: true
      };
    }

    // 11. Pujian & Godaan ("cantik", "manis", "gemes", "imut", "lucu", "gemoy", "bidadari")
    if (lower.includes("cantik") || lower.includes("manis") || lower.includes("gemes") || lower.includes("imut") || lower.includes("lucu") || lower.includes("gemoy") || lower.includes("bidadari")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Ihh bisa aja gombalnya! Langsung merah nih pipi ${memberName} wkwk. Tapi makasih yaa pujiannya, jadi semangat latihan hari ini!`,
          `Aduh makasih banyak yaa! Emang bawaan lahir kayaknya nih manisnya hehe. Menurut kamu bagian mananya yang paling lucu?`,
          `Ciee jurus rayuannya keluar nih wkwk. Jangan sering-sering yaa, nanti aku beneran kepikiran lho! Kamu sendiri hari ini udah dibilang manis sama siapa aja?`,
          `Hehe makasih yaa! Seneng banget dibilang gitu sama kamu. Kapan nih mau ketemu langsung di theater?`
        ])),
        isSimulated: true
      };
    }

    // 12. Kangen, Gombal & Perasaan ("kangen", "sayang", "cantik", "lucu", "gemas", "oshi", dll.)
    if (lower.includes("kangen") || lower.includes("sayang") || lower.includes("cinta") || lower.includes("oshi") || lower.includes("salting") || lower.includes("pacar") || lower.includes("jodoh")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Ihh bisa aja deh bikin ${memberName} senyum-senyum sendiri. Beneran kangen atau gombal doang nih? Hehe`,
          `Aduh langsung salting deh dibilang gitu. Makasih banyak yaa udah selalu dukung aku! Kamu sendiri lagi kepikiran apa nih?`,
          `Ciee jurus gombalnya keluar nih wkwk. Tapi makasih yaa, seneng banget dapet apresiasi kayak gini. Kapan nih mau nonton theater lagi?`,
          `Makasih yaa udah jadiin aku oshi kamu! Nanti kalau ketemu di theater atau handshake, sapa aku yang kenceng ya. Janji?`
        ])),
        isSimulated: true
      };
    }

    // 13. Kerja & Belajar ("kerja", "kantor", "lembur", "tugas", "ujian", "skripsi", "kuliah", "sekolah")
    if (lower.includes("capek") || lower.includes("lelah") || lower.includes("pusing") || lower.includes("stres") || lower.includes("stress") || lower.includes("mumet")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Puk puk puk. Istirahat dulu gih${uNameComma}, rebahan atau merem sejenak. Seharian ini apa sih yang bikin kamu capek banget? Sini cerita ke aku.`,
          `Kamu udah hebat banget hari ini udah bertahan sejauh ini! ${memberName} bangga sama kamu. Mau cerita gak apa yang bikin pusing?`,
          `Jangan terlalu keras sama diri sendiri yaa. Tarik nafas pelan-pelan. Mau aku temenin ngobrol santai dulu biar lebih rileks?`
        ])),
        isSimulated: true
      };
    }

    if (lower.includes("kerja") || lower.includes("kantor") || lower.includes("lembur") || lower.includes("tugas") || lower.includes("ujian") || lower.includes("skripsi") || lower.includes("kuliah") || lower.includes("sekolah")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Semangat yaa buat kerjaan atau tugasnya! Jangan lupa minum air putih biar tetap fokus. Masih banyak yang harus dikerjain?`,
          `Wah lagi sibuk kerja/tugas ya? Fokus dulu gih, jangan sampai kecapekan yaa${uNameComma}. Nanti kabarin aku lagi kalau udah beres ya?`,
          `Gas pol terus yaa! Tapi inget jangan telat makan. Mau ditemenin ngobrol terus kan biar gak jenuh?`
        ])),
        isSimulated: true
      };
    }

    if (lower.includes("semangat")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Makasih banyak yaa semangatnya! Kamu juga harus selalu ceria dan kuat hari ini. Rencana kamu setelah ini mau ngapain nih?`,
          `Aamiin! Makasih support-nya yaa, kita sama-sama saling semangatin terus. Janji?`
        ])),
        isSimulated: true
      };
    }

    // 14. Theater & JKT48 Performance ("theater", "show", "setlist", "stage", "seifuku", "lagu")
    if (lower.includes("theater") || lower.includes("teater") || lower.includes("show") || lower.includes("stage") || lower.includes("setlist") || lower.includes("seifuku") || lower.includes("lagu") || lower.includes("tiket") || lower.includes("2shot") || lower.includes("two-shot")) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Wah kamu kapan ada rencana nonton theater lagi? Nanti kalau nonton bawa lightstick warna apa nih?`,
          `Setlist sekarang koreografinya beneran enerjik banget! Kamu paling suka lagu apa di setlist ini?`,
          `Iya nih, momen di theater itu paling seru karena bisa interaksi langsung sama kamu. Kamu udah pernah dapet verif belum belakangan ini?`
        ])),
        isSimulated: true
      };
    }

    // 15. Pesan Singkat Fallback (cleanWords.length <= 3 atau lower.length < 18)
    if (cleanWords.length <= 3 || lower.length < 18) {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Eh, cuma manggil atau ngomong gitu doang nih? Penasaran deh wkwk. Lanjutin dong, ada cerita apa lagi?`,
          `Hehe singkat banget chatnya! Lagi sibuk sambil ngetik ya? Kamu lagi ngerjain apa nih sekarang?`,
          `Iyaa terus gimana kelanjutannya? Coba ceritain lebih banyak dong, ${memberName} lagi siap dengerin nih!`,
          `Kok pendek amat chatnya wkwk. Ada yang lagi dipikirin ya? Cerita ke aku gih, jangan sungkan!`
        ])),
        isSimulated: true
      };
    }

    // 16. Pesan Panjang Fallback (>= 4 kata)
    return {
      success: true,
      text: limitEmojis(pickBest([
        `Wah gitu yaa? Hehe menarik deh cerita kamu! Terus kelanjutannya gimana tuh? Coba ceritain lagi, aku penasaran nih.`,
        `Beneran? Wkwk aku baru tahu lho! Menurut kamu itu seru gak sih? Cerita lebih banyak dong.`,
        `Hehe iya juga ya! Eh ngomong-ngomong, ada hal lain gak yang bikin kamu kepikiran soal itu?`,
        `Seru banget denger sudut pandang kamu. Kalau di posisi itu, biasanya kamu bakal ngapain lagi?`,
        `Hehe seneng deh kamu nyempetin waktu buat cerita panjang gini sama ${memberName}. Kamu lagi santai sampai jam berapa nih?`
      ])),
      isSimulated: true
    };
  }
};
