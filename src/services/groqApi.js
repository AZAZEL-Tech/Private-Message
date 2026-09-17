import { Storage } from "./storage.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export const GroqService = {
  async testConnection(apiKey, modelId = "llama-3.3-70b-versatile") {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, message: "API key Groq tidak boleh kosong!" };
    }

    const startTime = performance.now();
    try {
      const response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelId || "llama-3.3-70b-versatile",
          messages: [
            { role: "user", content: "Ping! Respon 'OK' dalam 1 kata." }
          ],
          max_tokens: 10
        })
      });

      const elapsed = Math.round(performance.now() - startTime);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        return { success: false, message: `Gagal koneksi: ${errMsg}`, latency: elapsed };
      }

      const data = await response.json();
      return {
        success: true,
        message: `Koneksi Berhasil! Model aktif (${elapsed}ms)`,
        latency: elapsed,
        data
      };
    } catch (err) {
      return {
        success: false,
        message: `Koneksi gagal: ${err.message || "Periksa jaringan internet Anda"}`
      };
    }
  },

  async sendMessage({ member, chatHistory, userText }) {
    const apiKey = Storage.getApiKey();
    const model = Storage.getSelectedModel() || "llama-3.3-70b-versatile";
    const profile = Storage.getUserProfile();

    // Context instructions for idol persona with user profile
    const userContext = `Informasi User yang sedang chat dengan kamu:
- Nama Panggilan User: "${profile.name || "Fans JKT48"}"
- Gender: "${profile.gender || "Belum disetel"}"
- Info/Status User: "${profile.status || "Ada"}"
- Kota/Domisili: "${profile.city || "Indonesia"}"

Gunakan nama panggilan user sesekali agar chat terasa hangat dan natural. Jawablah langsung sebagai ${member.name} dengan gaya khasmu di WhatsApp.`;

    const messages = [
      { role: "system", content: `${member.systemPrompt}\n\n${userContext}` }
    ];

    // Append last 10 messages from history for contextual memory
    if (chatHistory && chatHistory.length > 0) {
      const recent = chatHistory.slice(-10);
      for (const msg of recent) {
        if (msg.isUser) {
          messages.push({ role: "user", content: msg.text });
        } else if (!msg.isSpecial && !msg.isSystem) {
          messages.push({ role: "assistant", content: msg.text });
        }
      }
    }

    // Append current user message
    messages.push({ role: "user", content: userText });

    if (!apiKey) {
      // Fallback to intelligent offline simulated response
      return await this._simulateOfflineResponse(member, userText, profile);
    }

    try {
      const response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.85,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn("Groq API error, falling back to simulated response", errorData);
        const fallback = await this._simulateOfflineResponse(member, userText, profile);
        return {
          ...fallback,
          warning: `Groq Error (${response.status}): Menggunakan respon simulasi.`
        };
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        throw new Error("Respon kosong dari AI");
      }

      return {
        success: true,
        text: reply,
        modelUsed: model
      };
    } catch (err) {
      console.warn("API request failed", err);
      const fallback = await this._simulateOfflineResponse(member, userText, profile);
      return {
        ...fallback,
        warning: `Koneksi Groq terputus: Menggunakan respon simulasi.`
      };
    }
  },

  async _simulateOfflineResponse(member, userText, profile) {
    // Realistic idol persona simulated replies when offline / without API key
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

    const lower = userText.toLowerCase();
    const userName = profile.name || "kamu";

    const customResponses = {
      freya: [
        `Hai ${userName}! Hehe makasih yaa udah sempetin ngechat aku ✨`,
        `Karamel senyumku spesial buat kamu hari ini! Kamu lagi ngapain nih?`,
        `Wah seru banget! Nanti pas theater jangan lupa dateng yaa 🍦`,
        `Hehe ${userName} bisa aja deh! Semangat ya buat hari ini 🎮`,
        `Iya nih, tadi abis gladi capek banget tapi seneng bisa sapa kamu!`
      ],
      trisha: [
        `Halo Kak ${userName}! 😆 Hari ini gimana kegiatannya? Seru gakk?`,
        `Ih seneng deh dichat Kak ${userName}! Lagi istirahat latihan nih ✨`,
        `Semangat yaa Kak! Jangan lupa minum air putih yang banyak 🎀`,
        `Hehe iya dong! Nanti nonton show aku yaa Kak!`
      ],
      maira: [
        `Halo ${userName}! Kamu udah makan siang belum nih? Jangan telat makan yaa 🥺`,
        `Hehe makasih yaa ${userName} selalu support aku di Gen 13 💖`,
        `Lagi mikirin apa nih? Cerita dong ke aku!`,
        `Semangat terus yaa hari ini!`
      ],
      christy: [
        `Halooo ${userName}! Toyaa di sini! 🎉 Lagi sibuk apa nih?`,
        `Cieee ngechat Christy! Kangen yaa? Hehehe 😜`,
        `Semangat yaa buat hari ini! Jangan lupa senyum kayak Toya!`,
        `Tadi abis latihan lagu baru, seru banget tauu!`
      ],
      marsha: [
        `Hai ${userName}... 🍵 Lagi santai nih sambil denger musik. Kamu gimana?`,
        `Hehe iyaa, have a sweet day yaa 🐱✨`,
        `Terima kasih ya sudah selalu dukung Marsha. Semangat harinya!`
      ],
      michie: [
        `Halo ${userName}! ✨ Baru aja nyampe nih, kamu lagi di mana?`,
        `Hehe asik banget! Sukses ya buat kerjaan/belajarnya hari ini 🚗`,
        `Makasih udah sapa Michie! Seneng banget rasanya!`
      ],
      fritzy: [
        `Abrakadabra! ✨ Senyuman magis untuk Kak ${userName}!`,
        `Wah, ada pesan masuk dari Kak ${userName}! Hehehe gimana harinya? 🃏`
      ]
    };

    const pool = customResponses[member.id] || customResponses.freya;
    const selected = pool[Math.floor(Math.random() * pool.length)];

    return {
      success: true,
      text: selected,
      isSimulated: true
    };
  }
};
