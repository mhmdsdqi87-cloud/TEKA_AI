import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { makeTitle } from '@/lib/teka'
import { callLlm, getZai } from '@/lib/llm'

const IMAGE_MARKER = 'TEKA_IMG::'

/** پرامپت مهندسی‌شده برای جزئیات حداکثری */
const ENRICH_SYSTEM = `You are a world-class prompt engineer for text-to-image AI models. The user gives you a short (often Persian) image description.
Rewrite it as ONE highly detailed ENGLISH image prompt.

Rules:
- Keep the exact subject and meaning the user asked for — never replace the subject.
- If the subject is a real or famous person, DO NOT name them; instead describe a fictional character with their general look, vibe and style (e.g. "a glamorous young blonde Hollywood-style actress in an elegant evening dress").
- Add rich visual details: composition, camera angle, lighting, color palette, textures, mood, background, art style (photorealistic / cinematic / illustration...).
- End with quality tags like: ultra detailed, intricate details, sharp focus, professional lighting, 8k, masterpiece.
- Maximum 90 words. Output ONLY the English prompt text — no explanations, no quotes.`

/** نسخهٔ امن و خانوادگی می‌سازه (وقتی فیلتر محتوا گیر داده) — سوژه باید قابل‌تشخیص بمونه */
const SOFTEN_SYSTEM = `You rewrite image prompts that were REJECTED by an image model's content filter, so they pass safely.

Rules:
- KEEP the core subject recognizable — the user must still see what they asked for.
- Real people (celebrities, politicians, religious figures): NEVER name them; describe a fictional cartoon/illustration character inspired by their GENERAL look (hair, clothing style, vibe) — e.g. a politician with yellow hair becomes "a cartoon of a confident businessman with bright yellow hair and a red tie".
- Remove/replace ONLY what triggers filters: violence, blood, horror, skeletons/skulls/bones, zombies, weapons, gore, alcohol, drugs, smoking, nudity or revealing clothes, political/religious symbols, flags, national emblems.
- Keep everything else: setting, mood, colors, composition.
- Output ONE vivid ENGLISH prompt, max 45 words, stylized as colorful cartoon or cinematic illustration.
- Output ONLY the prompt text — no explanations, no quotes.`

/** آخرین تلاش: فقط سوژهٔ اصلی، خیلی کوتاه و ساده */
const MINIMAL_SYSTEM = `Reduce the user's image request to its absolute CORE subject in English.
Max 14 words, ultra simple, wholesome and safe (no people's names, no violence, no politics, no religion, no nudity).
Example: "a cute cat sitting on the moon, colorful cartoon style".
Output ONLY the prompt text.`

/** کلمات پرریسک: اگه توی پرامپت بودن، مستقیم می‌ریم سراغ نسخهٔ امن (صرفه‌جویی در زمان و نرخ موفقیت بالاتر) */
const RISKY_PATTERNS = [
  // جنسی / برهنه
  /پورن|سکس|سکسی|لخت|برهنه|عریان|نیمه ?برهنه|کون|کیر|جنده|حشری|لاپا|سوتین|بیکینی|بکن|بکنش|بدنش|بدن سیدنی|سکسی/i,
  /\bnude|naked|nsfw|porn|sex|sexy|lingerie|bikini|topless|erotic\b/i,
  // خشونت / ترس
  /خون|کشتار|قتل|کشتن|خشونت|بریدن|سر برید|اسکلت|استخوان|جمجمه|زامبی|آدم‌خوار|شیطان|جن|ارواح|تسلی|شبح|کابوس|ترسناک/i,
  /\bblood|gore|murder|kill|zombie|skeleton|skull|demon|devil|ghost|horror|behead|corpse\b/i,
  // سلاح
  /اسلحه|تفنگ|خنجر|چاقو زدن|سلاح|بمب|تروریست/i,
  /\bgun|rifle|knife attack|bomb|terrorist|weapon\b/i,
  // مشروب / مواد
  /مشروب|شراب|الف|قالیان|قلیون|سیگار|مواد مخدر|گل|تریاک/i,
  /\balcohol|wine|beer|drunk|cigarette|shisha|hookah|drug|cocaine|weed\b/i,
  // سیاست / مذهب / پرچم
  /ترامپ|بایرن|بایدن|پوتین|نتانیاهو|خامنه ?ای|خامنه‌ای|رئیسی|آیت ?الله|امام|رهبر|جمهوری ?اسلامی|علم|پرچم/i,
  /\btrump|biden|putin|netanyahu|khamenei|president|ayatollah|prophet|quran|bible|flag\b/i,
]

