import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { makeTitle, sanitizeInput } from '@/lib/teka'
import { drawAndSaveBackground } from '@/lib/image-draw'

/**
 * تصویرساز تکا (نسخهٔ آسنکرون ⚡):
 * پیام کاربر ذخیره می‌شه، نقاشی تو پس‌زمینه شروع می‌شه و «همین حالا»
 * جواب processing برمی‌گرده — دیگه هیچ پروکسی و تایم‌اوتی نمی‌تونه قطعش کنه.
 * فرانت با polling پیام آماده‌شده رو برمی‌داره.
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

    const cleanPrompt = sanitizeInput(prompt.trim())
    if (!cleanPrompt) {
      return NextResponse.json(
        { error: 'بگو چی بکشم داداش! 🎨' },
        { status: 400 }
      )
    }

    const user = await getUserFromRequest(req)

    // ۱) پیدا کردن یا ساختن گفتگو
    let conversation =
      typeof conversationId === 'string' && conversationId
        ? await db.conversation.findUnique({ where: { id: conversationId } })
        : null

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { title: makeTitle(`🎨 ${cleanPrompt}`), userId: user?.id ?? null },
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

    // ۳) ⭐ شروع نقاشی در پس‌زمینه (بدون await) — جواب فوری برمی‌گرده
    void drawAndSaveBackground(conversation.id, cleanPrompt)

    return NextResponse.json({
      conversationId: conversation.id,
      title: conversation.title,
      processing: true,
    })
  } catch (err) {
    console.error('[api/image] error:', err)
    return NextResponse.json(
      { error: 'نقاشی قاطی شد داداش! 😅 یه بار دیگه امتحان کن.' },
      { status: 500 }
    )
  }
}
