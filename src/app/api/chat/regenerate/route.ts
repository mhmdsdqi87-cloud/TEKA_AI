import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildMemoryText,
  buildSystemPrompt,
  loadHistory,
} from '@/lib/teka'
import { callLlm, getZai } from '@/lib/llm'
import {
  IMAGE_MARKER,
  drawWithRescue,
  extractDrawPrompt,
  gracefulFallbackText,
  FAKE_DRAW_RE,
} from '@/lib/image-draw'

type RouteBody = { conversationId?: string; power?: boolean }

/**
 * دوباره جواب دادن: آخرین جواب تکا حذف می‌شه و یه جواب تازه ساخته می‌شه.
 * اگه آخرین پیام جواب نبود (مثلاً ارور قبلاً پیش اومده)، فقط جواب جدید می‌سازه.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as RouteBody | null
    const conversationId = body?.conversationId
    const power = body?.power === true

    if (typeof conversationId !== 'string' || !conversationId) {
      return NextResponse.json({ error: 'چتی انتخاب نشده!' }, { status: 400 })
    }

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!conversation) {
      return NextResponse.json({ error: 'این چت پیدا نشد!' }, { status: 404 })
    }

    // آخرین پیام
    const lastMessages = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
    const last = lastMessages[0]

    // اگه آخرین پیام جواب تکاست، پاکش کن که جواب تازه جایگزینش شه
    if (last && last.role === 'assistant') {
      await db.message.delete({ where: { id: last.id } })
    }

    // مطمئن شو حداقل یه پیام کاربر هست
    const userMsgCount = await db.message.count({
      where: { conversationId, role: 'user' },
    })
    if (userMsgCount === 0) {
      return NextResponse.json({ error: 'چیزی برای جواب دوباره نیست!' }, { status: 400 })
    }

    // کانتکست و صدا زدن مدل
    const [history, memoryText] = await Promise.all([
      loadHistory(conversationId),
      buildMemoryText(conversationId),
    ])
    const systemPrompt = buildSystemPrompt(memoryText, conversation.title, power)

    const reply = await callLlm(
      [{ role: 'assistant', content: systemPrompt }, ...history],
      power
    )

    if (!reply) {
      return NextResponse.json(
        { error: 'جواب جدید نیومد! یه بار دیگه امتحان کن داداش.' },
        { status: 502 }
      )
    }

    // ⭐ اگه جواب جدید درخواست نقاشی بود، عکس واقعی بساز
    let content = reply
    const drawPrompt = extractDrawPrompt(reply)
    if (drawPrompt) {
      const zai = await getZai()
      const base64 = await drawWithRescue(zai, drawPrompt)
      content = base64
        ? `${IMAGE_MARKER}data:image/png;base64,${base64}`
        : await gracefulFallbackText(drawPrompt)
    } else if (FAKE_DRAW_RE.test(reply)) {
      // تلهٔ ضدتقلید: مدل ادعا کرد عکس کشیده ولی مارکر نداد
      const lastUser = history.filter((m) => m.role === 'user').pop()
      const zai = await getZai()
      const base64 = await drawWithRescue(
        zai,
        lastUser?.content?.slice(0, 600) || 'یه نقاشی خفن و خلاقانه'
      )
      content = base64
        ? `${IMAGE_MARKER}data:image/png;base64,${base64}`
        : await gracefulFallbackText(lastUser?.content?.slice(0, 600) || 'نقاشی')
    }

    const saved = await db.message.create({
      data: { conversationId, role: 'assistant', content },
    })
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      reply: { id: saved.id, role: 'assistant', content, createdAt: saved.createdAt },
    })
  } catch (err) {
    console.error('[api/chat/regenerate] error:', err)
    return NextResponse.json(
      { error: 'یه چیزی قاطی شد! دوباره امتحان کن.' },
      { status: 500 }
    )
  }
}