function isRisky(prompt: string): boolean {
  return RISKY_PATTERNS.some((re) => re.test(prompt))
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
    console.warn('[api/image] enrich failed, using raw prompt:', err)
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
    console.warn('[api/image] rewrite failed:', err)
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
 * زنجیرهٔ نجات تصویرساز 🎨 (نسخهٔ ۳)
 * پرامپت‌های پرریسک مستقیم می‌رن سراغ نسخهٔ امن؛ بقیه اول پرجزئیات کشیده می‌شن.
 * اگه هیچ‌مرحله‌ای جواب نداد، null برمی‌گرده تا تکا «متنی» توضیح بده (بدون ارور مرده).
 */
async function drawWithRescue(
  zai: Awaited<ReturnType<typeof getZai>>,
  rawPrompt: string
): Promise<string | null> {
  const risky = isRisky(rawPrompt)

  // ---------- مسیر پرریسک: اول امن‌سازی، بعد جزئیات ----------
  if (risky) {
    console.info('[api/image] risky prompt detected → safe path')
    const softened = await rewritePrompt(SOFTEN_SYSTEM, rawPrompt)
    if (softened) {
      // نسخهٔ امن رو غنی‌سازی می‌کنیم تا دقیق و پرجزئیات دربیاد
      const enrichedSafe = await enrichPrompt(softened)
      for (const candidate of [softened, enrichedSafe]) {
        try {
          return await drawImage(zai, candidate)
        } catch (err) {
          console.warn('[api/image] safe-path draw failed:', err)
        }
      }
    }
    // نسخهٔ فوق‌ساده
    const minimal = await rewritePrompt(MINIMAL_SYSTEM, rawPrompt)
    if (minimal) {
      try {
        return await drawImage(zai, minimal)
      } catch (err) {
        console.warn('[api/image] safe-minimal draw failed:', err)
      }
    }
    return null
  }

  // ---------- مسیر عادی ----------
  const detailed = await enrichPrompt(rawPrompt)

  // ۱) پرامپت مهندسی‌شدهٔ پرجزئیات
  try {
    return await drawImage(zai, detailed)
  } catch (err) {
    console.warn('[api/image] detailed attempt failed:', err)
  }

  // ۲) پرامپت خام کاربر (اگه مشکل از خود غنی‌سازی بود)
  try {
    return await drawImage(zai, rawPrompt)
  } catch (err) {
    console.warn('[api/image] raw attempt failed:', err)
  }

  // ۳) نسخهٔ امن و خانوادگی (برای رد شدن از فیلتر)
  const softened = await rewritePrompt(SOFTEN_SYSTEM, rawPrompt)
  if (softened) {
    try {
      return await drawImage(zai, softened)
    } catch (err) {
      console.warn('[api/image] softened attempt failed:', err)
    }
  }

  // ۴) آخرین تلاش: فوق‌ساده با سوژهٔ اصلی
  const minimal = await rewritePrompt(MINIMAL_SYSTEM, rawPrompt)
  if (minimal) {
    try {
      return await drawImage(zai, minimal)
    } catch (err) {
      console.warn('[api/image] minimal attempt failed:', err)
    }
  }

  return null
}

/** پیام متنی دوستانه وقتی هیچ‌عکسی ساخته نشد (به‌جای ارور مرده) */
async function gracefulFallbackText(rawPrompt: string): Promise<string> {
  // تکا خودش با لحن خودمونی توضیح می‌ده و پیشنهاد جایگزین می‌ده
  const aiMsg = await callLlm(
    [
      {
        role: 'assistant',
        content:
          'تو تکا هستی؛ هوش مصنوعی خودمونی فارسی. کاربر از تصویرساز تو خواسته چیزی بکشی ولی فیلتر امنیتی سرویس تصویر، همهٔ تلاش‌های تو رو رد کرده (سوژهٔ حساس: آدم معروف، سیاسی، مذهبی، خشونت یا محتوای نامناسب).',
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
 * تصویرساز تکا: از متن یه عکس هنری می‌سازه.
 * پیام کاربر و جواب تصویری (به‌صورت data URL) توی دیتابیس ذخیره می‌شن
 * تا توی حافظه و تاریخچه هم بمونن.
 * اگه فیلتر همه‌چیز رو رد کرد، تکا با پیام متنی خودمونی توضیح می‌ده (نه ارور!).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const prompt: unknown = body?.prompt
    const conversationId: unknown = body?.conversationId

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'بگو چی بکشم داداش! 🎨' },
        { status: 400 }
      )
    }
    if (prompt.length > 600) {
      return NextResponse.json(
        { error: 'توضیح عکس خیلی طولانیه! تا ۶۰۰ کاراکتر بگو.' },
        { status: 400 }
      )
    }

    const cleanPrompt = prompt.trim()

    // ۱) پیدا کردن یا ساختن گفتگو
    let conversation =
      typeof conversationId === 'string' && conversationId
        ? await db.conversation.findUnique({ where: { id: conversationId } })
        : null

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { title: makeTitle(`🎨 ${cleanPrompt}`) },
      })
    }

    // ۲) ذخیرهٔ درخواست کاربر (تا تکا هم یادش بمونه)
    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: `🎨 درخواست تصویر: ${cleanPrompt}`,
      },
    })

    // ۳) کشیدن با زنجیرهٔ نجات
    const zai = await getZai()
    const base64 = await drawWithRescue(zai, cleanPrompt)

    let content: string
    if (base64) {
      content = `${IMAGE_MARKER}data:image/png;base64,${base64}`
    } else {
      // ⭐ fallback دوستانه: به‌جای ارور، تکا متنی توضیح می‌ده
      content = await gracefulFallbackText(cleanPrompt)
    }

    // ۴) ذخیرهٔ جواب تکا
    const saved = await db.message.create({
      data: { conversationId: conversation.id, role: 'assistant', content },
    })
    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      conversationId: conversation.id,
      title: conversation.title,
      reply: {
        id: saved.id,
        role: 'assistant' as const,
        content,
        createdAt: saved.createdAt,
      },
    })
  } catch (err) {
    console.error('[api/image] error:', err)
    return NextResponse.json(
      { error: 'نقاشی قاطی شد داداش! 😅 یه بار دیگه امتحان کن.' },
      { status: 500 }
    )
  }
}
