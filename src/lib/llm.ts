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
