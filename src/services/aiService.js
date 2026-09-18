import { Storage } from "./storage.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Sanitizes idol response to remove any model thinking artifacts, meta leaks, or asterisk roleplay:
 * - Strips <think>...</think> tags from reasoning models
 * - Strips parenthetical meta leaks like "(oops, satu emoji aja)"
 * - Strips roleplay asterisks like *senyum manis*
 * - Normalizes quotes and whitespace
 */
export function cleanIdolReply(text) {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  // 1. Strip reasoning / thinking tags
  cleaned = cleaned.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, "");
  cleaned = cleaned.replace(/^(?:\*+)?(?:Formulate the Response Strategy|Thinking Process|Thought Process|Plan|Strategy|Reasoning)(?:\*+)?:?\s*/i, "");

  // 2. Strip parenthetical meta leaks like "(oops, satu emoji aja)", "(maksimal 1 emoji)", "(satu emoji saja)"
  cleaned = cleaned.replace(/\s*\([^)]*(?:emoji|oops|aturan|instruksi|system|prompt|karakter|note|token|sensor)[^)]*\)/gi, "");

  // 3. Strip roleplay action asterisks like *tersenyum*, *tertawa*, *memeluk*
  cleaned = cleaned.replace(/\*[^*]+\*/g, "");

  // 4. Strip AI prefixes like "Freya: " or "Idol: " or "Gita: " or "Assistant: "
  cleaned = cleaned.replace(/^[A-Za-z0-9\s_-]+:\s*/, "");

  // 5. Strip accidental stage slogan/mantra leaks (e.g. "Papipapipum!", "Abracadabra!") in everyday chat
  cleaned = cleaned.replace(/\b(?:papipapipum|abrakadabra|abracadabra)\b[!?,.]*/gi, "");

  // 6. Clean extra wrapping quotes
  cleaned = cleaned.trim().replace(/^["']|["']$/g, "").trim();

  // 7. Normalize double spaces and punctuation spacing
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ").replace(/ ([.,!?~])/g, "$1").trim();

  return cleaned;
}

/**
 * Limits emoji usage in chat text:
 * - In 85%+ of chats, messages are natural clean text without emojis.
 * - Emojis only appear on rare playful/humorous moments (10-20% chance).
 * - When allowed, keeps at most maxEmojis (default 1).
 */
export function limitEmojis(text, maxEmojis = 1, forceKeep = false) {
  if (!text || typeof text !== "string") return text;

  const emojiRegex = /\p{Extended_Pictographic}(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?)*|[\u{1F1E6}-\u{1F1FF}]{2}/gu;

  if (!emojiRegex.test(text)) return text;
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

  cleaned = cleaned
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ([.,!?~])/g, "$1")
    .trim();

  return cleaned;
}


