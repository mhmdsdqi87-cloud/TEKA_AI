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

/** صدا زدن مدل با retry خودکار؛ جواب پاکسازی‌شده برمی‌گردونه یا null */
export async function callLlm(messages: LlmMsg[], power = false): Promise<string | null> {
  const zai = await getZai()
  let lastError: unknown = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await zai.chat.completions.create({
        messages: messages as never,
        thinking: { type: power ? 'enabled' : 'disabled' },
      })
      const content = completion.choices[0]?.message?.content
      if (content && content.trim()) {
        return sanitizeReply(content)
      }
      throw new Error('empty response')
    } catch (err) {
      lastError = err
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 800 * attempt))
      }
    }
  }
  console.error('[teka] LLM failed:', lastError)
  return null
}
