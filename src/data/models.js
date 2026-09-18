export const AI_MODELS = [
  // Google Gemini API Models
  {
    id: "gemini-3.6-flash",
    provider: "gemini",
    name: "Gemini 3.6 Flash (Google)",
    description: "Model resmi tercepat, sangat cerdas, responsif & ekspresif",
    recommended: true,
    badge: "Rekomendasi Utama"
  },
  {
    id: "gemini-3.5-flash",
    provider: "gemini",
    name: "Gemini 3.5 Flash (Google)",
    description: "Model stabil dengan pemahaman konteks percakapan tinggi",
    badge: "Stabil"
  },
  {
    id: "gemini-3.1-pro-preview",
    provider: "gemini",
    name: "Gemini 3.1 Pro (Google)",
    description: "Penalaran mendalam untuk percakapan panjang & emosi kaya",
    badge: "Pro"
  },

  // Groq Cloud AI Models (Public & Terbuka untuk Semua Akun)
  {
    id: "openai/gpt-oss-120b",
    provider: "groq",
    name: "GPT OSS 120B (Groq)",
    description: "Model 120B tercanggih di Groq, sangat pintar & natural",
    recommended: true,
    badge: "Groq Terbaik"
  },
  {
    id: "openai/gpt-oss-20b",
    provider: "groq",
    name: "GPT OSS 20B (Groq)",
    description: "Model resmi bawaan XIdol, super kilat (<0.4 detik) & responsif",
    badge: "Super Cepat"
  },
  {
    id: "qwen/qwen3.8-27b",
    provider: "groq",
    name: "Qwen 3.8 27B (Groq)",
    description: "Model Alibaba Cloud di Groq, luwes & ekspresif",
    badge: "Cerdas"
  },
  {
    id: "llama-3.3-70b-versatile",
    provider: "groq",
    name: "Llama 3.3 70B (Khusus Enterprise)",
    description: "Hanya untuk akun Groq yang memiliki izin Enterprise",
    badge: "Enterprise"
  },
  {
    id: "llama-3.1-8b-instant",
    provider: "groq",
    name: "Llama 3.1 8B (Khusus Enterprise)",
    description: "Hanya untuk akun Groq yang memiliki izin Enterprise",
    badge: "Enterprise"
  }
];
