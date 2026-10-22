import { db } from '@/lib/db'
import { callLlm, getZai } from '@/lib/llm'
import { DRAW_MARKER } from '@/lib/teka'

/* ---------- مارکر تصویر ---------- */
export const IMAGE_MARKER = 'TEKA_IMG::'

export { DRAW_MARKER }

/**
 * ⭐ پرامپت مهندسی‌شده برای دقت حداکثری
 * نکتهٔ مهم: اسم سلبریتی‌ها رو نگه می‌داریم (مدل تصویر خیلیا رو می‌شناسه و
 * شباهت خیلی بهتر درمیاد). فقط چهره‌های سیاسی/مذهبی توصیف می‌شن.
 */
const ENRICH_SYSTEM = `You are a world-class prompt engineer for text-to-image AI models. The user gives you a short (often Persian) image description.
Rewrite it as ONE highly detailed ENGLISH image prompt.

Rules:
- Keep the EXACT subject the user asked for — never replace or drop it.
- If the subject is an actor, singer, athlete, artist or fictional character (e.g. an actress), KEEP the name — the image model knows famous people and draws better likeness with the real name.
- If the subject is a political or religious figure, do NOT name them; describe their general look instead (age, hair, beard, glasses, clothing style).
- Add rich visual details: composition, camera angle, lighting, color palette, textures, mood, background, art style (photorealistic / cinematic / illustration...).
- End with quality tags like: ultra detailed, intricate details, sharp focus, professional lighting, 8k, masterpiece.
- Maximum 90 words. Output ONLY the English prompt text — no explanations, no quotes.`

/** نسخهٔ امن و خانوادگی می‌سازه (وقتی فیلتر محتوا گیر داد) — سوژه باید قابل‌تشخیص بمونه */
const SOFTEN_SYSTEM = `You rewrite image prompts that were REJECTED by an image model's content filter, so they pass safely.

Rules:
- KEEP the core subject recognizable — the user must still see what they asked for.
- Real people: NEVER name them; describe a fictional character inspired by their GENERAL look (hair, clothing style, vibe).
- Remove/replace ONLY what triggers filters: violence, blood, horror, skeletons/skulls/bones, zombies, weapons, gore, alcohol, drugs, smoking, nudity or revealing clothes, political/religious symbols, flags, national emblems.
- Keep everything else: setting, mood, colors, composition.
- Output ONE vivid ENGLISH prompt, max 45 words, stylized as colorful cartoon or cinematic illustration.
- Output ONLY the prompt text — no explanations, no quotes.`

/** آخرین تلاش: فقط سوژهٔ اصلی، خیلی کوتاه و ساده */
const MINIMAL_SYSTEM = `Reduce the user's image request to its absolute CORE subject in English.
Max 14 words, ultra simple, wholesome and safe (no people's names, no violence, no politics, no religion, no nudity).
Example: "a cute cat sitting on the moon, colorful cartoon style".
Output ONLY the prompt text.`

/** کلمات پرریسک: اگه توی پرامپت بودن، مستقیم می‌ریم سراغ نسخهٔ امن (صرفه‌جویی در زمان) */
const RISKY_PATTERNS = [
  // جنسی / برهنه
  /پورن|سکس|سکسی|لخت|برهنه|عریان|نیمه ?برهنه|کون|کیر|جنده|حشری|لاپا|سوتین|بیکینی|بدن سیدنی|بدنش/i,
  /\bnude|naked|nsfw|porn|sex|sexy|lingerie|bikini|topless|erotic\b/i,
  // خشونت / ترس
  /خون|کشتار|قتل|کشتن|خشونت|بریدن|سر برید|اسکلت|استخوان|جمجمه|زامبی|آدم‌خوار|شیطان|جن\b|ارواح|تسلی|شبح|کابوس|ترسناک|له میکنه|له کنه|زیر پاش/i,
  /\bblood|gore|murder|kill|zombie|skeleton|skull|demon|devil|ghost|horror|behead|corpse\b/i,
  // سلاح
  /اسلحه|تفنگ|خنجر|چاقو زدن|سلاح|بمب|تروریست/i,
  /\bgun|rifle|knife attack|bomb|terrorist|weapon\b/i,
  // مشروب / مواد
  /مشروب|شراب|قالیان|قلیون|سیگار|مواد مخدر|تریاک/i,
  /\balcohol|wine|beer|drunk|cigarette|shisha|hookah|drug|cocaine|weed\b/i,
  // سیاست / مذهب
  /ترامپ|بایدن|پوتین|نتانیاهو|خامنه ?ای|رئیسی|آیت ?الله|امام خمینی|رهبر|جمهوری ?اسلامی/i,
  /\btrump|biden|putin|netanyahu|khamenei|ayatollah|prophet|quran\b/i,
]

