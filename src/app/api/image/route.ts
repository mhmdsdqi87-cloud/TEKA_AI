import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { makeTitle } from '@/lib/teka'
import { getZai } from '@/lib/llm'
import {
  IMAGE_MARKER,
  drawWithRescue,
  gracefulFallbackText,
} from '@/lib/image-draw'

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
