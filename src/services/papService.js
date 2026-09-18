import { PM_PHOTOS_DATA } from "../data/pmPhotos.js";
import { getMemberArchetype } from "./aiService.js";

// Riwayat foto yang baru saja dikirim per member agar tidak berulang berturut-turut
const recentMemberPhotos = new Map();

export const PapService = {
  /**
   * Mendeteksi apakah pesan pengguna merupakan permintaan foto atau PAP
   * Mendukung berbagai bahasa santai, slang, dan variasi kata di Indonesia.
   * @param {string} text - Pesan teks dari pengguna
   * @returns {boolean} - true jika meminta PAP / foto
   */
  isPapRequest(text) {
    if (!text || typeof text !== "string") return false;
    const clean = text.trim().toLowerCase();

    // 1. Deteksi kata 'pap' berdiri sendiri atau dengan imbuhan (misal: "pap", "paap", "pap dong", "minta pap", "p.a.p")
    // Menggunakan regex batas kata \b agar kata seperti "papan", "papua", "paparan" tidak ikut terpicu
    const papRegex = /\b(p+a+p+|p\.a\.p)\b/i;
    if (papRegex.test(clean)) return true;

    // 2. Frasa permintaan foto / selfie yang umum digunakan
    const photoPhrases = [
      "minta foto",
      "minta fotonya",
      "bagi foto",
      "bagi fotonya",
      "kirim foto",
      "kirim fotonya",
      "kirimkan foto",
      "spill foto",
      "liat foto",
      "lihat foto",
      "tengok foto",
      "foto kamu",
      "fotonya mana",
      "fotonya dong",
      "foto dong",
      "foto terbaru",
      "foto hari ini",
      "minta selfie",
      "bagi selfie",
      "kirim selfie",
      "selfie dong",
      "selfie kamu",
      "spill selfie",
      "boleh minta foto",
      "boleh liat foto",
      "boleh lihat foto",
      "boleh minta selfie",
      "mau liat foto",
      "mau lihat foto",
      "mau liat muka",
      "mau lihat muka",
      "kirim pict",
      "minta pict",
      "pict dong",
      "pic dong",
      "send pic",
      "send photo",
      "send picture"
    ];

    return photoPhrases.some(phrase => clean.includes(phrase));
  },

  /**
   * Mengambil URL foto secara acak dari folder PM member
   * Menghindari foto yang baru saja dikirim agar variatif
   * @param {Object} member - Objek member JKT48
   * @returns {string} - URL foto
   */
  getRandomPhoto(member) {
    if (!member) return "assets/members/anindya_ramadhani.jpg";
    const memberId = (member.id || "").toLowerCase();
    const shortName = (member.shortName || "").toLowerCase();

    // Cari dari dataset PM_PHOTOS_DATA berdasarkan ID atau nama pendek
    let photoPool = PM_PHOTOS_DATA[memberId] || PM_PHOTOS_DATA[shortName] || [];

    // Jika member memiliki koleksi foto di assets/PM
    if (photoPool && photoPool.length > 0) {
      let recent = recentMemberPhotos.get(memberId) || [];
      let available = photoPool.filter(url => !recent.includes(url));

      // Jika semua foto sudah pernah terkirim dalam riwayat recent, reset siklus riwayat
      if (available.length === 0) {
        recent = [];
        available = photoPool;
      }

      // Pilih foto secara acak
      const selected = available[Math.floor(Math.random() * available.length)];
      recent.push(selected);
      // Simpan maksimal 30 foto terakhir di memory
      if (recent.length > 30) recent.shift();
      recentMemberPhotos.set(memberId, recent);

      return selected;
    }

    // Fallback jika member belum memiliki foto di assets/PM (misal folder kosong atau member lain)
    if (member.photos && member.photos.length > 0) {
      const p = member.photos[Math.floor(Math.random() * member.photos.length)];
      return typeof p === "string" ? p : (p.url || member.avatar);
    }

    // Fallback terakhir ke avatar resmi member
    return member.avatar || "assets/members/anindya_ramadhani.jpg";
  },

  /**
   * Menghasilkan caption khas idol WhatsApp untuk foto PAP
   * @param {Object} member - Objek member
   * @returns {string} - Caption ramah dan natural
   */
  getRandomCaption(member) {
    const name = member?.shortName || member?.name || "aku";
    const archetype = getMemberArchetype(member);

    if (archetype === "tsundere_cool") {
      const gitaCaptions = [
        `Nih. Jangan disebar ya. 📸`,
        `Hm, khusus buat kamu. Awas kalau disebar.`,
        `Nih foto yang kamu minta. Udah ya. 📸`,
        `Nih fotonya. Gak usah lebay mujinya ya.`
      ];
      return gitaCaptions[Math.floor(Math.random() * gitaCaptions.length)];
    }

    if (archetype === "chaos_savage") {
      const christyCaptions = [
        `Wleee nih foto spesial! Cantik kan aku? Hahaha 😝📸`,
        `Nih PAP-nya! Jangan pingsan ya liatnya wkwk 📸`,
        `Tadaaa! Foto eksklusif dari ${name} buat kamu 😝`,
        `Nih foto imut! Awas kalau gak dijadiin wallpaper wkwk 📸`
      ];
      return christyCaptions[Math.floor(Math.random() * christyCaptions.length)];
    }

    if (archetype === "dad_jokes_warm") {
      const freyaCaptions = [
        `Tadaaa! Foto hari ini ✨ Lucu gak? Hehe 📸`,
        `Nihh fotoku! Jangan lupa senyum ya hari ini hehe ✨`,
        `Foto spesial buat kamu! Pas banget tadi sempat selfie hehe 📸`,
        `Nihh PAP hari ini! Semoga bisa bikin kamu semangat yaa ✨`
      ];
      return freyaCaptions[Math.floor(Math.random() * freyaCaptions.length)];
    }

    if (archetype === "slay_gaul") {
      const ollaCaptions = [
        `Slayyy nih PAP dari ${name}! Kece badai kan 💅📸`,
        `Aduhh aesthetic banget kan foto aku! Simpen baik-baik ya say 📸`,
        `Nih foto paling slay hari ini! Khusus buat bestie tercinta 💅✨`
      ];
      return ollaCaptions[Math.floor(Math.random() * ollaCaptions.length)];
    }

    if (archetype === "social_butterfly") {
      const liaCaptions = [
        `HALOOO! Nih nih nih foto aku yang paling ceria hari ini!! Simpen yaa!! 📸💖`,
        `TADAAA! Energi positif lewat foto spesial dari ${name}!! 📸✨`,
        `Nih fotonya udah meluncur!! Gimana, gemes banget kan?! Hehe 📸`
      ];
      return liaCaptions[Math.floor(Math.random() * liaCaptions.length)];
    }

    if (archetype === "polos_cute") {
      const lilyCaptions = [
        `Ini fotoku tadi Kak... Semoga Kakak suka yaa hehe 📸`,
        `Foto spesial dari ${name} buat Kakak... hehe 📸`,
        `Ini fotoku tadi... Jangan lupa disimpan yaa Kakak ✨`
      ];
      return lilyCaptions[Math.floor(Math.random() * lilyCaptions.length)];
    }

    if (archetype === "gentle_classic") {
      const lanaCaptions = [
        `Ini fotoku... Semoga bisa membuat harimu lebih tenang dan menyenangkan yaa ✨📸`,
        `Foto spesial untukmu, terima kasih sudah selalu mendukungku yaa 📸`,
        `Semoga foto ini bisa menjadi penyemangat kecil untuk harimu yaa ✨`
      ];
      return lanaCaptions[Math.floor(Math.random() * lanaCaptions.length)];
    }

    if (archetype === "wibu_gamer") {
      const eliCaptions = [
        `Sugoi gak nih selfie-ku? Wkwk simpen yaa senpai! 📸`,
        `Tadaaa! Karakter anime favoritmu hadir lewat foto ini hehe 📸`,
        `Nih loot drop berupa foto spesial buat kamu! GG kan? 📸✨`
      ];
      return eliCaptions[Math.floor(Math.random() * eliCaptions.length)];
    }

    if (archetype === "trainee_school") {
      const traineeCaptions = [
        `Ini foto aku tadi siang Kak... Maaf ya kalau masih agak canggung fotonya hehe 📸✨`,
        `Spesial buat Kakak yang udah selalu semangatin aku! Disimpan yaa Kak 📸`,
        `Nih foto aku hari ini Kak! Makasih yaa udah minta foto aku hehe ✨`
      ];
      return traineeCaptions[Math.floor(Math.random() * traineeCaptions.length)];
    }

    const captions = [
      `Nihh foto spesial dari ${name} buat kamu! 📸`,
      `Tadaaa! Ini foto yang kamu minta, jangan lupa disimpan yaa ✨`,
      `Hehe pas banget tadi aku sempat selfie, khusus buat kamu lho 💖`,
      `Jangan disebar yaa, ini rahasia kita berdua hehe 🙈 📸`,
      `Ini fotoku tadi sebelum kegiatan, gimana menurut kamu? ✌️`,
      `Nihh PAP hari ini! Semangat terus yaa jalanin harinya! ✨`
    ];
    return captions[Math.floor(Math.random() * captions.length)];
  },

  /**
   * Mendapatkan total foto PM yang tersedia untuk member
   * @param {string} memberId
   * @returns {number}
   */
  getPhotoCount(memberId) {
    const id = (memberId || "").toLowerCase();
    const pool = PM_PHOTOS_DATA[id] || [];
    return pool.length;
  }
};
