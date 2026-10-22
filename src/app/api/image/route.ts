import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { makeTitle } from '@/lib/teka'
import { callLlm, getZai } from '@/lib/llm'

const IMAGE_MARKER = 'TEKA_IMG::'

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

    // ۳) ساخت تصویر — اگه فیلتر شد، پرامپت رو به انگلیسی هنری ترجمه کن و دوباره امتحان کن
    const zai = await getZai()
    let base64: string | null = null
    try {
      base64 = await drawImage(zai, cleanPrompt)
    } catch (firstErr) {
      console.warn('[api/image] first attempt failed, translating prompt:', firstErr)
      const translated = await callLlm([
        {
          role: 'assistant',
          content:
            'You are an expert translator for AI image generation. Translate the user\'s prompt into a vivid, concise ENGLISH image prompt. Keep the exact meaning and mood. Output ONLY the English prompt text, nothing else. End with ", high quality, detailed".',
        },
        { role: 'user', content: cleanPrompt },
      ])
      if (translated) {
        try {
          base64 = await drawImage(zai, translated.trim())
        } catch (secondErr) {
          console.error('[api/image] translated attempt failed:', secondErr)
        }
      }
    }

    if (!base64) {
      return NextResponse.json(
        { error: 'نقاشی قاطی شد داداش! 😅 یه بار دیگه یا با کلمات ساده‌تر امتحان کن.' },
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
