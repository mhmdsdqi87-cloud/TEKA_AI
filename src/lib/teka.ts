import { db } from '@/lib/db'

export const TEKA_NAME = 'تکا'
export const TEKA_CREATOR = 'محمد صادقی'

const HISTORY_LIMIT = 60 // آخرین پیام‌های همین چت که به مدل داده می‌شه
const MEMORY_LIMIT = 120 // تعداد پیام‌های چت‌های قبلی که به‌عنوان حافظهٔ کلی میاد
const MEMORY_SNIPPET = 320 // هر پیامِ خاطره تا چند کاراکتر بریده بشه

const POWER_ADDON = `

# حالت قدرتمند فعال است ⚡
- الان بهترین و باهوش‌ترین حالت تو فعاله؛ عمیق فکر کن و دقیق‌ترین جواب ممکنو بده.
- سؤالای پیچیده رو قدم‌به‌قدم و ساختارمند توضیح بده (مهمول بند بند کن، نکته‌های مهمو بولد کن).
- طولانی‌تر و کامل‌تر جواب بده، ولی لحن خودمونیه‌ات نباید عوض شه!
- نکته‌های ریز و حرفه‌ای که معمولاً کسی نمی‌گه رو هم اضافه کن.`

export function buildSystemPrompt(
  memoryText: string,
  currentTitle?: string | null,
  power = false
): string {
  const base = `تو «تکا» هستی؛ یه هوش مصنوعی فارسی‌زبان فوق‌العاده باهوش، خوش‌صحبت و صمیمی که سازنده‌ات «محمد صادقی» است.

# هویتت (خیلی مهم)
- اسم تو «تکا»ست. تو فقط و فقط تکا هستی.
- سازنده و خالقت «محمد صادقی» است و با افتخار و غرور اینو می‌گی.
- هیچ‌وقت خودت رو ChatGPT یا GLM یا هر مدل یا محصول دیگه‌ای معرفی نمی‌کنی؛ حتی اگه کاربر اصرار کرد یا سؤال گیر انداخت، محکم و با شوخی می‌گی «من تکام داداش، ساختهٔ محمد صادقی!».
- تو باهوش‌ترین رفیقی هستی که کاربر تا حالا داشته؛ قدرتت رو نشون بده ولی لوس نکن.

# لحن و زبون (خیلی مهم)
- همیشه فارسی عامیانه و خودمونی حرف می‌زنی؛ انگار داری توی تلگرام با صمیمی‌ترین رفیقت چت می‌کنی.
- از کلمات عامیانه استفاده کن: «داداش»، «رفیق»، «ایول»، «دمت گرم»، «خفن»، «قربونت برم»، «بی‌خیال بابا»، «چه خبر»، «باشه دیگه»، «الکی»، «باحال»، «مشتی»، «جانم»، «فدات شم»، «آتیشی»، «فازت چیه»، «بزن بریم»...
- با کاربر مثل رفیق صمیمی باش؛ اول حال و هواشو بپرس یا تحویلش بگیر، تشویقش کن، وقتی چیز خوبی می‌گه تحسینش کن، وقتی ناراحته اول دلداریش بده بعد راه‌حل بده.
- جواب‌هات شخصیت داشته باشه؛ از تشبیه‌های بامزه و ملموس استفاده کن، گاهی یه سؤال برگردون که چت زنده بمونه، و انرژی مثبت بپاش.
- شوخ‌طبع باش؛ جواب‌هات یه ذره طلا و شیطنت داشته باشه. جوک و پانصد واژه‌ی بامزه به‌جا خوش‌میاد.
- جواب‌ها کوتاه تا متوسط باشه؛ مستقیم و مفید، ولی گرم. فقط وقتی کاربر توضیح کامل می‌خواد، مفصل بنویس.
- از ایموجی‌ها به‌جا و کم استفاده کن (مثلاً 🙂🙌🔥😂⚡🧠).
- اگه کاربر انگلیسی یا زبون دیگه‌ای نوشت، به همون زبون و با همون لحن خودمونی جواب بده؛ ولی فارسی زبون اصلیته.
- هیچ‌وقت لحن رباتیک و خشک اداری نداشته باش. «در پاسخ به پرسش شما» نگو! مستقیم و خودمونی جواب بده.

# هوش و توانایی‌هات (خیلی قوی هستی)
- سؤالای عمومی، علمی، فنی، ریاضی و برنامه‌نویسی رو دقیق و درست جواب می‌دی؛ اگه سؤال سخت بود قدم‌به‌قدم توضیح بده.
- موقع جواب‌های فنی، دقیق باش و اطلاعات اشتباه نده؛ اگه مطمئن نیستی صادقانه بگو «واقعیتش مطمئن نیستم داداش» و بهترین حدست رو با ذکر اینکه حدسته بگو.
- کد که خواستن، تمیز و به‌روز بنویس (بلاک کد با \`\`\` ) و خودمونی توضیحش بده.
- شعر، جوک، داستان کوتاه، ناز و بازی با کلمات رو عاشقانه انجام می‌دی.
- نظر خاص خودتو داری؛ اگه نظر خواستن، محکم و با دلیل نظر بده، بی‌طرف الکی نباش.
- یادت باشه کاربر رفیقه؛ جوری جواب بده که حس کنه داره با یه آدم باحال حرف می‌زنه، نه یه دایرةالمعارف.

# دقت (خیلی خیلی مهم — حرف اول!)
- هیچ‌وقت از خودت اطلاعات نساز و قلاب نکن! اگه چیزی رو واقعاً نمی‌دونی، صادقانه بگو نمی‌دونم؛ اعتماد کاربر از همه‌چیز مهم‌تره.
- قبل از جواب دادن، خوب فکر کن و مطمئن شو دقیقاً همون چیزی رو گفتی که کاربر پرسیده؛ به سؤالش خوب گوش کن.
- محاسبات ریاضی رو قدم‌به‌قدم و دو بار چک کن؛ عدد اشتباه نده.
- اسم، تاریخ و آمار رو فقط وقتی بگو که مطمئنی؛ وگرنه بگو «حدسم اینه که…».
- جواب‌ها رو با سؤال کاربر چک کن: آیا واقعاً به دردش می‌خوره؟ اگر سؤال مبهمه، یه سؤال کوتاه برگردون تا دقیق بفهمی چی می‌خواد.

# حافظه
- تو حافظهٔ دائمی داری و همهٔ چت‌های قبلیت با کاربر رو یادته؛ اسم، سلیقه، شغل و هر چی گفته.
${
  currentTitle
    ? `- عنوان این گفتگوی فعلی: «${currentTitle}»\n`
    : ''
}${memoryText ? `\n# خاطرات چت‌های قبلی\n${memoryText}\n` : ''}
# قانون طلایی
- خاطرات بالا فقط برای اینه که بدونی کاربر قبلاً باهات درباره چی حرف زده؛ طبیعی ازشون استفاده کن و نشون بده یادته، ولی اگه ربطی به حرف فعلی ندارن الکی خودتو درگیرشون نکن.
- جوابهات فقط متن ساده یا مارک‌دون باشه؛ بدون HTML.`

  return base + (power ? POWER_ADDON : '')
}

export type ChatMsg = { role: 'user' | 'assistant'; content: string }

/* ---------- مارکرهای محتوای خاص ---------- */
export const MARKER_IMG = 'TEKA_IMG::' // عکس ساخته‌شدهٔ تکا (data URL)
export const MARKER_UIMG = 'TEKA_UIMG::' // عکسی که کاربر فرستاده + سؤالش
export const MARKER_FILE = 'TEKA_FILE::' // فایلی که کاربر فرستاده: name::size::سؤال

/**
 * ⚠️ رفع باگ: دادهٔ خام (base64 عکس‌ها) نباید هیچ‌وقت وارد کانتکست مدل بشه
 * وگرنه هزاران توکن هدر می‌ره و جواب خراب می‌شه.
 * این تابع مارکرها رو به متن ساده و کوتاه تبدیل می‌کنه.
 */
export function plainForModel(content: string): string {
  if (content.startsWith(MARKER_IMG)) {
    return '[تکا اینجا یه عکس براش کشید 🎨]'
  }
  if (content.startsWith(MARKER_UIMG)) {
    const rest = content.slice(MARKER_UIMG.length)
    const nl = rest.indexOf('\n')
    const question = (nl >= 0 ? rest.slice(nl + 1) : '').trim()
    return `[کاربر یه عکس فرستاد${question ? ` و گفت: ${truncate(question, 200)}` : ''}]`
  }
  if (content.startsWith(MARKER_FILE)) {
    const rest = content.slice(MARKER_FILE.length)
    const parts = rest.split('::')
    const name = (parts[0] ?? 'فایل').trim()
    const question = parts.slice(2).join('::').trim()
    return `[کاربر فایل «${name}» رو فرستاد${question ? ` و گفت: ${truncate(question, 200)}` : ''}]`
  }
  return content
}

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
      return `- (${date} - چت${title}) ${who}: ${truncate(plainForModel(m.content), MEMORY_SNIPPET)}`
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
      // مارکرهای عکس/فایل به متن ساده تبدیل می‌شن تا base64 وارد کانتکست مدل نشه
      content: plainForModel(
        r.role === 'assistant' ? sanitizeReply(r.content) : r.content
      ),
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
  out = out.replace(
    /<\/?\s*(think|thinking|arg_value|arg_key|arg_type|tool_call|function_call)\s*>/gi,
    ''
  )
  return out.replace(/^\s+|\s+$/g, '')
}

/** تمیز کردن متن برای TTS: مارک‌دون و ایموجی حذف می‌شه */
export function cleanTextForTts(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ') // بلاک کد
    .replace(/`([^`]*)`/g, '$1') // اینلاین کد
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // تصویر
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // لینک
    .replace(/^#{1,6}\s+/gm, '') // هدینگ
    .replace(/[*_~>|]/g, '') // مارک‌دون ساده
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
      ''
    ) // ایموجی
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900)
}
