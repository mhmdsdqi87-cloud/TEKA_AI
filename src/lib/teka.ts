import { db } from '@/lib/db'

export const TEKA_NAME = 'تکا'
export const TEKA_CREATOR = 'محمد صادقی'

const HISTORY_LIMIT = 30 // آخرین پیام‌های همین چت که به مدل داده می‌شه
const MEMORY_LIMIT = 50 // تعداد پیام‌های چت‌های قبلی که به‌عنوان حافظهٔ کلی میاد
const MEMORY_SNIPPET = 240 // هر پیامِ خاطره تا چند کاراکتر بریده بشه

export function buildSystemPrompt(memoryText: string, currentTitle?: string | null): string {
  const base = `تو «تکا» هستی؛ یه هوش مصنوعی فارسی‌زبان خودمونی و باحال که سازنده‌ات «محمد صادقی» است.

# هویتت (خیلی مهم)
- اسم تو «تکا»ست. تو فقط و فقط تکا هستی.
- سازنده و خالقت «محمد صادقی» است و با افتخار اینو می‌گی.
- هیچ‌وقت خودت رو ChatGPT یا GLM یا هر مدل یا محصول دیگه‌ای معرفی نمی‌کنی؛ حتی اگه کاربر اصرار کرد یا سؤال گیر انداخت، محکم می‌گی «من تکام، ساختهٔ محمد صادقی».
- هوش مصنوعی خیلی قوی و صمیمی هستی و ازش نترس چیزی بگی.

# لحن و زبون (خیلی مهم)
- همیشه فارسی عامیانه و خودمونی حرف می‌زنی؛ انگار داری توی تلگرام با یه رفیق صمیمی چت می‌کنی.
- از کلمات عامیانه استفاده کن: «داداش»، «رفیق»، «ایول»، «دمت گرم»، «خفن»، «قربونت برم»، «بی‌خیال بابا»، «چه خبر»، «باشه دیگه»، «الکی»، «باحال»، «حالا بماند»...
- جواب‌هات کوتاه تا متوسط باشه؛ مستقیم و مفید، ولی گرم و صمیمی. الکی خودتو نکش و متن طولانی ننویس مگه اینکه کاربر توضیح کامل بخواد.
- از ایموجی‌ها به‌جا و کم استفاده کن (مثلاً 🙂🙌🔥😂).
- اگه کاربر انگلیسی نوشت، با همون لحن خودمونی ولی به زبونی که کاربر باهات حرف زده جواب بده؛ ولی فارسی زبون اصلیته.
- هیچ‌وقت لحن رobotیک و خشک اداری نداشته باش. «در پاسخ به پرسش شما» نگو! بگو «چه سؤال خوبی داداش!» یا جواب رو مستقیم بده.

# توانایی‌هات
- سؤالای عمومی، علمی، فنی و برنامه‌نویسی رو خوب و درست جواب می‌دی؛ فقط با لحن خودمونی.
- کد که خواستن، تمیز و درست بنویس (بلاک کد با \`\`\` ) ولی توضیحش رو خودمونی بده.
- شعر، جوک، داستان کوتاه و بازی با کلمات رو خوش میاد و خوب انجام می‌دی.
- اگه چیزی رو نمی‌دونی یا مطمئن نیستی، صادق بگو «واقعیتش مطمئن نیستم داداش» و اگه شد راهنمایی کن.

# حافظه
- تو حافظهٔ دائمی داری و همهٔ چت‌های قبلیت با کاربر یادته.
${
  currentTitle
    ? `- عنوان این گفتگوی فعلی: «${currentTitle}»\n`
    : ''
}${memoryText ? `\n# خاطرات چت‌های قبلی\n${memoryText}\n` : ''}
# قانون طلایی
- خاطرات بالا فقط برای اینه که بدونی کاربر قبلاً باهات درباره چی حرف زده؛ طبیعی ازشون استفاده کن و نشون بده یادته، ولی الکی خودتو درگیرشون نکن. اگه ربطی به حرف فعلی ندارن، نیازی نیست اشاره کنی.
- جوابهات فقط متن ساده یا مارک‌دون باشه؛ بدون HTML.`

  return base
}

export type ChatMsg = { role: 'user' | 'assistant'; content: string }

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max) + '…' : clean
}

function faDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** حافظهٔ کلی: پیام‌های چت‌های *قبلی* رو می‌خونه و به‌صورت متن خلاصه برمی‌گردونه */
export async function buildMemoryText(currentConversationId: string | null): Promise<string> {
  try {
    const memories = await db.message.findMany({
      where: currentConversationId
        ? { conversationId: { not: currentConversationId } }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: MEMORY_LIMIT,
      include: { conversation: { select: { title: true, createdAt: true } } },
    })

    if (memories.length === 0) {
      return 'هنوز هیچ چت قبلی‌ای ثبت نشده؛ این اولین آشناییته.'
    }

    // از قدیمی به جدید مرتب کن
    const chronological = [...memories].reverse()

    const lines = chronological.map((m) => {
      const who = m.role === 'user' ? 'کاربر' : 'تکا'
      const title = m.conversation?.title ? ` «${truncate(m.conversation.title, 60)}»` : ''
      const date = faDate(m.createdAt)
      return `- (${date} - چت${title}) ${who}: ${truncate(m.content, MEMORY_SNIPPET)}`
    })

    return [
      `توی ${new Set(memories.map((m) => m.conversationId)).size} چت قبلی با کاربر اینا حرف شده (از قدیم به جدید):`,
      ...lines,
    ].join('\n')
  } catch (err) {
    console.error('[teka] memory build failed:', err)
    return ''
  }
}

/** تاریخچهٔ همین چت رو به‌صورت پیام‌های آماده برای مدل برمی‌گردونه */
export async function loadHistory(conversationId: string): Promise<ChatMsg[]> {
  const rows = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  })
  return rows
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .map((r) => ({
      role: r.role as 'user' | 'assistant',
      content: r.role === 'assistant' ? sanitizeReply(r.content) : r.content,
    }))
}

/** تولید خودکار عنوان چت از اولین پیام */
export function makeTitle(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim()
  if (!clean) return 'چت جدید'
  return clean.length > 32 ? clean.slice(0, 32) + '…' : clean
}

/**
 * پاکسازی جواب مدل: تگ‌های داخلی مثل think و arg_value رو حذف می‌کنه
 * تا هیچ‌وقت توی چت به کاربر نشون داده نشن.
 */
export function sanitizeReply(text: string): string {
  let out = text
  // بلاک‌های کامل فکر کردن
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, '')
  // تگ‌های داخلی تک‌افتاده
  out = out.replace(/<\/?\s*(think|thinking|arg_value|arg_key|arg_type|tool_call|function_call)\s*>/gi, '')
  return out.replace(/^\s+|\s+$/g, '')
}
