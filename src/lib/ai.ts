/**
 * 🌐 لایهٔ هوش مصنوعی قابل‌حمل تکا
 *
 * ترتیب اولویت:
 *  ۱) کانفیگ سندباکس (.z-ai-config) → z-ai-web-dev-sdk
 *  ۲) متغیرهای محیطی AI_BASE_URL + AI_API_KEY → هر سرویس سازگار با OpenAI
 *     (OpenAI، OpenRouter، z.ai، Groq، Together و…)
 *  ۳) هیچ‌کدوم نبود → ارور واضح فارسی
 *
 * شبیه‌ساز فقط متدهایی رو پیاده می‌کنه که تکا واقعاً استفاده می‌کنه:
 *  - chat.completions.create({ messages, stream?, thinking? })
 *  - chat.completions.createVision({ model?, messages, thinking? })
 *  - images.generations.create({ prompt, size })
 *  - audio.asr.create({ file_base64 })
 */

/**
 * شکل کلاینت AI عمداً loosen هست (مثل خود SDK) — call siteها خودشون
 * cast دقیق دارن (ImageCreate و VisionClient و…).
 */
export type AIClient = any

const AI_BASE_URL = process.env.AI_BASE_URL?.replace(/\/+$/, '')
const AI_API_KEY = process.env.AI_API_KEY
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'
const AI_IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'dall-e-3'
const AI_ASR_MODEL = process.env.AI_ASR_MODEL || 'whisper-1'

/** هدرهای اضافهٔ اختیاری برای گیت‌وی (مثلاً {"X-Token":"…","X-Z-AI-From":"Z"}) — JSON توی env */
const AI_EXTRA_HEADERS: Record<string, string> = (() => {
  try {
    const raw = process.env.AI_EXTRA_HEADERS
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]))
  } catch {
    return {}
  }
})()

/** آیا حالت سازگار-OpenAI فعاله؟ */
export function hasOpenAiCompat(): boolean {
  return Boolean(AI_BASE_URL && AI_API_KEY)
}

/* ---------- کمکی‌ها ---------- */

async function oaFetch(path: string, body: unknown): Promise<Response> {
  return fetch(`${AI_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
      ...AI_EXTRA_HEADERS,
    },
    body: JSON.stringify(body),
  })
}

/** فایل base64 → Blob برای multipart */
function base64ToBlob(b64: string, mime: string): Blob {
  const buf = Buffer.from(b64, 'base64')
  return new Blob([new Uint8Array(buf)], { type: mime })
}

/* ---------- شبیه‌ساز سازگار-OpenAI ---------- */

function makeOpenAiCompat(): AIClient {
  const client = {
    chat: {
      completions: {
        create: async (args: {
          messages: unknown
          stream?: boolean
          thinking?: unknown
          model?: string
        }) => {
          const wantStream = args.stream === true
          const res = await oaFetch('/chat/completions', {
            model: args.model || AI_MODEL,
            messages: args.messages,
            stream: wantStream,
          })
          if (!res.ok) {
            const errText = await res.text().catch(() => '')
            throw new Error(`AI API ${res.status}: ${errText.slice(0, 300)}`)
          }
          if (wantStream) {
            // مثل SDK اصلی: ReadableStream از SSE برمی‌گردیم (consumeSseStream خودش می‌خونه)
            if (!res.body) throw new Error('empty stream body')
            return res.body
          }
          return res.json()
        },

        createVision: async (args: {
          model?: string
          messages: unknown
          thinking?: unknown
        }) => {
          const res = await oaFetch('/chat/completions', {
            model: args.model || AI_MODEL,
            messages: args.messages,
          })
          if (!res.ok) {
            const errText = await res.text().catch(() => '')
            throw new Error(`AI Vision API ${res.status}: ${errText.slice(0, 300)}`)
          }
          return res.json()
        },
      },
    },

    images: {
      generations: {
        create: async (args: { prompt: string; size?: string }) => {
          const res = await oaFetch('/images/generations', {
            model: AI_IMAGE_MODEL,
            prompt: args.prompt,
            size: args.size || '1024x1024',
            response_format: 'b64_json',
            n: 1,
          })
          if (!res.ok) {
            const errText = await res.text().catch(() => '')
            throw new Error(`AI Image API ${res.status}: ${errText.slice(0, 300)}`)
          }
          const json = (await res.json()) as {
            data?: { b64_json?: string; url?: string }[]
          }
          let base64 = json.data?.[0]?.b64_json
          // بعضی سرویس‌ها به‌جای b64 یه URL می‌دن — خودمون می‌گیریمش
          const url = json.data?.[0]?.url
          if (!base64 && url) {
            const img = await fetch(url)
            const buf = Buffer.from(await img.arrayBuffer())
            base64 = buf.toString('base64')
          }
          if (!base64) throw new Error('empty image response')
          // شکل خروجی مثل SDK اصلی
          return { data: [{ base64 }] }
        },
      },
    },

    audio: {
      asr: {
        create: async (args: { file_base64: string }) => {
          const form = new FormData()
          form.append('file', base64ToBlob(args.file_base64, 'audio/webm'), 'voice.webm')
          form.append('model', AI_ASR_MODEL)
          const res = await fetch(`${AI_BASE_URL}/audio/transcriptions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${AI_API_KEY}`, ...AI_EXTRA_HEADERS },
            body: form,
          })
          if (!res.ok) {
            const errText = await res.text().catch(() => '')
            throw new Error(`AI ASR API ${res.status}: ${errText.slice(0, 300)}`)
          }
          const json = (await res.json()) as { text?: string }
          return { text: json.text ?? '' }
        },
      },
    },
  }

  return client as unknown as AIClient
}

/* ---------- نقطهٔ ورود واحد ---------- */

let cached: AIClient | null = null

export async function getAI(): Promise<AIClient> {
  if (cached) return cached

  // ۱) حالت سازگار-OpenAI اولویت داره اگه env ست شده باشه
  if (hasOpenAiCompat()) {
    cached = makeOpenAiCompat()
    console.info('[teka-ai] using OpenAI-compatible API:', AI_BASE_URL)
    return cached
  }

  // ۲) SDK سندباکس (.z-ai-config)
  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk')
    cached = (await ZAI.create()) as AIClient
    console.info('[teka-ai] using z-ai-web-dev-sdk (sandbox config)')
    return cached
  } catch {
    throw new Error(
      'هوش مصنوعی پیکربندی نشده! یا AI_BASE_URL و AI_API_KEY رو ست کن یا فایل .z-ai-config بذار.'
    )
  }
}
