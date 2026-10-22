import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import {
  buildMemoryText,
  buildSystemPrompt,
  loadHistory,
  makeTitle,
  TEKA_CREATOR,
  TEKA_NAME,
} from '@/lib/teka'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const message: unknown = body?.message
    const conversationId: unknown = body?.conversationId

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

    // ۳) ساخت کانتکست: تاریخچهٔ این چت + حافظهٔ همهٔ چت‌های قبلی
    const [history, memoryText] = await Promise.all([
      loadHistory(conversation.id),
      buildMemoryText(conversation.id),
    ])

    const systemPrompt = buildSystemPrompt(memoryText, conversation.title)

    // ۴) صدا زدن مدل
    const zai = await getZai()
    let reply = ''
    let lastError: unknown = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'assistant', content: systemPrompt },
            ...history,
          ],
          thinking: { type: 'disabled' },
        })
        const content = completion.choices[0]?.message?.content
        if (content && content.trim()) {
          reply = content.trim()
          break
        }
        throw new Error('empty response')
      } catch (err) {
        lastError = err
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800 * attempt))
        }
      }
    }

    if (!reply) {
      console.error('[api/chat] LLM failed:', lastError)
      return NextResponse.json(
        {
          error: `اووپس، یه چیزی قاطی شد! الان مغزم یه کم گرمه 🙈 دوباره بفرست پیامت رو. (${TEKA_NAME} - ساختهٔ ${TEKA_CREATOR})`,
          conversationId: conversation.id,
        },
        { status: 502 }
      )
    }

    // ۵) ذخیرهٔ جواب تکا
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
