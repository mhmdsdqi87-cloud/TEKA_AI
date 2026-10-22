import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildMemoryText,
  buildSystemPrompt,
  loadHistory,
  makeTitle,
  TEKA_CREATOR,
  TEKA_NAME,
} from '@/lib/teka'
import { callLlm, getZai } from '@/lib/llm'
import {
  IMAGE_MARKER,
  drawWithRescue,
  extractDrawPrompt,
  gracefulFallbackText,
  looksLikeImageRequest,
  FAKE_DRAW_RE,
} from '@/lib/image-draw'

/**
 * کشیدن عکس و ذخیرهٔ پیام تصویری — مشترک بین مسیر مستقیم و مسیر TEKA_DRAW
 */
async function drawAndSave(
  conversationId: string,
  drawPrompt: string
): Promise<{ id: string; role: 'assistant'; content: string; createdAt: Date }> {
  const zai = await getZai()
  const base64 = await drawWithRescue(zai, drawPrompt)

  const content = base64
    ? `${IMAGE_MARKER}data:image/png;base64,${base64}`
    : await gracefulFallbackText(drawPrompt)

  const saved = await db.message.create({
    data: { conversationId, role: 'assistant', content },
  })
  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })

  return {
    id: saved.id,
    role: 'assistant' as const,
    content,
    createdAt: saved.createdAt,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const message: unknown = body?.message
    const conversationId: unknown = body?.conversationId
    const power: boolean = body?.power === true

    if (typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'پیام خالیه داداش! یه چیزی بنویس.' },
        { status: 400 }
      )
    }
    if (message.length > 4000) {
      return NextResponse.json(
        { error: 'پیام خیلی طولانیه! تا ۴۰۰۰ کاراکتر بفرست.' },
        { status: 400 }
      )
    }

    const cleanMessage = message.trim()

    // ۱) پیدا کردن یا ساختن گفتگو
    let conversation =
      typeof conversationId === 'string' && conversationId
        ? await db.conversation.findUnique({ where: { id: conversationId } })
        : null

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { title: makeTitle(cleanMessage) },
      })
    }

    // ۲) ذخیرهٔ پیام کاربر
    await db.message.create({
      data: { conversationId: conversation.id, role: 'user', content: cleanMessage },
    })

    // ۳) ⭐ مسیر مستقیم تصویر: درخواست نقاشی واضح → بدون دور اضافهٔ LLM چت!
    //    (این همون جاییه که قبلاً مدل به‌جای عکس HTML می‌نوشت!)
    if (looksLikeImageRequest(cleanMessage)) {
      console.info('[api/chat] direct image request detected → image pipeline')
      const reply = await drawAndSave(conversation.id, cleanMessage)
      return NextResponse.json({
        conversationId: conversation.id,
        title: conversation.title,
        reply,
      })
    }

    // ۴) ساخت کانتکست: تاریخچهٔ این چت + حافظهٔ همهٔ چت‌های قبلی
    const [history, memoryText] = await Promise.all([
      loadHistory(conversation.id),
      buildMemoryText(conversation.id),
    ])

    const systemPrompt = buildSystemPrompt(memoryText, conversation.title, power)

    // ۵) صدا زدن مدل
    const reply = await callLlm(
      [{ role: 'assistant', content: systemPrompt }, ...history],
      power
    )

    if (!reply) {
      return NextResponse.json(
        {
          error: `مغزم یه لحظه داغ کرد داداش! 🙈 یه بار دیگه بفرست، این دفعه حتماً جواب می‌دم! (${TEKA_NAME} - ساختهٔ ${TEKA_CREATOR})`,
          conversationId: conversation.id,
        },
        { status: 502 }
      )
    }

    // ۶) ⭐ مسیر هوشمند تصویر: مدل خودش گفت نقاشی بکشم (TEKA_DRAW::)
    const drawPrompt = extractDrawPrompt(reply)
    if (drawPrompt) {
      console.info('[api/chat] TEKA_DRAW detected → image pipeline')
      const imageReply = await drawAndSave(conversation.id, drawPrompt)
      return NextResponse.json({
        conversationId: conversation.id,
        title: conversation.title,
        reply: imageReply,
      })
    }

    // ۶.۵) تلهٔ ضدتقلید: اگه مدل ادعا کرد عکس کشیده ولی مارکر TEKA_DRAW نداد
    //      یعنی کاربر عکس خواسته و مدل از تاریخچه تقلید کرده — مستقیم تصویرساز رو صدا می‌زنیم
    if (FAKE_DRAW_RE.test(reply)) {
      console.info('[api/chat] fake-draw claim detected → image pipeline')
      const imageReply = await drawAndSave(conversation.id, cleanMessage)
      return NextResponse.json({
        conversationId: conversation.id,
        title: conversation.title,
        reply: imageReply,
      })
    }

    // ۷) ذخیرهٔ جواب تکا
    const saved = await db.message.create({
      data: { conversationId: conversation.id, role: 'assistant', content: reply },
    })
    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      conversationId: conversation.id,
      title: conversation.title,
      reply: { id: saved.id, role: 'assistant', content: reply, createdAt: saved.createdAt },
    })
  } catch (err) {
    console.error('[api/chat] unexpected error:', err)
    return NextResponse.json(
      { error: 'ای وای! سرور یه شوخی باحال باهام کرد 😅 یه بار دیگه امتحان کن.' },
      { status: 500 }
    )
  }
}
