import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { makeTitle } from '@/lib/teka'
import { MARKER_UIMG, buildSystemPrompt, loadHistory, plainForModel } from '@/lib/teka'
import { getZai } from '@/lib/llm'
import { sanitizeReply } from '@/lib/teka'

/** پیام‌های چندرسانه‌ای برای مدل بینایی */
type VisionPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type VisionMsg = { role: 'system' | 'user' | 'assistant'; content: string | VisionPart[] }

/** مدل بینایی گیت‌وی */
const VISION_MODEL = 'glm-5v-turbo'

type VisionCompletion = { choices?: { message?: { content?: string } }[] }

type VisionClient = {
  createVision: (body: {
    model: string
    messages: VisionMsg[]
    thinking: { type: 'disabled' }
  }) => Promise<VisionCompletion>
}

/** حالت بینایی: تکا عکس رو دقیق تحلیل می‌کنه */
const VISION_ADDON = `

# حالت بینایی 👁️ (فعال شد!)
- الان کاربر یه عکس برات فرستاده؛ اول با دقت کامل عکس رو نگاه کن، همه‌جزییاتش رو ببین بعد جواب بده.
- اگه عکس متن داره (سند، نوشته، لیست، کد...)، متنش رو درست بخون و اگه لازم بود عیناً نقل کن.
- اشیا، آدم‌ها، رنگ‌ها، مکان‌ها، سبک عکس و هر چیز مهم دیگه رو توصیف کن.
- اگه توی عکس چیزی عجیبه یا جواب سؤال کاربر هست، مستقیم و دقیق بگو.
- اگه عکس بی‌کیفیت بود یا چیزی معلوم نبود، صادقانه بگو کجاش رو خوب نمی‌بینی.
- فارسی خودمونی همیشگی، ولی تحلیل دقیق و حرفه‌ای!`

/** تبدیل data URL به base64 خالص */
function stripDataUrl(dataUrl: string): { base64: string; mime: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) return null
  return { mime: match[1], base64: match[2] }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const image: unknown = body?.image
    const question: unknown = body?.question
    const conversationId: unknown = body?.conversationId

    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'عکسی نرسید داداش! یه عکس واقعی بفرست 📷' },
        { status: 400 }
      )
    }

    const parsed = stripDataUrl(image)
    if (!parsed) {
      return NextResponse.json(
        { error: 'فرمت عکس رو نمی‌شناسم! JPG یا PNG بفرست 📷' },
        { status: 400 }
      )
    }
    // حداکثر ~۸ مگابایت عکس (base64)
    if (parsed.base64.length > 11_000_000) {
      return NextResponse.json(
        { error: 'عکس خیلی حجیمه! یه عکس سبک‌تر بفرست 📷' },
        { status: 413 }
      )
    }

    const cleanQuestion =
      typeof question === 'string' && question.trim()
        ? question.trim().slice(0, 2000)
        : 'این عکس رو کامل برام تحلیل کن؛ همه‌چیزش رو دقیق توضیح بده!'

    // ۱) پیدا کردن یا ساختن گفتگو
    let conversation =
      typeof conversationId === 'string' && conversationId
        ? await db.conversation.findUnique({ where: { id: conversationId } })
        : null

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { title: makeTitle(`📷 ${cleanQuestion}`) },
      })
    }

    // ۲) ذخیرهٔ پیام کاربر (با مارکر تا توی UI هم عکس نمایش داده بشه)
    const userContent = `${MARKER_UIMG}${image}\n${cleanQuestion}`
    await db.message.create({
      data: { conversationId: conversation.id, role: 'user', content: userContent },
    })

    // ۳) کانتکست: تاریخچه + خاطرات کوتاه از چت‌های دیگه
    const [history, memoryText] = await Promise.all([
      loadHistory(conversation.id),
      db.message
        .findMany({
          where: { conversationId: { not: conversation.id } },
          orderBy: { createdAt: 'desc' },
          take: 40,
          select: { content: true },
        })
        .then((rows) =>
          rows
            .reverse()
            .map((r) => plainForModel(r.content))
            .join('\n')
            .slice(-4000)
        ),
    ])

    const systemPrompt =
      buildSystemPrompt(
        memoryText ? `چند تا خاطرهٔ اخیر از چت‌های دیگه:\n${memoryText}` : '',
        conversation.title
      ) + VISION_ADDON

    // ۴) صدا زدن مدل بینایی
    const messages: VisionMsg[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-12).map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${cleanQuestion}\n\n(عکس پیوست‌شده رو با دقت کامل تحلیل کن)`,
          },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ]

    const zai = await getZai()
    let reply: string | null = null
    let lastErr: unknown = null

    const visionApi = zai.chat.completions as unknown as VisionClient

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const completion = await visionApi.createVision({
          model: VISION_MODEL,
          messages,
          thinking: { type: 'disabled' },
        })
        const content = completion.choices?.[0]?.message?.content
        if (content && content.trim()) {
          reply = sanitizeReply(content)
          break
        }
      } catch (err) {
        lastErr = err
        if (attempt < 2) await new Promise((r) => setTimeout(r, 700))
      }
    }

    if (!reply) {
      console.error('[api/vision] failed:', lastErr)
      return NextResponse.json(
        {
          error: 'چشمم قاطی شد داداش! 😵‍💫 عکس بار دیگه بفرست یا یه عکس واضح‌تر انتخاب کن.',
          conversationId: conversation.id,
        },
        { status: 502 }
      )
    }

    // ۵) ذخیرهٔ جواب
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
    console.error('[api/vision] unexpected error:', err)
    return NextResponse.json(
      { error: 'تحلیل عکس قاطی شد! یه بار دیگه امتحان کن 📷' },
      { status: 500 }
    )
  }
}
