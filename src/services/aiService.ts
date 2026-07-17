// Layanan Penulisan Ulang Konten AI
// Dukungan: OpenAI (GPT-4), Google Gemini, xAI Grok

import type { AIProvider } from '@/stores/useSettingsStore';

export interface AIRewriteOptions {
  content: string;
  tone: 'sales' | 'friendly' | 'professional' | 'viral';
  customPrompt?: string;
  provider: AIProvider;
  apiKey: string;
}

export interface AIRewriteResult {
  success: boolean;
  rewrittenContent?: string;
  error?: string;
}

const TONE_PROMPTS: Record<string, string> = {
  sales: 'Tulis ulang dengan gaya penjualan yang kuat, ciptakan rasa urgensi, ajakan bertindak, dan tambahkan emoji yang sesuai.',
  friendly: 'Tulis ulang dengan gaya ramah, akrab, mudah didekati, seperti sedang mengobrol dengan teman.',
  professional: 'Tulis ulang dengan gaya profesional, terpercaya, jelas, dan memiliki struktur yang baik.',
  viral: 'Tulis ulang dengan gaya viral, membangkitkan rasa penasaran, gunakan hook kuat, mudah dibagikan, dan menarik interaksi.',
};

function buildSystemPrompt(tone: string, customPrompt?: string): string {
  const base = `Kamu adalah ahli penulisan konten Facebook Marketing di Indonesia.
Tugas: Tulis ulang postingan Facebook grup agar lebih menarik.

Aturan:
- Pertahankan makna utama dan informasi produk/jasa
- ${TONE_PROMPTS[tone] || TONE_PROMPTS.sales}
- Tambahkan emoji yang sesuai tapi jangan berlebihan
- Jaga panjang tulisan ±10% dari aslinya
- Optimalkan untuk grup Facebook jualan di Indonesia
- Hanya kembalikan konten yang ditulis ulang, JANGAN tambahkan penjelasan`;

  if (customPrompt) {
    return `${base}\n\nPermintaan tambahan: ${customPrompt}`;
  }
  return base;
}

// ═══════════════════════════════════════════════════════════════════
// OpenAI
// ═══════════════════════════════════════════════════════════════════
async function rewriteWithOpenAI(options: AIRewriteOptions): Promise<AIRewriteResult> {
  const systemPrompt = buildSystemPrompt(options.tone, options.customPrompt);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Tulis ulang postingan berikut:\n\n${options.content}` },
        ],
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const rewrittenContent = data.choices?.[0]?.message?.content?.trim();
    if (!rewrittenContent) throw new Error('Tidak menerima respons dari AI');

    return { success: true, rewrittenContent };
  } catch (err: any) {
    return { success: false, error: `OpenAI: ${err.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Google Gemini
// ═══════════════════════════════════════════════════════════════════
const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.0-flash',
] as const;

async function callGeminiRewriteModel(
  options: AIRewriteOptions,
  systemPrompt: string,
  model: string
): Promise<AIRewriteResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            parts: [{ text: `Tulis ulang postingan berikut:\n\n${options.content}` }],
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const rewrittenContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rewrittenContent) throw new Error('Tidak menerima respons dari Gemini');

    return { success: true, rewrittenContent };
  } catch (err: any) {
    return { success: false, error: `${model}: ${err.message}` };
  }
}

async function rewriteWithGemini(options: AIRewriteOptions): Promise<AIRewriteResult> {
  const systemPrompt = buildSystemPrompt(options.tone, options.customPrompt);
  const errors: string[] = [];

  for (const model of GEMINI_TEXT_MODELS) {
    const result = await callGeminiRewriteModel(options, systemPrompt, model);
    if (result.success) return result;
    if (result.error) errors.push(result.error);
  }

  return {
    success: false,
    error: `Gemini: Semua model fallback gagal. ${errors.join(' | ')}`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// xAI Grok
// ═══════════════════════════════════════════════════════════════════
async function rewriteWithGrok(options: AIRewriteOptions): Promise<AIRewriteResult> {
  const systemPrompt = buildSystemPrompt(options.tone, options.customPrompt);
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Tulis ulang postingan berikut:\n\n${options.content}` },
        ],
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const rewrittenContent = data.choices?.[0]?.message?.content?.trim();
    if (!rewrittenContent) throw new Error('Tidak menerima respons dari Grok');

    return { success: true, rewrittenContent };
  } catch (err: any) {
    return { success: false, error: `Grok: ${err.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════════════════════════
export async function rewriteContent(options: AIRewriteOptions): Promise<AIRewriteResult> {
  if (!options.apiKey) {
    return { success: false, error: 'Mohon masukkan API Key di Pengaturan' };
  }
  if (!options.content.trim()) {
    return { success: false, error: 'Konten kosong' };
  }

  switch (options.provider) {
    case 'openai':
      return rewriteWithOpenAI(options);
    case 'gemini':
      return rewriteWithGemini(options);
    case 'grok':
      return rewriteWithGrok(options);
    default:
      return { success: false, error: `Provider tidak didukung: ${options.provider}` };
  }
}

// Batch rewrite untuk beberapa grup (setiap grup konten unik)
export async function rewriteContentBatch(
  options: AIRewriteOptions,
  count: number
): Promise<AIRewriteResult[]> {
  const results: AIRewriteResult[] = [];
  for (let i = 0; i < count; i++) {
    const result = await rewriteContent({
      ...options,
      customPrompt: `${options.customPrompt || ''} (Versi ${i + 1}/${count} — buat berbeda dari versi sebelumnya)`.trim(),
    });
    results.push(result);
    if (i < count - 1) await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

// ... (Bagian generate image tetap sama, hanya pesan error yang diterjemahkan)

export async function generateImage(options: AIImageOptions): Promise<AIImageResult> {
  if (!options.apiKey) {
    return { success: false, error: 'Mohon masukkan API Key di Pengaturan' };
  }
  if (!options.prompt.trim()) {
    return { success: false, error: 'Prompt pembuatan gambar kosong' };
  }

  switch (options.provider) {
    case 'openai':
      return generateImageWithOpenAI(options);
    case 'gemini':
      return generateImageWithGemini(options);
    case 'grok':
      return { success: false, error: 'Pembuatan gambar dengan Grok belum didukung di versi ini. Silakan pilih OpenAI atau Gemini.' };
    default:
      return { success: false, error: `Provider tidak didukung: ${options.provider}` };
  }
}
