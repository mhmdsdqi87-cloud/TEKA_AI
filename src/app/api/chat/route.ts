import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import {
  buildMemoryText,
  buildSystemPrompt,
  loadHistory,
  makeTitle,
  parseMood,
  sanitizeInput,
  sanitizeReply,
  TEKA_CREATOR,
  TEKA_NAME,
} from '@/lib/teka'
import { callLlm, callLlmStream } from '@/lib/llm'
import {
  drawAndSaveBackground,
  extractDrawPrompt,
  looksLikeImageRequest,
  FAKE_DRAW_RE,
} from '@/lib/image-draw'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const message: unknown = body?.message
    const conversationId: unknown = body?.conversationId
    const power: boolean = body?.power === true
    const wantsStream: boolean = body?.stream === true

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

    const cleanMessage = sanitizeInput(message.trim())

    const user = await getUserFromRequest(req)
    const mood = parseMood(body?.mood)

    // ۱) پیدا کردن یا ساختن گفتگو
    let conversation =
      typeof conversationId === 'string' && conversationId
        ? await db.conversation.findUnique({ where: { id: conversationId } })
        : null

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { title: makeTitle(cleanMessage), userId: user?.id ?? null },
      })
    }

    // ۲) ذخیرهٔ پیام کاربر
    await db.message.create({
      data: { conversationId: conversation.id, role: 'user', content: cleanMessage },
    })

    // ۳) ⭐ مسیر مستقیم تصویر: درخواست نقاشی واضح → جواب فوری + نقاشی در پس‌زمینه
    //    (استریم اینجا معنی نداره — کلاینت خودش میره سراغ polling)
    if (looksLikeImageRequest(cleanMessage)) {
      console.info('[api/chat] direct image request detected → background pipeline')
      void drawAndSaveBackground(conversation.id, cleanMessage)
      return NextResponse.json({
        conversationId: conversation.id,
        title: conversation.title,
        processing: true,
      })
    }

    // ۴) ساخت کانتکست: تاریخچهٔ این چت + حافظهٔ همهٔ چت‌های قبلی
    const [history, memoryText] = await Promise.all([
      loadHistory(conversation.id),
      buildMemoryText(conversation.id),
    ])

    const systemPrompt = buildSystemPrompt(memoryText, conversation.title, power, mood)

    // ۵) ⚡ حالت استریم: جواب حرف‌به‌حرف با SSE — کاربر همون لحظه حروف رو می‌بینه!
    if (wantsStream) {
      const encoder = new TextEncoder()
      const sse = (event: string, data: unknown) =>
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            controller.enqueue(
              sse('meta', {
                conversationId: conversation.id,
                title: conversation.title,
              })
            )

            let raw = ''
            const full = await callLlmStream(
              [{ role: 'assistant', content: systemPrompt }, ...history],
              power,
              true,
              (t) => {
                raw += t
                try {
                  controller.enqueue(sse('delta', { text: t }))
                } catch {
                  /* کلاینت قطع شده */
                }
              }
            )

            const reply = sanitizeReply(full ?? raw)
            if (!reply || !reply.trim()) {
              controller.enqueue(
                sse('error', {
                  error: `مغزم یه لحظه داغ کرد داداش! 🙈 یه بار دیگه بفرست، این دفعه حتماً جواب می‌دم! (${TEKA_NAME} - ساختهٔ ${TEKA_CREATOR})`,
                })
              )
              controller.close()
              return
            }

            // ۶) مسیر هوشمند تصویر: مدل گفت نقاشی بکشم
            const drawPrompt = extractDrawPrompt(reply)
            if (drawPrompt) {
              console.info('[api/chat] TEKA_DRAW detected → background pipeline')
              void drawAndSaveBackground(conversation.id, drawPrompt)
              controller.enqueue(
                sse('art', {
                  conversationId: conversation.id,
                  title: conversation.title,
                })
              )
              controller.close()
              return
            }

            // ۶.۵) تلهٔ ضدتقلید: ادعای نقاشی بدون مارکر
            if (FAKE_DRAW_RE.test(reply)) {
              console.info('[api/chat] fake-draw claim detected → background pipeline')
              void drawAndSaveBackground(conversation.id, cleanMessage)
              controller.enqueue(
                sse('art', {
                  conversationId: conversation.id,
                  title: conversation.title,
                })
              )
              controller.close()
              return
            }

            // ۷) ذخیرهٔ جواب تکا
            const saved = await db.message.create({
              data: { conversationId: conversation.id, role: 'assistant', content: reply },
            })
            await db.conversation.update({
              where: { id: conversation.id },
              data: { updatedAt: new Date() },
            })

            controller.enqueue(
              sse('done', {
                conversationId: conversation.id,
                title: conversation.title,
                reply: {
                  id: saved.id,
                  role: 'assistant',
                  content: reply,
                  createdAt: saved.createdAt,
                },
              })
            )
            controller.close()
          } catch (err) {
            console.error('[api/chat] stream error:', err)
            try {
              controller.enqueue(
                sse('error', {
                  error: 'ای وای! سرور یه شوخی باحال باهام کرد 😅 یه بار دیگه امتحان کن.',
                })
              )
              controller.close()
            } catch {
              /* استریم قبلاً بسته شده */
            }
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    // ۵‌.۵) حالت معمولی (بدون استریم) — برای سازگاری کامل
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

    // ۶) ⭐ مسیر هوشمند تصویر: مدل گفت نقاشی بکشم (TEKA_DRAW::) → پس‌زمینه
    const drawPrompt = extractDrawPrompt(reply)
    if (drawPrompt) {
      console.info('[api/chat] TEKA_DRAW detected → background pipeline')
      void drawAndSaveBackground(conversation.id, drawPrompt)
      return NextResponse.json({
        conversationId: conversation.id,
        title: conversation.title,
        processing: true,
      })
    }

    // ۶.۵) تلهٔ ضدتقلید: مدل ادعا کرد عکس کشیده ولی مارکر نداد → پس‌زمینه
    if (FAKE_DRAW_RE.test(reply)) {
      console.info('[api/chat] fake-draw claim detected → background pipeline')
      void drawAndSaveBackground(conversation.id, cleanMessage)
      return NextResponse.json({
        conversationId: conversation.id,
        title: conversation.title,
        processing: true,
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
