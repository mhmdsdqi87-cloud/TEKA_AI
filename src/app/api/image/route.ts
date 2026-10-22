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
- Add rich visual details: composition, camera angle, lighting, color palette, textures, mood, background, style (photorealistic / cinematic / illustration...).
- Add quality tags at the end like: ultra detailed, sharp focus, 8k, masterpiece.
- Maximum 90 words. Output ONLY the English prompt text — no explanations, no quotes.`

/** نسخهٔ کاملاً امن و خانوادگی می‌سازه (وقتی فیلتر محتوا گیر داده) */
const SOFTEN_SYSTEM = `You rewrite image prompts that were REJECTED by an image model's content filter, so they pass safely.

Rules:
- Keep the CORE subject and overall idea recognizable — the user must still get what they asked for.
- Remove or replace anything that can trigger filters: violence, blood, horror, skeletons/bones/skulls, zombies, monsters, weapons, gore, scary faces, alcohol, drugs, smoking, gambling, nudity or revealing clothes, religious or political symbols/figures, real celebrity or brand names, national flags/emblems.
- Replace flagged elements with cute, wholesome, colorful alternatives (e.g. "skeleton hat" -> "colorful striped beanie", "zombie" -> "funny green cartoon monster costume").
- Output ONE simple cheerful ENGLISH prompt, max 40 words, family-friendly, positive mood.
- Output ONLY the prompt text — no explanations, no quotes.`

/** آخرین تلاش: فقط سوژهٔ اصلی، خیلی کوتاه و ساده */
const MINIMAL_SYSTEM = `Reduce the user's image request to its absolute CORE subject in English.
Max 12 words, ultra simple, wholesome and safe (no people's names, no violence, no politics, no religion).
Example: "a cute cat on the moon, cartoon style".
Output ONLY the prompt text.`

/** پرامپت کاربر رو به یه پرامپت حرفه‌ای و پرجزئیات انگلیسی تبدیل می‌کنه */
async function enrichPrompt(prompt: string): Promise<string> {
  try {
    const enriched = await callLlm(
      [
        { role: 'assistant', content: ENRICH_SYSTEM },
        { role: 'user', content: prompt },
      ],
      false
    )
    if (enriched && enriched.trim()) {
      // اگه مدل به‌جای پرامپت توضیح فارسی داد، ازش استفاده نکن
      const cleaned = enriched.trim().replace(/^"|"$/g, '')
      if (/^[\x00-\xFF]+$/.test(cleaned.slice(0, 80))) return cleaned
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
 * زنجیرهٔ نجات تصویرساز 🎨
 * ۱) پرامپت پرجزئیات (دقیق با تمام جزییات)
 * ۲) پرامپت خام کاربر
 * ۳) نسخهٔ امن‌شده (دور زدن فیلتر محتوا)
 * ۴) نسخهٔ فوق‌ساده (فقط سوژهٔ اصلی)
 */
async function drawWithRescue(zai: Awaited<ReturnType<typeof getZai>>, rawPrompt: string): Promise<string> {
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
      console.error('[api/image] minimal attempt failed:', err)
    }
  }

  throw new Error('all image attempts failed')
}

/**
 * تصویرساز تکا: از متن یه عکس هنری می‌سازه.
 * پیام کاربر و جواب تصویری (به‌صورت data URL) توی دیتابیس ذخیره می‌شن
 * تا توی حافظه و تاریخچه هم بمونن.
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
    let base64: string | null = null
    try {
      base64 = await drawWithRescue(zai, cleanPrompt)
    } catch (err) {
      console.error('[api/image] all attempts failed:', err)
    }

    if (!base64) {
      return NextResponse.json(
        { error: 'نقاشی قاطی شد داداش! 😅 یه بار دیگه امتحان کن یا سوژه رو یه ذره ساده‌تر بگو.' },
        { status: 502 }
      )
    }

    const dataUrl = `data:image/png;base64,${base64}`
    const content = `${IMAGE_MARKER}${dataUrl}`

    // ۴) ذخیرهٔ تصویر به‌عنوان جواب تکا
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