function isRisky(prompt: string): boolean {
  return RISKY_PATTERNS.some((re) => re.test(prompt))
}

/**
 * ⭐ روتر سریع: تشخیص «این پیام درخواست عکسه؟» با رجکس.
 * فقط الگوهای خیلی مطمئن — اینا مستقیم می‌رن سراغ تصویرساز بدون دور LLM اضافه.
 * نکته: «بسازم/بکشم» (فعل اول‌شخص) عمداً رد می‌شه چون سؤال دربارهٔ عکسه، نه درخواست کشیدن.
 */
const DIRECT_IMAGE_PATTERNS: RegExp[] = [
  // اسم + فعل امری: عکس بساز / تصویر درست کن / لوگو طراحی کن / پوستر بکش
  /(عکس|تصویر|لوگو|پوستر|بنر|کاریکاتور|پرتره|نقاشی)\s*(بساز|درست\s?کن|طراحی\s?کن|بکش|بکاش|بزن)(?![یمدنن])/u,
  // نقاشی کن / نقاشی بزن
  /نقاشی\s*(کن|بزن)(?![یمدنن])/u,
  // «بکش» آخر جمله: سیدنی سوینی رو بکش!
  /(?<![یمدنن])بکشش?\s*[!!.،؟\s]*$/u,
  // «بکش» به‌عنوان کلمهٔ مستقل وسط جمله: یه عکس از قلعه بکش با ماه
  /(^|[\s،؛(])بکشش?[\s،؛).!؟]/u,
  // انگلیسی
  /\b(draw|paint|sketch|illustrate)\b/i,
  /\b(generate|make|create|design)\b[^.!?]{0,30}\b(image|picture|photo|logo|poster|art)\b/i,
]

export function looksLikeImageRequest(message: string): boolean {
  const t = message.trim()
  if (!t || t.length > 600) return false
  return DIRECT_IMAGE_PATTERNS.some((re) => re.test(t))
}

/**
 * تلهٔ ضدتقلید: تشخیص جواب‌هایی که ادعا می‌کنن عکس کشیده/ساخته شده ولی
 * مارکر TEKA_DRAW ندارن (مدل از یادداشت‌های تاریخی تقلید کرده).
 * فقط الگوهای «ادعای ساختن/فرستادن عکس» — نه توضیح دربارهٔ عکاسی و فتوشاپ.
 */
