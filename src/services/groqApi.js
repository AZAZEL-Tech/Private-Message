import { Storage } from "./storage.js";
import { AIService, limitEmojis } from "./aiService.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export const GroqService = {
  async testConnection(apiKey, modelId = "openai/gpt-oss-120b") {
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
    const model = Storage.getSelectedModel() || "openai/gpt-oss-20b";
    const profile = Storage.getUserProfile();

    const reply = await AIService.generateIdolResponse(
      userText,
      member.systemPrompt,
      apiKey,
      model,
      chatHistory,
      "groq",
      profile,
      member
    );

    return {
      success: true,
      text: reply,
      modelUsed: model,
      provider: "Groq Cloud"
    };
  },

  async _simulateOfflineResponse(member, userText, profile) {
    // Realistic idol persona simulated replies when offline / without API key
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));

    const rawName = (profile && profile.name) ? profile.name.trim() : "";
    const hasCustomName = Boolean(rawName && !["fans jkt48", "user", "kamu", "anon", "guest"].includes(rawName.toLowerCase()));
    const uNameComma = hasCustomName ? `, ${rawName}` : "";

    const customResponses = {
      freya: [
        `Hai! Makasih yaa udah sempetin ngechat Freya. Kamu lagi santai atau lagi sibuk nih?`,
        `Karamel senyumku spesial buat kamu hari ini! Kamu sendiri lagi ngapain sekarang?`,
        `Wah seru banget! Kapan nih ada rencana mau nonton theater lagi?`,
        `Hehe bisa aja deh! Lagi di rumah atau masih di jalan nih?`,
        `Iya nih, tadi habis gladi lumayan pegel tapi seneng bisa nyapa kamu. Udah makan belum?`
      ],
      trisha: [
        `Halo${uNameComma}! Hari ini gimana kegiatannya? Seru gak?`,
        `Ih seneng deh kamu ngechat Trisha! Lagi istirahat latihan nih, kalau kamu lagi apa?`,
        `Semangat yaa! Jangan lupa minum air putih yang banyak. Hari ini cuacanya panas gak di tempatmu?`,
        `Hehe iya dong! Nanti ada rencana nonton show aku gak nih?`
      ],
      maira: [
        `Halo${uNameComma}! Kamu udah makan siang belum nih? Jangan telat makan yaa. Makan apa hari ini?`,
        `Hehe makasih yaa udah selalu support aku di Gen 13. Hari ini ada cerita seru apa?`,
        `Lagi mikirin apa nih? Cerita dong ke Maira, aku dengerin nih!`,
        `Semangat terus yaa hari ini! Mau ditemenin ngobrol terus kan?`
      ],
      christy: [
        `Halooo! Toyaa di sini! Lagi sibuk apa nih kamu sekarang?`,
        `Cieee ngechat Christy! Kangen yaa? Hehe ngaku deh!`,
        `Semangat yaa buat hari ini! Seharian ini udah ngapain aja nih?`,
        `Tadi habis latihan lagu baru bareng member lain, seru banget tau. Kamu hari ini ke mana aja?`
      ],
      marsha: [
        `Hai... Lagi santai nih sambil denger musik. Kamu sendiri gimana harinya?`,
        `Hehe iyaa, have a sweet day yaa. Hari ini ada rencana seru apa nih?`,
        `Terima kasih ya sudah selalu dukung Marsha. Lagi di rumah atau lagi di luar nih?`
      ],
      michie: [
        `Halo${uNameComma}! Baru aja nyampe nih, kamu lagi di mana sekarang?`,
        `Hehe asik banget! Sukses ya buat kerjaan atau belajarnya hari ini. Masih banyak yang harus diberesin?`,
        `Makasih udah sapa Michie! Kamu udah istirahat belum seharian ini?`
      ],
      fritzy: [
        `Abrakadabra! Senyuman magis untuk kamu! Gimana harimu hari ini, seru gak?`,
        `Wah, ada pesan masuk nih! Hehe lagi pengen diobrolin apa nih sama Fritzy?`
      ]
    };

    const pool = customResponses[member.id] || customResponses.freya;
    const selected = pool[Math.floor(Math.random() * pool.length)];

    return {
      success: true,
      text: limitEmojis(selected, 1),
      isSimulated: true
    };
  }
};
