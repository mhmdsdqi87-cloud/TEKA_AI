import ZAI from 'z-ai-web-dev-sdk'
import { sanitizeReply } from '@/lib/teka'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

export async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

type LlmMsg = { role: string; content: string }

/**
 * ⚡ استریم: تکه‌تکه‌های جواب مدل رو همین‌طور که میان به onDelta میده.
 * خروجی: کل متن خام (بدون پاکسازی) یا null اگه کلاً نشد.
 */
async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      for (const line of part.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload)
          const delta: string =
            json?.choices?.[0]?.delta?.content ??
            json?.choices?.[0]?.message?.content ??
            ''
          if (delta) {
            full += delta
            onDelta(delta)
          }
        } catch {
          /* تکهٔ ناقص SSE — مهم نیست، ادامه بده */
        }
      }
    }
  }
  return full
}

/**
 * صدا زدن مدل به‌صورت استریم با retry خودکار.
 * ⚠️ متن خام برمی‌گردونه — تماس‌گیرنده باید sanitizeReply بزنه.
 */
export async function callLlmStream(
  messages: LlmMsg[],
  power = false,
  think = true,
  onDelta: (text: string) => void
): Promise<string | null> {
  const zai = await getZai()
  let lastError: unknown = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await zai.chat.completions.create({
        messages: messages as never,
        stream: true,
        thinking: { type: think || power ? 'enabled' : 'disabled' },
      })
      // SDK وقتی stream:true باشه ReadableStream برمی‌گردونه
      if (res && typeof (res as ReadableStream).getReader === 'function') {
        const full = await consumeSseStream(
          res as ReadableStream<Uint8Array>,
          onDelta
        )
        if (full.trim()) return full
        throw new Error('empty stream')
      }
      // بعضی مواقع شاید JSON عادی برگردونه (fallback امن)
      const content = res?.choices?.[0]?.message?.content
      if (content && content.trim()) {
        onDelta(content)
        return content
      }
      throw new Error('empty response')
    } catch (err) {
      lastError = err
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 700 * attempt))
      }
    }
  }
  console.error('[teka] LLM stream failed:', lastError)
  return null
}

/**
 * صدا زدن مدل با retry خودکار؛ جواب پاکسازی‌شده برمی‌گردونه یا null.
 * ⚠️ از اکتبر: حالت تفکر (thinking) به‌صورت پیش‌فرض روشنه تا دقت جواب‌ها
 * خیلی بالاتر بره و تکا کمتر اشتباه کنه. برای کارهای سبک (مثل بازنویسی
 * پرامپت تصویر) می‌تونیم با think=false سریع‌ترش کنیم.
 */
export async function callLlm(
  messages: LlmMsg[],
  power = false,
  think = true
): Promise<string | null> {
  const zai = await getZai()
  let lastError: unknown = null

  // ۴ تلاش با تأخیر فزاینده — تا جواب «اووپس» تقریباً غیرممکن شه
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const completion = await zai.chat.completions.create({
        messages: messages as never,
        thinking: { type: think || power ? 'enabled' : 'disabled' },
      })
      const content = completion.choices[0]?.message?.content
      if (content && content.trim()) {
        return sanitizeReply(content)
      }
      throw new Error('empty response')
    } catch (err) {
      lastError = err
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 700 * attempt))
      }
    }
  }
  console.error('[teka] LLM failed:', lastError)
  return null
}