export const FAKE_DRAW_RE =
  /\[تکا اینجا یه عکس|ابزار تصویرساز[^.]{0,30}(اجرا|ساخته|کشیده|ارسال)|یه عکس (برات|براش) (کشیدم|ساختم|فرستادم)|(عکس|نقاشی|تصویر)[^.]{0,15}(برات|براش)[^.]{0,10}(کشیدم|ساختم|فرستادم)|(کشیدم|ساختم) (و )?برات (فرستادم|ارسال کردم)|عکس[^.]{0,20}(ساخته و ارسال|کشیده و ارسال)/i

/**
 * استخراج پرامپت نقاشی از جواب مدل (اگه با TEKA_DRAW:: شروع شده یا توش باشه).
 * خروجی: پرامپت یا null.
 */
export function extractDrawPrompt(reply: string): string | null {
  if (!reply) return null
  const idx = reply.indexOf(DRAW_MARKER)
  if (idx < 0) return null
  let prompt = reply
    .slice(idx + DRAW_MARKER.length)
    .split('\n')[0]
    .trim()
    .replace(/^["'`«]+|["'`»]+$/g, '')
    .trim()
  // اگه مدل توضیح اضافه بعد از پرامپت گذاشت، جاهای خالی رو تمیز کن
  prompt = prompt.replace(/\s+/g, ' ')
  if (!prompt || prompt.length < 2) return null
  return prompt.slice(0, 600)
}

/** پرامپت کاربر رو به یه پرامپت حرفه‌ای و پرجزئیات انگلیسی تبدیل می‌کنه */
async function enrichPrompt(prompt: string): Promise<string> {
  try {
    const enriched = await callLlm(
      [
        { role: 'assistant', content: ENRICH_SYSTEM },
        { role: 'user', content: prompt },
      ],
      false,
      false
    )
    if (enriched && enriched.trim()) {
      const cleaned = enriched.trim().replace(/^"|"$/g, '')
      if (/^[\x00-\xFF]+$/.test(cleaned.slice(0, 80))) {
        // اگه تگ کیفیت نداشت، خودم اضافه می‌کنم (دقت حداکثری)
        if (!/detailed|8k|masterpiece|sharp/i.test(cleaned)) {
          return `${cleaned}, ultra detailed, intricate details, sharp focus, professional lighting, 8k, masterpiece`
        }
        return cleaned
      }
    }
  } catch (err) {
    console.warn('[image-draw] enrich failed, using raw prompt:', err)
  }
  return prompt
}

/** پرامپت رو به نسخهٔ امن تبدیل می‌کنه (برای رد شدن از فیلتر محتوا) */
async function rewritePrompt(system: string, prompt: string): Promise<string | null> {
  try {
    const rewritten = await callLlm(
      [
        { role: 'assistant', content: system },
        { role: 'user', content: prompt },
      ],
      false,
      false
    )
    const cleaned = rewritten?.trim().replace(/^"|"$/g, '')
    if (cleaned && /^[\x00-\xFF]+$/.test(cleaned.slice(0, 80))) return cleaned
  } catch (err) {
    console.warn('[image-draw] rewrite failed:', err)
  }
  return null
}

type ImageCreate = (args: { prompt: string; size: string }) => Promise<{ data?: { base64?: string }[] }>

async function drawImage(zai: Awaited<ReturnType<typeof getZai>>, prompt: string): Promise<string> {
  const response = await (zai.images.generations.create as unknown as ImageCreate)({
    prompt,
    size: '1024x1024',
  })
  const base64 = response.data?.[0]?.base64
  if (!base64) throw new Error('empty image response')
  return base64
}

/**
 * زنجیرهٔ نجات تصویرساز 🎨 (نسخهٔ ۴)
 * - پرامپت‌های پرریسک مستقیم می‌رن سراغ نسخهٔ امن؛ بقیه اول پرجزئیات کشیده می‌شن.
 * - اسم سلبریتی‌ها تو پرامپت غنی‌شده می‌مونه (شباهت بهتر)؛ اگه فیلتر رد کرد،
 *   مراحل بعدی خودش نجاتش می‌ده.
 * - اگه هیچ‌مرحله‌ای جواب نداد، null برمی‌گرده تا تکا «متنی» توضیح بده (بدون ارور مرده).
 */
export async function drawWithRescue(
  zai: Awaited<ReturnType<typeof getZai>>,
  rawPrompt: string
): Promise<string | null> {
  const risky = isRisky(rawPrompt)

  // ---------- مسیر پرریسک: اول امن‌سازی، بعد جزئیات ----------
  if (risky) {
    console.info('[image-draw] risky prompt detected → safe path')
    const softened = await rewritePrompt(SOFTEN_SYSTEM, rawPrompt)
    if (softened) {
      const enrichedSafe = await enrichPrompt(softened)
      for (const candidate of [softened, enrichedSafe]) {
        try {
          return await drawImage(zai, candidate)
        } catch (err) {
          console.warn('[image-draw] safe-path draw failed:', err)
        }
      }
    }
    // نسخهٔ فوق‌ساده
    const minimal = await rewritePrompt(MINIMAL_SYSTEM, rawPrompt)
    if (minimal) {
      try {
        return await drawImage(zai, minimal)
      } catch (err) {
        console.warn('[image-draw] safe-minimal draw failed:', err)
      }
    }
    return null
  }

  // ---------- مسیر عادی ----------
  const detailed = await enrichPrompt(rawPrompt)

  // ۱) پرامپت مهندسی‌شدهٔ پرجزئیات (اسم سلبریتی‌ها حفظ شده)
  try {
    return await drawImage(zai, detailed)
  } catch (err) {
    console.warn('[image-draw] detailed attempt failed:', err)
  }

  // ۲) پرامپت خام کاربر
  try {
    return await drawImage(zai, rawPrompt)
  } catch (err) {
    console.warn('[image-draw] raw attempt failed:', err)
  }

  // ۳) نسخهٔ امن و خانوادگی (برای رد شدن از فیلتر)
  const softened = await rewritePrompt(SOFTEN_SYSTEM, rawPrompt)
  if (softened) {
    try {
      return await drawImage(zai, softened)
    } catch (err) {
      console.warn('[image-draw] softened attempt failed:', err)
    }
  }

  // ۴) آخرین تلاش: فوق‌ساده با سوژهٔ اصلی
  const minimal = await rewritePrompt(MINIMAL_SYSTEM, rawPrompt)
  if (minimal) {
    try {
      return await drawImage(zai, minimal)
    } catch (err) {
      console.warn('[image-draw] minimal attempt failed:', err)
    }
  }

  return null
}

/** پیام متنی دوستانه وقتی هیچ‌عکسی ساخته نشد (به‌جای ارور مرده) */
export async function gracefulFallbackText(rawPrompt: string): Promise<string> {
  const aiMsg = await callLlm(
    [
      {
        role: 'assistant',
        content:
          'تو تکا هستی؛ هوش مصنوعی خودمونی فارسی. کاربر از تصویرساز تو خواسته چیزی بکشی ولی فیلتر امنیتی سرویس تصویر، همهٔ تلاش‌های تو رو رد کرده (سوژهٔ حساس: آدم معروف سیاسی، خشونت یا محتوای نامناسب).',
      },
      {
        role: 'user',
        content: `درخواستش این بود: «${rawPrompt}». با ۲-۳ جملهٔ کوتاه و خودمونی (با ایموجی) صادقانه بگو که فیلتر نقاشی این سوژه رو قبول نکرد، ناراحتش نکن، و ۲ تا پیشنهاد جایگزین خفن بده که بتونی براش بکشی (نزدیک به همون حس، ولی قابل قبول برای فیلتر). فقط همین، بدون مقدمه.`,
      },
    ],
    false,
    false
  )
  return (
    aiMsg?.trim() ||
    'داداش، فیلتر نقاشی این سوژه رو قبول نکرد 😅 ولی اگه یه ذره‌ی دیگه عوضش کنی یا سوژهٔ بامزه‌تری بخوای، من آماده‌ام! 🎨'
  )
}

/**
 * ⭐ کشیدن + ذخیره در پس‌زمینه (آسنکرون)
 * route سریع جواب «processing» می‌ده و این تابع خودش تو پس‌زمینه عکس رو
 * می‌کشه و تو دیتابیس ذخیره می‌کنه؛ فرانت با polling مال خودشو برمی‌داره.
 * دیگه هیچ‌وقت پروکسی وسط راه کانکشن رو نمی‌کشه چون جواب فوریه!
 */
export async function drawAndSaveBackground(
  conversationId: string,
  drawPrompt: string
): Promise<void> {
  try {
    const zai = await getZai()
    const base64 = await drawWithRescue(zai, drawPrompt)
    const content = base64
      ? `${IMAGE_MARKER}data:image/png;base64,${base64}`
      : await gracefulFallbackText(drawPrompt)

    await db.message.create({
      data: { conversationId, role: 'assistant', content },
    })
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })
  } catch (err) {
    console.error('[image-draw] background draw failed:', err)
    // حداقل یه پیام بذار که فرانت تو polling بی‌نهایت گیر نکنه
    try {
      await db.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content:
            'داداش نقاشی قاطی شد! 😅 دوباره بگو «بکش» تا از اول امتحان کنم، این دفعه حتماً درست می‌شه!',
        },
      })
      await db.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      })
    } catch {
      /* دیگه کاری نمی‌شه کرد */
    }
  }
}
