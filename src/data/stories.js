// Data Status / Stories Resmi Member JKT48
// Mendukung foto PAP asli dan kompatibel dengan story viewer WhatsApp
import { PM_PHOTOS_DATA } from "./pmPhotos.js";

export const STORIES_DATA = [
  {
    id: "story-freya",
    memberId: "freya",
    memberName: "Freya Jayawardana",
    avatar: "assets/members/freya_jayawardana.jpg",
    timeAgo: "Hari ini 09:15",
    timestamp: "09:15",
    time: "09:15",
    viewed: false,
    hasUnseen: true,
    photos: [
      {
        id: "s1",
        url: "assets/members/freya_jayawardana.jpg",
        imageUrl: "assets/members/freya_jayawardana.jpg",
        caption: "Semangat latihan buat theater nanti malam! Jangan lupa nonton yaa 🍦✨",
        time: "09:15"
      },
      {
        id: "s2",
        url: "assets/members/freya_jayawardana.jpg",
        imageUrl: "assets/members/freya_jayawardana.jpg",
        caption: "Beli minuman favorit dulu biar makin semangat! 🥤",
        time: "10:30"
      }
    ],
    stories: [
      {
        id: "s1",
        url: "assets/members/freya_jayawardana.jpg",
        imageUrl: "assets/members/freya_jayawardana.jpg",
        caption: "Semangat latihan buat theater nanti malam! Jangan lupa nonton yaa 🍦✨",
        time: "09:15"
      },
      {
        id: "s2",
        url: "assets/members/freya_jayawardana.jpg",
        imageUrl: "assets/members/freya_jayawardana.jpg",
        caption: "Beli minuman favorit dulu biar makin semangat! 🥤",
        time: "10:30"
      }
    ]
  },
  {
    id: "story-christy",
    memberId: "christy",
    memberName: "Angelina Christy",
    avatar: "assets/members/angelina_christy.jpg",
    timeAgo: "Hari ini 08:30",
    timestamp: "08:30",
    time: "08:30",
    viewed: false,
    hasUnseen: true,
    photos: [
      {
        id: "s3",
        url: "assets/PM/Christy/photo_2026-09-21_14-25-50 (3).jpg",
        imageUrl: "assets/PM/Christy/photo_2026-09-21_14-25-50 (3).jpg",
        caption: "Pagi semuanya! Jangan lupa sarapan yaa, hari ini harinya have fun! 😆",
        time: "08:30"
      }
    ],
    stories: [
      {
        id: "s3",
        url: "assets/PM/Christy/photo_2026-09-21_14-25-50 (3).jpg",
        imageUrl: "assets/PM/Christy/photo_2026-09-21_14-25-50 (3).jpg",
        caption: "Pagi semuanya! Jangan lupa sarapan yaa, hari ini harinya have fun! 😆",
        time: "08:30"
      }
    ]
  },
  {
    id: "story-gita",
    memberId: "gita",
    memberName: "Gita Sekar",
    avatar: "assets/members/gita_sekar.jpg",
    timeAgo: "Hari ini 08:05",
    timestamp: "08:05",
    time: "08:05",
    viewed: false,
    hasUnseen: true,
    photos: [
      {
        id: "s4",
        url: "assets/PM/Gita/photo_2026-09-18_10-11-12.jpg",
        imageUrl: "assets/PM/Gita/photo_2026-09-18_10-11-12.jpg",
        caption: "Latihan pagi. Tetap fokus.",
        time: "08:05"
      }
    ],
    stories: [
      {
        id: "s4",
        url: "assets/PM/Gita/photo_2026-09-18_10-11-12.jpg",
        imageUrl: "assets/PM/Gita/photo_2026-09-18_10-11-12.jpg",
        caption: "Latihan pagi. Tetap fokus.",
        time: "08:05"
      }
    ]
  },
  {
    id: "story-marsha",
    memberId: "marsha",
    memberName: "Marsha Lenathea",
    avatar: "assets/members/marsha_lenathea.jpg",
    timeAgo: "Hari ini 07:45",
    timestamp: "07:45",
    time: "07:45",
    viewed: false,
    hasUnseen: true,
    photos: [
      {
        id: "s5",
        url: "assets/PM/Marsha/photo_2026-09-21_09-45-26.jpg",
        imageUrl: "assets/PM/Marsha/photo_2026-09-21_09-45-26.jpg",
        caption: "Matcha ice cream sebelum mulai aktivitas hari ini 🍵",
        time: "07:45"
      }
    ],
    stories: [
      {
        id: "s5",
        url: "assets/PM/Marsha/photo_2026-09-21_09-45-26.jpg",
        imageUrl: "assets/PM/Marsha/photo_2026-09-21_09-45-26.jpg",
        caption: "Matcha ice cream sebelum mulai aktivitas hari ini 🍵",
        time: "07:45"
      }
    ]
  },
  {
    id: "story-alya",
    memberId: "alya",
    memberName: "Alya Amanda",
    avatar: "assets/members/alya_amanda.jpg",
    timeAgo: "Kemarin 20:30",
    timestamp: "Kemarin 20:30",
    time: "Kemarin 20:30",
    viewed: true,
    hasUnseen: false,
    photos: [
      {
        id: "s6",
        url: "assets/PM/Alya/photo_2026-08-03_10-43-03.jpg",
        imageUrl: "assets/PM/Alya/photo_2026-08-03_10-43-03.jpg",
        caption: "Selesai latihan teater! Capek tapi seru banget hehe 💖",
        time: "20:30"
      }
    ],
    stories: [
      {
        id: "s6",
        url: "assets/PM/Alya/photo_2026-08-03_10-43-03.jpg",
        imageUrl: "assets/PM/Alya/photo_2026-08-03_10-43-03.jpg",
        caption: "Selesai latihan teater! Capek tapi seru banget hehe 💖",
        time: "20:30"
      }
    ]
  }
];