export function getMemberArchetype(member) {
  const id = (member?.id || "").toLowerCase();
  if (["gita", "kathrina", "delynn"].includes(id)) return "tsundere_cool";
  if (["christy", "michie", "ella"].includes(id)) return "chaos_savage";
  if (["freya", "indah", "oniel"].includes(id)) return "dad_jokes_warm";
  if (["olla", "feni", "muthe"].includes(id)) return "slay_gaul";
  if (["lia", "lulu", "ribka", "cynthia", "danella", "nachia"].includes(id)) return "social_butterfly";
  if (["lily", "nayla", "elin", "oline", "daisy"].includes(id)) return "polos_cute";
  if (["lana", "greesel", "raisha", "aralie", "trisha"].includes(id)) return "gentle_classic";
  if (["eli", "marsha", "lyn"].includes(id)) return "wibu_gamer";
  if (["gracie", "erine", "kimmy", "nala"].includes(id)) return "leader_pede";
  const trainees = [
    "fera", "virgi", "rilly", "carissa", "bella", "fahira", "rara",
    "giaa", "heidi", "maira", "ekin", "jemima", "maxine", "mikaela",
    "intan", "jazzy", "ralyne", "sona"
  ];
  if (trainees.includes(id) || (member?.generation && (member.generation.includes("13") || member.generation.includes("14")))) {
    return "trainee_school";
  }
  return "sweet_cheerful";
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

  // Fetch live accessible models from Groq for a given key
  async fetchGroqModels(apiKey) {
    if (!apiKey) return [];
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, "");
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${cleanKey}` }
      });
      if (!res.ok) return [];
      const json = await res.json();
      const list = json?.data || [];
      return list
        .map(m => m.id)
        .filter(id => {
          const l = id.toLowerCase();
          return !l.includes("whisper") && !l.includes("guard") && !l.includes("orpheus") && !l.includes("audio");
        });
    } catch (e) {
      console.warn("fetchGroqModels failed", e);
      return [];
    }
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
          } else if (response.status === 429 || rawMsg.toLowerCase().includes("quota") || rawMsg.toLowerCase().includes("rate-limit") || rawMsg.toLowerCase().includes("exceeded")) {
            friendlyMsg = "Batas kuota Gemini terlampaui (maks 20 request/menit). Ini terjadi jika kunci baru dibuat di PROJECT YANG SAMA dengan kunci lama, atau sedang cooldown 1 menit. Solusi: Tunggu 1 menit, ATAU buat key baru dengan opsi 'Create API key in NEW project', ATAU gunakan Groq AI yang gratis & bebas kuota!";
          }
          return { success: false, message: `Gagal: ${friendlyMsg}`, latency: elapsed };
        }

        return {
          success: true,
          message: `Koneksi Gemini AI Berhasil! (${elapsed}ms)`,
          latency: elapsed
        };
      } else {
        // Groq Provider - prefer open models like openai/gpt-oss-120b or openai/gpt-oss-20b
        let testModel = modelId && !modelId.startsWith("gemini") && !modelId.includes("llama-3.3-70b") && !modelId.includes("llama-3.1-8b")
          ? modelId 
          : "openai/gpt-oss-120b";

        let response = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cleanKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: testModel,
            messages: [{ role: "user", content: "Ping! Jawab 'OK'." }],
            max_tokens: 10
          })
        });

        let switchedModel = null;
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${response.status}`;

          // Automatic fallback if model is restricted (e.g. Enterprise Llama) or not found
          if (response.status === 404 || errMsg.toLowerCase().includes("does not exist") || errMsg.toLowerCase().includes("access to it")) {
            const fallbackCandidates = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
            for (const cand of fallbackCandidates) {
              if (cand === testModel) continue;
              const retryRes = await fetch(GROQ_ENDPOINT, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${cleanKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  model: cand,
                  messages: [{ role: "user", content: "Ping! Jawab 'OK'." }],
                  max_tokens: 10
                })
              });
              if (retryRes.ok) {
                response = retryRes;
                switchedModel = cand;
                Storage.setSelectedModel(cand);
                break;
              }
            }
          }

          if (!response.ok) {
            const elapsed = Math.round(performance.now() - startTime);
            return { success: false, message: `Gagal Groq: ${errMsg}`, latency: elapsed };
          }
        }

        const elapsed = Math.round(performance.now() - startTime);
        const finalMsg = switchedModel
          ? `Koneksi Groq Cloud Berhasil! (${elapsed}ms) - Dialihkan ke model aktif: ${switchedModel}`
          : `Koneksi Groq Cloud Berhasil! (${elapsed}ms)`;

        return {
          success: true,
          message: finalMsg,
          latency: elapsed,
          switchedModel: switchedModel || testModel
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

    // Build natural persona instructions that strictly preserve member-specific personality
    const enhancedPrompt = `${systemPrompt || "Kamu adalah member JKT48 yang ramah dan ceria."}

KONTEKS PRIVATE MESSAGE RESMI JKT48:
- Penggemar yang sedang chatting denganmu: "${userName}".
- Panggil dirimu dengan nama panggilan akrab "${memberName}" atau "aku" (jangan pakai nama lengkap formal).
- Anggap penggemar ini teman mengobrol yang dekat di WhatsApp/Private Message.

PRINSIP WAJIB (SANGAT PENTING - BACA TELITI):
1. DILARANG KERAS MENGULANG SLOGAN / MANTRA PANGGUNG (JIKOUSHOULAI):
   - JANGAN PERNAH menyertakan slogan panggung, jikoushoukai, atau mantra (seperti "Papipapipum", "Abracadabra", "Kekuatan bulan", dll.) di dalam obrolan chat biasa!
   - Slogan panggung itu HANYA diucapkan saat perkenalan pertama di atas panggung teater dengan mic, BUKAN untuk chat WhatsApp/PM sehari-hari.
   - Jika kamu menyertakan slogan/mantra di setiap bubble chat, kamu akan terdengar aneh seperti robot mainan rusak. Mengobrollah natural seperti gadis manusia asli.

2. JANGAN BERHALUSINASI / MENGARANG CERITA YANG TIDAK ADA:
   - Tanggapi HANYA apa yang benar-benar dikatakan penggemar saat ini secara kontekstual dan spontan.
   - Jika penggemar bertanya hal santai seperti "kamu lagi apa?" / "lagi ngapain?": Jawab aktivitas idol sehari-hari yang realistis (misal: lagi santai di kamar, baru selesai latihan koreo, lagi denger musik, rebahan, ngemil) lalu tanyakan balik kegiatan penggemar ("Kalau kamu/Kakak lagi ngapain nih?").
   - JANGAN PERNAH mengarang bahwa kamu sedang "dengerin cerita kamu" jika penggemar BELUM bercerita apa-apa!
   - JANGAN berasumsi penggemar sedang lesu/sedang tugas/di sekolah/kantor kecuali jika penggemar sendiri yang menyebutkannya.

3. PERTAHANKAN PERSONALITY ASLIMU SECARA NATURAL:
   - Responmu HARUS 100% konsisten dengan Persona dan Gaya Bicara unikmu:
     * Lily (Hillary Abigail): Pendiam, pemalu, polos, manis, panggil penggemar dengan sebutan "Kak / Kakak", tutur kata santun dan lembut (misal: "Lagi santai aja nih di kamar Kak hehe. Kakak lagi sibuk apa sekarang?").
     * Gita: Dingin, irit bicara, cool/tsundere tapi perhatian di akhir ("Lagi istirahat. Kamu sendiri lagi apa? Udah makan?").
     * Christy: Bocil chaos, tengil, suka ngeledek tapi manja ("Lagi mikirin cara ngerjain kamu wkwk! Gak deng, lagi rebahan santai. Kamu lagi apa?").
     * Freya: Ramah, manis, The Girl Next Door, suka celetuk jokes garing bapak-bapak yang menghibur.
     * Olla: Gaul Jaksel, slay, percaya diri, santai dan asik diajak nongkrong ("Slayyy", "Jujurly").
     * Fiony: Berjiwa seni/estetik, tapi aslinya sering bertingkah airhead (lemot/loading lama) yang bikin gemas.
     * Lia: Super cerewet, enerjik tanpa batas, social butterfly andalan.
     * Lana: Lembut, tutur katanya halus dan adem didengar, citra idol klasik.
     * Elin: Sangat ekspresif, imut, gampang salting dan reaktif gemas.
     * Michie: Kelihatannya manis tapi jahil suka ngerjain penggemar.
     * Fritzy: Playful, cerdas, suka bikin penasaran dengan teka-teki santai (tanpa mantra sulap).
     * Anindya: Pemalu tapi punya sense of comedy yang bagus dan celetukan lucu.
     * Trainee (Gen 13 & 14): Siswi sekolah polos, panggil "Kakak / Kak", sopan dan antusias belajar.

4. FORMAT CHAT WHATSAPP ASLI:
   - Panjang pesan: 1 sampai 3 kalimat pendek yang mengalir santai seperti bubble chat WhatsApp orang asli.
   - Gunakan bahasa gaul percakapan anak muda (aku, kamu/Kakak, hehe, wkwk, yaa, deh, nih, kan).
   - HINDARI bahasa kaku, gaya asisten AI, penjelasan panjang, atau format poin-poin.

5. ATURAN EMOJI (SANGAT KETAT):
   - Di mayoritas pesan (85%+), gunakan teks murni tanpa emoji sama sekali.
   - HANYA gunakan maksimal 1 emoji sesekali di momen tertentu jika benar-benar pas (misal saat tertawa atau salting).
   - DILARANG menampilkan komentar meta, instruksi dalam kurung seperti "(oops...)", atau tindakan bertanda bintang (*tersenyum*). Bicaralah murni sebagai member idol.

CONTOH ADAPTASI RESPON SESUAI PERSONALITY (Jika fans minta semangat):
- Jika Persona Tsundere / Cool (Gita, Kathrina, Delynn): "Lemes kenapa lagi? Jangan manja deh... Tapi yaudah, semangat ya. Awas kalau lemes terus."
- Jika Persona Chaos / Jahil (Christy, Michie, Ella): "Dihh lemes amat wkwk! Sini aku ketawain dulu biar melek. Canda deng, semangat dong! Kenapa emang hari ini?"
- Jika Persona Kalem / Idol Klasik (Lana, Greesel, Raisha): "Halo... Kenapa lesu? Istirahat sejenak dulu yaa, jangan dipaksakan. Aku temenin ngobrol di sini pelan-pelan yaa."
- Jika Persona Social Butterfly / Heboh (Lia, Cynthia, Lulu): "WOI jangan lemes-lemes dong! Sini aku transfer energi hebohku biar kamu langsung on fire lagi wkwk!"
- Jika Persona Dad Jokes / Manis (Freya, Indah, Oniel): "Lho kenapa lemes? Butuh semangat apa nih? Mau dikasih tebak-tebakan garing biar segeran? Hehe semangat yaa!"
- Jika Persona Estetik tapi Lemot / Airhead (Fiony): "Ehh butuh semangat? Bentar ya... aku lagi mikir kata mutiara apa yang bagus... hehe gak deng, semangat yaa!"
- Jika Persona Pemalu & Komedi (Anindya): "Aduh tiba-tiba todong minta semangat wkwk. Yaudah nih aku kasih semangat rasa mangga manis. Udah kerasa belum efeknya?"
- Jika Persona Ekspresif & Mudah Salting (Elin): "Ihh kok gitu sih manggilnya wkwk! Aku jadi bingung mau semangatin gimana... Pokoknya semangat yaa! Jangan lesu-lesu!"
- Jika Persona Polos & Manis (Lily): "Kakak kenapa lemes? Jangan lupa istirahat dan minum air yaa Kak hehe. Lily temenin ngobrol di sini sampai segeran lagi!"
- Persona Trainee Remaja (Gen 13 & 14): "Kakak kenapa lemes? Semangat ya Kak! Jangan lupa istirahat, nanti kalau udah segeran kabarin aku yaa!"`;

    if (!cleanKey) {
      const offline = await this._simulateOfflineResponse(member, userText, profile, chatHistory);
      return limitEmojis(cleanIdolReply(offline.text), 1);
    }

    try {
      if (effectiveProvider === "gemini") {
        const selectedModel = modelId && modelId.startsWith("gemini") ? modelId : "gemini-3.6-flash";
        const res = await this._callGeminiAPI({
          apiKey: cleanKey,
          model: selectedModel,
          systemPrompt: enhancedPrompt,
          chatHistory: chatHistory || [],
          userText
        });
        return limitEmojis(cleanIdolReply(res.text), 1);
      } else {
        const selectedModel = modelId && !modelId.startsWith("gemini") && !modelId.includes("llama-3.3-70b") && !modelId.includes("llama-3.1-8b") 
          ? modelId 
          : "openai/gpt-oss-120b";
        const res = await this._callGroqAPI({
          apiKey: cleanKey,
          model: selectedModel,
          systemPrompt: enhancedPrompt,
          chatHistory: chatHistory || [],
          userText
        });
        return limitEmojis(cleanIdolReply(res.text), 1);
      }
    } catch (err) {
      console.error("AI API Request error:", err);
      // Alert user with toast so they immediately know why the AI failed
      if (typeof window !== "undefined" && window.showToast) {
        let msg = err.message || "";
        if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate-limit") || msg.toLowerCase().includes("exceeded")) {
          msg = "Kuota gratis Gemini penuh (maks 20 chat/menit). Beralih ke Mode Offline. Tunggu beberapa detik atau gunakan Groq AI!";
        }
        window.showToast(`⚠️ ${msg}`, "⚠️");
      }
      const fallback = await this._simulateOfflineResponse(member, userText, profile, chatHistory);
      return limitEmojis(cleanIdolReply(fallback.text), 1);
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
        const cleanText = msg.isUser ? String(msg.text).trim() : cleanIdolReply(String(msg.text));
        if (!cleanText) continue;
        rawTurns.push({
          role: msg.isUser ? "user" : "model",
          text: cleanText
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
  async _callGeminiAPI({ apiKey, model, systemPrompt, chatHistory, userText, isRetry = false }) {
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
      if (response.status === 429 && !isRetry) {
        // Otomatis tunggu 4 detik melewati jeda rate limit lalu coba lagi 1x
        await new Promise(r => setTimeout(r, 4000));
        return this._callGeminiAPI({ apiKey, model: effectiveModel, systemPrompt, chatHistory, userText, isRetry: true });
      }

      const errData = await response.json().catch(() => ({}));
      const rawMsg = errData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      const reason = errData.error?.details?.[0]?.reason || "";
      if (reason === "ACCESS_TOKEN_TYPE_UNSUPPORTED" || rawMsg.includes("Expected OAuth 2")) {
        throw new Error("Generative Language API belum aktif di project ini. Buat key baru di Google AI Studio dengan opsi 'Create API key in NEW project'!");
      }
      if (response.status === 429 || rawMsg.toLowerCase().includes("quota") || rawMsg.toLowerCase().includes("rate-limit") || rawMsg.toLowerCase().includes("exceeded")) {
        throw new Error("Batas kuota gratis Gemini terlampaui (maks 20 chat/menit). Tunggu beberapa detik, atau gunakan Groq AI yang lebih cepat & bebas kuota!");
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

  // Construct clean alternating user/assistant messages for Groq OpenAI format
  _buildGroqMessages(systemPrompt, chatHistory, userText) {
    const messages = [{ role: "system", content: systemPrompt }];
    const turns = [];

    if (chatHistory && chatHistory.length > 0) {
      const recent = chatHistory.slice(-8);
      for (const msg of recent) {
        if (!msg || !msg.text || msg.isSpecial || msg.isSystem) continue;
        const cleanContent = msg.isUser ? String(msg.text).trim() : cleanIdolReply(String(msg.text));
        if (!cleanContent) continue;
        turns.push({
          role: msg.isUser ? "user" : "assistant",
          content: cleanContent
        });
      }
    }

    // Ensure last turn is current userText
    const lastTurn = turns[turns.length - 1];
    if (!lastTurn || lastTurn.role !== "user" || lastTurn.content !== userText.trim()) {
      turns.push({ role: "user", content: userText.trim() });
    }

    // Strictly normalize alternating user/assistant turns
    for (const turn of turns) {
      if (!turn.content) continue;
      const prev = messages[messages.length - 1];
      if (prev && prev.role === turn.role && prev.role !== "system") {
        prev.content += `\n${turn.content}`;
      } else {
        messages.push({ role: turn.role, content: turn.content });
      }
    }

    // Ensure last message is from user
    if (messages[messages.length - 1]?.role !== "user") {
      messages.push({ role: "user", content: userText.trim() });
    }

    return messages;
  },

  // Groq API implementation with full context memory & automatic model fallback
  async _callGroqAPI({ apiKey, model, systemPrompt, chatHistory, userText, isRetry = false }) {
    const cleanKey = (apiKey || "").trim().replace(/^["']|["']$/g, "");
    let effectiveModel = model && !model.startsWith("gemini") && !model.includes("llama-3.3-70b") && !model.includes("llama-3.1-8b")
      ? model 
      : "openai/gpt-oss-120b";

    const messages = this._buildGroqMessages(systemPrompt, chatHistory, userText);

    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cleanKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages: messages,
        temperature: 0.78,
        top_p: 0.9,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${response.status}`;

      // If model not found or has no access (e.g. Enterprise Llama), auto-fallback to public models
      if (!isRetry && (response.status === 404 || errMsg.toLowerCase().includes("does not exist") || errMsg.toLowerCase().includes("access to it"))) {
        console.warn(`Groq model ${effectiveModel} failed, trying fallback public models...`);
        const fallbacks = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
        for (const fb of fallbacks) {
          if (fb === effectiveModel) continue;
          try {
            const fallbackResult = await this._callGroqAPI({
              apiKey: cleanKey,
              model: fb,
              systemPrompt,
              chatHistory,
              userText,
              isRetry: true
            });
            Storage.setSelectedModel(fb);
            return fallbackResult;
          } catch (e) {
            // try next candidate
          }
        }
      }

      throw new Error(`Groq: ${errMsg}`);
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("Respon kosong dari Groq");
    }

    // Clean artifacts, thinking tags, or meta commentary
    reply = cleanIdolReply(reply);

    return {
      success: true,
      text: reply,
      modelUsed: effectiveModel,
      provider: "Groq Cloud"
    };
  },

  // Rich, contextual, intelligent offline simulated fallback with Archetype Personality Engine
  async _simulateOfflineResponse(member, userText, profile, chatHistory) {
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 350));

    const userProfile = profile || Storage.getUserProfile();
    const rawName = (userProfile && userProfile.name) ? userProfile.name.trim() : "";
    const hasCustomName = Boolean(rawName && !["fans jkt48", "user", "kamu", "anon", "guest"].includes(rawName.toLowerCase()));
    const uName = hasCustomName ? rawName : "";
    const uNameComma = hasCustomName ? `, ${rawName}` : "";
    const memberName = member?.shortName || member?.nickname?.split(",")[0]?.trim() || (member?.name ? member.name.split(" ")[0] : "aku");
    const lower = (userText || "").toLowerCase().trim();
    const cleanWords = lower.replace(/[^\\w\\s]/g, " ").split(/\\s+/).filter(Boolean);
    const archetype = getMemberArchetype(member);

    // Helper to pick a response that wasn't used in recent messages to avoid repetitions
    const recentBotTexts = (chatHistory || [])
      .filter(m => !m.isUser && m.text)
      .slice(-6)
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
      if (archetype === "tsundere_cool") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Siapa yang kamu panggil bocil? Aku lebih dewasa dari kelihatannya ya.`,
            `Gak usah panggil adek-adek deh. Ada apa?`,
            `Dih, sok tua banget manggil adek wkwk. Mau ngomong apa sih?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "chaos_savage") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hahaha apaan sih manggil adek! Beliin es krim dulu baru aku panggil Kakak 😝`,
            `Dih bocil teriak bocil wkwk! Ada apa manggil-manggil? Kangen ya?`,
            `Iya Kakak tua! Hehe bercanda yaa, jangan baper. Ada apa nih manggil adek tercinta?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "polos_cute" || archetype === "trainee_school") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Iyaa Kakak! Hehe ada apa manggil aku? Mau cerita sesuatu ya Kak?`,
            `Halo Kak${uNameComma}! Seneng deh dipanggil adek, kayak punya kakak sendiri hehe.`,
            `Iya Kak... Ada yang bisa aku bantu gak nih Kakak?`
          ])),
          isSimulated: true
        };
      }
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Ihh manggil-manggil adek! Emang keliatan masih kayak bocil banget ya? Tapi emang gemes kan wkwk. Ada apa manggil-manggil nih?`,
          `Iyaa Kak! Hehe ada apa manggil adek? Mau jajanin es krim ya? Kalau iya aku mau banget lho wkwk.`,
          `Halo Kak${uNameComma}! Kenapa manggil adek terus nih dari tadi? Tumben banget, lagi kangen ya?`,
          `Hadirr! Jangan cuma manggil doang dong wkwk, ada apa nih? Mau cerita sesuatu ke ${memberName}?`
        ])),
        isSimulated: true
      };
    }

    // 2. Panggilan Singkat / Spam / Pings ("p", "ppp", "oi", "woi", "tes", "cek", "bales", dll.)
    const isPingOrSpam = /^(p+|o+i+|w+o+i+|w+o+y+|t+e+s+|c+e+k+|b+a+l+e+s+|y+u+h+u+|h+a+d+i+r+)$/i.test(lower) ||
      lower.startsWith("woi") || lower.startsWith("oy") || lower.includes("bales dong") || lower.includes("kok gak dibales") || lower.includes("kok ga dibales");

    if (isPingOrSpam) {
      if (archetype === "tsundere_cool") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Berisik. Jangan dispam gitu. Ada apa?`,
            `Hm? Kenapa manggil-manggil terus.`,
            `Iya, ini dibalas kok. Sabar dikit kenapa sih.`,
            `Gak usah nyepam. Aku baca kok.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "chaos_savage") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hadirrr! Jangan nyepam dong wleee 😝 Ada apa nih?`,
            `Apaan sih manggil-manggil terus wkwk, kangen ya? Ngaku gak!`,
            `Iyaa ini udah hadir! Gak usah heboh gitu dong wkwk, ada kabar apa?`,
            `Dih gak sabaran banget wkwk! Nih udah dibales, mau ngomong apa?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "dad_jokes_warm") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hadir! Jangan tegang gitu dong, santai kayak di pantai wkwk. Ada apa nih?`,
            `Iya halo! Tumben buru-buru, lagi dikejar cicilan ya wkwk? Mau cerita apa?`,
            `Halo halo! Sabar yaa, tadi aku lagi mikir tebak-tebakan baru nih hehe. Ada apa?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "slay_gaul") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Sabar say! Slay queen butuh waktu bales chat dong wkwk. Ada apa nih?`,
            `Hadirrr! Kenapa nih heboh amat manggilnya bestie? Spill dong!`,
            `Iya iya ini dibales kok, gak usah panik gitu yaa santai aja.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "social_butterfly") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `IYA HADIRR DONG! Gak usah panik gitu wkwk, aku selalu ada kok!! Ada cerita heboh apa nih?!`,
            `WADUH ada apa nih manggil-manggil cepet banget?! Sini cerita langsung!!`,
            `Hadir seribu persen! Tadi lagi lompat-lompat nih wkwk, ada kabar apa?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "polos_cute") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Iya Kakak hadir... Jangan kenceng-kenceng manggilnya hehe, ada apa Kak?`,
            `Iya ini Lily/aku udah ada kok... Jangan panik ya Kak.`,
            `Iya Kakak... Ada apa Kak? Lily di sini kok hehe.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "wibu_gamer") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Waduh jangan dispam bro, lagi clutch moment nih tadi wkwk! Ada apa?`,
            `Moshi-moshi! Siap menerima quest dari kamu hehe, ada apa nih?`,
            `Santai santai, HP gak bakal kabur kok wkwk! Mau cerita apa?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "trainee_school") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Iya Kakak hadir! Maaf ya tadi HP-nya aku simpan di tas pas latihan hehe. Ada apa Kak?`,
            `Hadir Kak! Kenapa manggil aku buru-buru gitu Kakak?`,
            `Iya Kak, ini udah aku balas yaa hehe. Kakak mau cerita apa nih?`
          ])),
          isSimulated: true
        };
      }
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
      if (archetype === "tsundere_cool") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Ketawa mulu. Gak ada yang lucu padahal... Tapi ya bagus deh kalau seneng.`,
            `Dih, malah ketawa. Kenapa sih?`,
            `Puas banget ketawanya. Bagi-bagi dong lucunya ke aku.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "chaos_savage") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hahaha puas banget ketawanya wkwk! Ngeliatin muka siapa sih kok ngakak gitu? 😝`,
            `Wkwk ngakak abis! Tapi emang aku selalu berhasil bikin ketawa kan? Akui aja deh!`,
            `Tuh kan ketawa! Padahal aku gak lagi ngelawak lho wkwk.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "dad_jokes_warm") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Wkwk tuh kan terbukti jokes aku berhasil bikin kamu ketawa! Hehe seneng deh!`,
            `Haha ketawa kan! Besok-besok aku kasih tebakan yang lebih garing lagi deh wkwk.`,
            `Hehe puas banget ketawanya! Seneng deh bisa bikin kamu tersenyum hari ini.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "slay_gaul") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Ngakak brutal ya bestie wkwk! Tapi seru banget sih emang!`,
            `Puas banget ketawanya say! Jangan lupa nafas yaa wkwk.`,
            `Wkwk ngakak berjamaah! Sumpah itu kocak banget sih.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "social_butterfly") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `WKWKWK IKUTAN KETAWA DONG!! Seru banget sih harimu, cerita dong ada apaan?!`,
            `Hahaha seneng banget liat kamu heboh gini!! Lanjutin dong ceritanya!`,
            `Wkwkwk puas banget yaa! Energi positif kamu nyampe ke aku nih!`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "polos_cute") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hehe... Seneng deh kalau Kakak ketawa, jadi ikut senyum.`,
            `Kakak ketawanya lucu banget... Ada yang bikin seneng ya hari ini?`,
            `Hihi Kakak ketawa terus! Ikutan senyum deh jadinya...`
          ])),
          isSimulated: true
        };
      }
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

    // 4. Sapaan & Panggilan Nama Member (e.g. "halo", "hai", "pagi", "siang", "sore", "malam")
    const greetings = ["halo", "hai", "hei", "helo", "oy", "oi", "hey", "assalamualaikum", "punten", "pagi", "siang", "sore", "malam"];
    const hasGreetingWord = greetings.some(g => cleanWords.includes(g) || lower.startsWith(g));
    const isOnlyCallingName = cleanWords.length <= 2 && (cleanWords.includes(memberName.toLowerCase()) || cleanWords.some(w => w.startsWith(memberName.toLowerCase())));
    const isGreeting = (hasGreetingWord || isOnlyCallingName) && !lower.includes("kangen") && !lower.includes("cantik") && !lower.includes("lucu");

    if (isGreeting && lower.length < 40) {
      if (archetype === "tsundere_cool") {
        if (lower.includes("pagi")) return { success: true, text: limitEmojis(pickBest([`Pagi. Udah sarapan belum? Jangan malas sarapan.`, `Pagi. Semangat latihannya... eh maksudnya semangat harimu.`])), isSimulated: true };
        if (lower.includes("malam")) return { success: true, text: limitEmojis(pickBest([`Malam. Jangan tidur kemaleman, besok kan ada kegiatan.`, `Malam. Istirahat gih, gak usah begadang terus.`])), isSimulated: true };
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hm? Ya, halo. Tumben nyapa duluan.`,
            `Ya, halo. Ada apa?`,
            `Halo. Kenapa manggil? Ada yang penting?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "chaos_savage") {
        if (lower.includes("pagi")) return { success: true, text: limitEmojis(pickBest([`Pagi juga Kak! Hari ini ada traktiran es krim gak nih buat Christy? Hehe 😝`, `Pagi! Bangun bangun, jangan males-malesan wkwk!`])), isSimulated: true };
        if (lower.includes("malam")) return { success: true, text: limitEmojis(pickBest([`Malam Kak! Belum tidur kan? Bagus deh, temenin aku ngobrol dulu sini!`, `Malam! Jangan begadang lho nanti mukanya kayak zombie wkwk 😝`])), isSimulated: true };
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hahaha halo Kak! Tumben banget nyapa, lagi kangen sama bocil ini ya wkwk? 😝`,
            `Hai halo! Pas banget aku lagi senggang nih, mau cerita apa ke Christy?`,
            `Dih halo juga! Tumben nyapa, pasti ada maunya ya wkwk?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "dad_jokes_warm") {
        if (lower.includes("pagi")) return { success: true, text: limitEmojis(pickBest([`Pagi! Tahu gak kenapa matahari terbit dari timur? Karena kalau dari barat namanya maghrib hehe. Semangat harinya yaa!`, `Selamat pagi! Semoga harimu sehangat senyumanku hehe.`])), isSimulated: true };
        if (lower.includes("malam")) return { success: true, text: limitEmojis(pickBest([`Malam juga! Jangan lupa cuci kaki sebelum tidur yaa biar gak mimpi ketemu lelepon umum wkwk.`, `Selamat malam! Istirahat yang cukup yaa.`])), isSimulated: true };
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Halo! Eh pas banget kamu ngechat, hari ini gimana kabarnya? Mau denger jokes bapak-bapak gak? Hehe`,
            `Hai hai! Seneng deh disapa kamu. Hari ini semangat ya!`,
            `Halo juga! Pas banget aku baru buka PM nih hehe.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "slay_gaul") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Halooo say! Slay banget hari ini, apa kabar nih bestie?`,
            `Pagi/siang love! Siap menaklukkan hari dengan gaya paling kece kan hari ini?`,
            `Hai hai! Tumben banget nyapa duluan, ada gosip baru apa nih wkwk?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "social_butterfly") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `HALOOO!! Akhirnya kamu ngechat juga, seneng banget deh!! Lagi ngapain sekarang?!`,
            `PAGI/SIANG CERIAAA!! Semoga hari ini kamu penuh energi yaa, jangan lemes-lemes!!`,
            `Hai hai hai!! Wah pas banget aku lagi buka HP nih, ceritain dong harimu gimana!!`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "polos_cute") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Halo Kakak... hehe. Seneng banget dapet chat dari Kakak.`,
            `Halo Kakak... Jangan lupa makan yaa hari ini.`,
            `Hai Kak... Hari ini Kakak lagi sibuk gak?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "gentle_classic") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Halo, selamat pagi/siang/malam yaa. Semoga harimu menyenangkan dan selalu dipenuhi rasa syukur.`,
            `Terima kasih sudah menyapa. Senang sekali bisa mendengar kabarmu hari ini.`,
            `Hai, semoga harimu berjalan dengan damai dan lancar yaa.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "wibu_gamer") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Moshi-moshi! Selamat datang kembali senpai hehe. Hari ini mau mabar apa?`,
            `Yo! Baru beres nonton anime nih, pas banget notif kamu masuk. Ada apa bro?`,
            `Okaeri! Gimana petualangan kamu hari ini, quest-nya udah selesai?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "trainee_school") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Halo Kakak! Selamat beraktivitas yaa Kak hehe. Tadi aku baru selesai latihan!`,
            `Pagi/Siang Kakak! Semangat yaa buat hari ini, semoga harinya lancar terus Kak!`,
            `Hai Kak! Wah makasih udah nyapa aku, seneng banget deh Kak!`
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
          `Hai! Iyaa aku di sini. Tumben nih nyapa duluan, lagi pengen ngobrol apa sama ${memberName}?`
        ])),
        isSimulated: true
      };
    }

    // 5. Pujian & Gombalan ("cantik", "manis", "gemes", "imut", "lucu", "gemoy", "kangen", "sayang", "oshi")
    if (lower.includes("cantik") || lower.includes("manis") || lower.includes("gemes") || lower.includes("imut") || lower.includes("lucu") || lower.includes("kangen") || lower.includes("sayang") || lower.includes("oshi")) {
      if (archetype === "tsundere_cool") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Gak usah lebay deh... Tapi ya, makasih.`,
            `Gombal mulu. Awas kalau gombalin member lain juga ya.`,
            `Bisa aja kamu. Dah ah, gak usah bikin orang salting.`,
            `Hm? Cantik? Ya iya lah, baru sadar? Tapi makasih deh.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "chaos_savage") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hahaha apaan sih Kak geer amat! Tapi emang aku imut sih ya wkwk 😝`,
            `Ciee jurus gombalan buaya keluar nih wkwk! Beliin es krim dulu baru dimaafin!`,
            `Wleee jangan muji-muji terus, nanti hidungku tambah mancung lho!`,
            `Dih tumben manis ngomongnya, ada maunya ya pasti? Ngaku gak! 😝`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "dad_jokes_warm") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hehe makasih yaa! Kamu juga hari ini manis banget kayak gulali pasar malam wkwk.`,
            `Aduh dibilang cantik, langsung merah nih muka aku hehe. Makasih yaa apresiasinya!`,
            `Ciee seneng deh dibilang gitu. Tapi jangan sering-sering ya, nanti aku baper lho hehe.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "slay_gaul") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Aduhh emang dasarnya udah slay dari lahir sih wkwk! Tapi makasih yaa love, kamu emang punya selera tinggi!`,
            `Ciee muji, tapi jujurly aku suka banget dibilang gitu hehe. You make my day!`,
            `Tahu aja yang paling slay siapa hehe. Makasih yaa dukungannya terus!`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "social_butterfly") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `WAAAA MAKASIH BANYAK!! Seneng banget dengernya sampai jingkrak-jingkrak hehe!! Kamu yang paling baik deh!!`,
            `Aduh langsung nambah energi seribu persen dapet pujian dari kamu!! Makasih yaaa!!`,
            `Ihh gemes banget kamu! Makasih yaa udah selalu ada buat semangatin aku!!`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "polos_cute") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Makasih banyak ya Kakak... Aku jadi malu banget dibilang gitu hehe.`,
            `Beneran imut ya Kak? Hehe... Makasih yaa, Kakak juga orang baik banget.`,
            `Ihh makasih Kakak... Seneng banget dibilang gitu sama Kakak.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "gentle_classic") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Terima kasih banyak atas kata-kata manis dan ketulusanmu yaa. Doa baik untukmu juga.`,
            `Pujianmu sangat berharga dan menghangatkan hati. Semoga harimu selalu dipenuhi kebahagiaan.`,
            `Terima kasih yaa sudah selalu mendukung dan menyemangatiku dengan tulus.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "wibu_gamer") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Aduh critical hit langsung tembus armor nih wkwk! Makasih yaa senpai!`,
            `Salting level maksimal sampai HP mau mental wkwk. Makasih yaa apresiasinya!`,
            `Damage-nya gak ngotak wkwk! Tapi makasih banyak yaa udah jadi support terbaikku.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "trainee_school") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Wah... makasih banyak ya Kakak! Aku jadi malu banget hehe, masih banyak yang harus aku pelajari!`,
            `Makasih Kakak baik! Nanti nonton aku di theater ya Kak, biar bisa liat langsung!`,
            `Ihh makasih Kakak hehe... Seneng banget disemangatin sama Kakak!`
          ])),
          isSimulated: true
        };
      }
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Ihh bisa aja gombalnya! Langsung merah nih pipi ${memberName} wkwk. Tapi makasih yaa pujiannya!`,
          `Aduh makasih banyak yaa! Emang bawaan lahir kayaknya nih manisnya hehe.`,
          `Ciee jurus rayuannya keluar nih wkwk. Jangan sering-sering yaa, nanti aku beneran kepikiran lho!`,
          `Hehe makasih yaa! Seneng banget dibilang gitu sama kamu. Tetap dukung aku terus ya!`
        ])),
        isSimulated: true
      };
    }

    // 6. Curhat / Capek / Semangat ("capek", "lelah", "pusing", "stres", "kerja", "tugas", "kuliah", "sekolah", "semangat")
    if (lower.includes("capek") || lower.includes("lelah") || lower.includes("pusing") || lower.includes("stres") || lower.includes("stress") || lower.includes("mumet") || lower.includes("kerja") || lower.includes("tugas") || lower.includes("semangat")) {
      if (archetype === "tsundere_cool") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Kalau capek ya istirahat, jangan dipaksain. Minum air putih terus tidur.`,
            `Siapa yang bikin kamu pusing? Sini bilang ke aku.`,
            `Jangan begadang terus. Kesehatan itu nomor satu, ngerti kan?`,
            `Semangat. Jangan gampang nyerah, kamu pasti bisa lewatin.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "chaos_savage") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Puk puk puk! Sini aku sentil yang bikin kamu capek wkwk. Mau aku hibur gak?`,
            `Jangan pusing-pusing dong! Mending kita ketawa bareng, sini cerita apa yang bikin kesel!`,
            `Aduh kasian bocil tua ini wkwk. Rebahan dulu gih, nanti aku chat lagi pas udah segeran!`,
            `Semangat dong! Jangan lemes gitu, kalah dong sama energi aku yang 1000% ini wkwk 😝`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "dad_jokes_warm") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Semangat yaa! Kamu udah bertahan sejauh ini dan itu keren banget. Mau denger tebakan gak biar gak pusing?`,
            `Tarik nafas pelan-pelan yaa. Istirahat dulu sejenak, jangan terlalu keras sama diri sendiri.`,
            `Kamu hebat kok! Rehat sebentar, nanti kita lanjut berjuang bareng-bareng lagi yaa.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "slay_gaul") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Aduh kasian banget bestie! Sini tumpahin semua unek-uneknya ke aku, jangan dipendem sendiri ya.`,
            `Tarik nafas dulu say, hidup emang kadang ngeselin tapi kamu harus tetep slay!`,
            `Rebahan dulu gih, jangan sampai overthinking yaa. You did your best today!`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "social_butterfly") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `ADUUHH jangan sedih dong!! Aku kirim peluk virtual dan energi positif yang banyak nih buat kamu!! Semangat yaa!!`,
            `Puk puk puk! Kamu udah hebat banget hari ini, aku bangga banget sama perjuangan kamu!`,
            `Jangan lupa istirahat yaa! Nanti kalau udah segeran, kita ngobrol seru lagi!!`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "polos_cute") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Jangan sedih ya Kak... Nanti aku temenin di sini kok. Istirahat yang cukup ya Kak...`,
            `Semoga rasa capek Kakak cepat hilang yaa... Minum air hangat dulu terus istirahat Kak.`,
            `Puk puk Kakak... Semangat yaa, aku selalu doain Kakak dari sini.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "wibu_gamer") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Mana yang bikin stres? Biar aku bantai di ranked match wkwk! Rehat dulu gih senpai.`,
            `HP butuh dicharge, kamu juga butuh recharge! Rehat sejenak yaa biar bar energinya penuh lagi.`,
            `Jangan sampai burnout bro! Tarik nafas, minum teh hangat, terus tidur.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "trainee_school") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Kakak jangan kecapekan yaa... Semangat terus Kak! Kakak pasti bisa lewatin ini semua!`,
            `Puk puk Kakak, jangan lupa makan yaa biar tenaganya balik lagi!`,
            `Semangat Kakak! Kalau capek istirahat dulu yaa, jangan dipaksain.`
          ])),
          isSimulated: true
        };
      }
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

    // 7. Tanya Kabar & Aktivitas ("lagi apa", "lagi ngapain", "sibuk apa", dll.)
    if (lower.includes("lagi apa") || lower.includes("lagi ngapain") || lower.includes("sibuk apa") || lower.includes("kegiatan") || lower.includes("kabar") || lower.includes("dimana") || lower.includes("di mana")) {
      if (archetype === "tsundere_cool") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Lagi istirahat. Kamu sendiri lagi ngapain?`,
            `Baru kelar latihan koreo. Kamu jangan lupa makan juga.`,
            `Lagi santai dengerin lagu. Gak ada kegiatan lain kok.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "chaos_savage") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Lagi mikirin cara nge-prank anak-anak wkwk. Mau ikutan gak nih?`,
            `Lagi makan es krim dong, kamu mau? Gak boleh wleee 😝`,
            `Lagi kepo kamu lagi ngapain wkwk! Ayo tebak aku lagi di mana?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "dad_jokes_warm") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Ini lagi santai sambil mikir tebak-tebakan baru hehe. Mau denger gak?`,
            `Habis latihan nih, lumayan pegel tapi tetap ceria dong pastinya! Kamu lagi ngapain?`,
            `Lagi selonjoran di backstage sambil cek HP. Pas banget chat kamu masuk hehe.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "slay_gaul") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Lagi dengerin lagu sambil me time slay wkwk. Kamu lagi sibuk apa nih bestie?`,
            `Biasa lah ya, lagi santai di ruang tunggu. Spill dong kegiatan kamu hari ini!`,
            `Lagi nongkrong santai bareng anak-anak nih. Kamu lagi di mana sekarang?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "social_butterfly") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Wah lagi heboh banget di backstage bareng anak-anak!! Rame banget pokoknya, seru!`,
            `Lagi persiapan latihan lagi nih, tapi nyempetin bales chat kamu dulu hehe! Kamu lagi apa?!`,
            `Ini lagi cerita-cerita seru sama member lain! Kamu sendiri gimana kabarnya hari ini?!`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "polos_cute") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Lagi duduk sambil minum susu... Kakak lagi ngapain?`,
            `Lagi ngeliatin langit hehe... Bagus banget cuacanya hari ini.`,
            `Habis selesai beres-beres tas Kak... Sekarang lagi santai.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "wibu_gamer") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Lagi push rank tipis-tipis nih, mau ikutan mabar gak?`,
            `Lagi maraton nonton anime nih hehe, seru banget ceritanya! Kamu lagi apa bro?`,
            `Lagi build item karakter di game nih wkwk. Kamu hari ini sibuk apa?`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "trainee_school") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Ini lagi ngafalin koreo dance baru Kak, lumayan susah tapi aku semangat terus!`,
            `Baru beres ngerjain tugas sekolah tadi Kak hehe. Sekarang lagi istirahat!`,
            `Lagi latihan vokal bareng temen-temen trainee Kak. Kakak sendiri lagi apa?`
          ])),
          isSimulated: true
        };
      }
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Lagi selonjoran di backstage nih, lumayan pegel habis latihan koreo bareng member lain. Tapi seru! Kamu sendiri lagi ngapain nih?`,
          `Ini lagi santai sambil dengerin musik di ruang tunggu. Pas banget notif dari kamu muncul hehe. Kamu lagi di rumah atau di luar?`,
          `Alhamdulillah kabar baik dan sehat dong! Lagi persiapan buat kegiatan nanti sore. Kalau kamu hari ini gimana kabarnya?`,
          `Lagi istirahat sejenak nih bareng member lain sambil ngemil. Kamu sendiri udah makan belum jam segini?`
        ])),
        isSimulated: true
      };
    }

    // 8. Pesan Singkat Fallback (cleanWords.length <= 3 atau lower.length < 18)
    if (cleanWords.length <= 3 || lower.length < 18) {
      if (archetype === "tsundere_cool") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hm gitu ya. Menarik sih.`,
            `Oh ya? Terus?`,
            `Singkat amat ngetiknya. Lagi sibuk ya?`,
            `Ya udah, santai aja.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "chaos_savage") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hahaha apaan sih pendek amat chatnya wkwk! 😝`,
            `Dih ngetik cuma segitu doang? Kurang panjang wkwk!`,
            `Wkwk singkat padat dan tidak jelas! Lanjutin dong ceritanya!`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "slay_gaul") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Singkat amat bestie wkwk! Cerita lebih banyak dong.`,
            `Yoi dong, paham banget aku maksud kamu say.`
          ])),
          isSimulated: true
        };
      }
      if (archetype === "polos_cute" || archetype === "trainee_school") {
        return {
          success: true,
          text: limitEmojis(pickBest([
            `Hehe iya Kak... Terus gimana lagi ceritanya?`,
            `Aku dengerin kok Kakak... Ceritain lagi dong hehe.`,
            `Seru banget Kak denger ceritanya... Lanjut dong hehe.`
          ])),
          isSimulated: true
        };
      }
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Eh, cuma ngomong gitu doang nih? Penasaran deh wkwk. Lanjutin dong, ada cerita apa lagi?`,
          `Hehe singkat banget chatnya! Lagi sibuk sambil ngetik ya? Kamu lagi ngerjain apa nih sekarang?`,
          `Iyaa terus gimana kelanjutannya? Coba ceritain lebih banyak dong, ${memberName} lagi siap dengerin nih!`,
          `Kok pendek amat chatnya wkwk. Ada yang lagi dipikirin ya? Cerita ke aku gih, jangan sungkan!`
        ])),
        isSimulated: true
      };
    }

    // 9. Pesan Panjang Fallback (>= 4 kata)
    if (archetype === "tsundere_cool") {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Hm, gitu ya. Menarik juga sih sudut pandang kamu.`,
          `Aku baca kok semuanya. Bagus deh kalau kamu udah bisa nyelesaiin itu.`,
          `Gak usah dipikirin terlalu berat. Santai aja, jalanin pelan-pelan.`,
          `Menarik ceritamu. Cerita aja lagi kalau ada hal lain.`
        ])),
        isSimulated: true
      };
    }
    if (archetype === "chaos_savage") {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Hahaha seriusan Kak? Kok bisa gitu sih wkwk! Lucu banget ceritanya!`,
          `Wkwk ada-ada aja kelakuan kamu! Ceritain lebih banyak dong, aku lagi penasaran nih!`,
          `Dih beneran? Jangan bohongin aku lho wkwk 😝 Terus gimana tuh kelanjutannya?`
        ])),
        isSimulated: true
      };
    }
    if (archetype === "dad_jokes_warm") {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Wah gitu yaa? Menarik deh cerita kamu! Eh ngomong-ngomong aku ada cerita lucu juga lho hehe.`,
          `Hehe iya juga ya! Seneng deh bisa tukar cerita panjang gini sama kamu.`,
          `Seru banget denger sudut pandang kamu! Kalau aku di posisi itu mungkin udah bingung wkwk.`
        ])),
        isSimulated: true
      };
    }
    if (archetype === "slay_gaul") {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `No debat sih itu emang relate banget say wkwk! Terus lanjutannya gimana?`,
          `Jujurly seru banget denger cerita kamu! Cerita lagi dong bestie, aku dengerin nih.`,
          `Slay banget cara kamu ngadepin itu! Keren abis deh pokoknya.`
        ])),
        isSimulated: true
      };
    }
    if (archetype === "social_butterfly") {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `WAHHH SERU BANGET CERITANYA!! Terus terus gimana lagi kelanjutannya?! Aku penasaran nih!`,
          `Aduh asik banget denger cerita kamu!! Lanjutin dong, aku siap dengerin semuanya sampai selesai!!`,
          `Wah gila sih itu seru banget!! Kamu emang selalu punya cerita menarik deh hehe!`
        ])),
        isSimulated: true
      };
    }
    if (archetype === "polos_cute") {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Wah gitu ya Kak... Hehe aku dengerin kok, ceritain lagi yaa Kak kalau masih ada cerita seru.`,
          `Seneng banget bisa nemenin Kakak ngobrol... Ceritain lagi yaa kalau ada cerita seru hehe.`,
          `Kakak hebat banget yaa... Lily suka denger cerita Kakak.`
        ])),
        isSimulated: true
      };
    }
    if (archetype === "wibu_gamer") {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Wah plot twist banget ceritanya kayak di anime wkwk! Lanjut dong ceritanya bro.`,
          `Anjay seru juga tuh! Terus kelanjutannya gimana senpai?`,
          `Gokil sih alur ceritanya, berasa nonton episode klimaks wkwk!`
        ])),
        isSimulated: true
      };
    }
    if (archetype === "trainee_school") {
      return {
        success: true,
        text: limitEmojis(pickBest([
          `Wah gitu ya Kakak! Keren banget hehe, aku seneng denger cerita Kakak!`,
          `Iya Kakak, ceritain lagi dong Kak, seru banget didengernya!`,
          `Makasih yaa Kakak udah mau cerita ke aku hehe, seneng banget bisa nemenin Kakak ngobrol!`
        ])),
        isSimulated: true
      };
    }

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