// Helper untuk menghasilkan caption status natural berdasarkan archetype member
export function getRandomStoryCaption(member) {
  const shortName = member?.shortName || member?.name || "aku";
  const captions = [
    `Semangat latihan buat persiapan nanti! Doain lancar yaa ✨`,
    `Istirahat sebentar beli cemilan favorit dulu hehe 🧋`,
    `Hari ini cerah banget! Jangan lupa tersenyum yaa semuanya 😊`,
    `Backstage moment sebelum perform nanti malam 🎶`,
    `Selfie dulu di sela-sela kegiatan hari ini hehe 📸`,
    `Capek latihan tapi harus tetep senyum dong! Semangat hari ini!`,
    `Lagi denger lagu favorit sambil nunggu giliran latihan 🎧`,
    `Tadi seru banget ketawa bareng teman-teman di ruang tunggu wkwk`
  ];
  return captions[Math.floor(Math.random() * captions.length)];
}

// Helper untuk membuat status baru untuk member
export function generateMemberNewStory(member, customCaption = null, customPhoto = null) {
  const memberId = member?.id || "freya";
  const memberName = member?.fullName || member?.name || memberId;
  const avatar = member?.avatar || "assets/pm-logo.jpg";
  
  // Ambil foto PAP acak jika ada, jika tidak gunakan avatar
  let photoUrl = customPhoto;
  if (!photoUrl) {
    const papList = PM_PHOTOS_DATA[memberId];
    if (papList && papList.length > 0) {
      photoUrl = papList[Math.floor(Math.random() * papList.length)];
    } else if (member?.photos && member.photos.length > 0) {
      photoUrl = member.photos[Math.floor(Math.random() * member.photos.length)].url;
    } else {
      photoUrl = avatar;
    }
  }

  const caption = customCaption || getRandomStoryCaption(member);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const photoObj = {
    id: "p_" + Date.now(),
    url: photoUrl,
    imageUrl: photoUrl,
    caption: caption,
    time: timeStr
  };

  return {
    id: `story-${memberId}`,
    memberId: memberId,
    memberName: memberName,
    avatar: avatar,
    timeAgo: `Hari ini ${timeStr}`,
    timestamp: timeStr,
    time: timeStr,
    viewed: false,
    hasUnseen: true,
    photos: [photoObj],
    stories: [photoObj]
  };
}
