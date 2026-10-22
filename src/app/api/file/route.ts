import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import {
  MARKER_FILE,
  buildSystemPrompt,
  loadHistory,
  makeTitle,
  plainForModel,
  sanitizeReply,
} from '@/lib/teka'
import { callLlm } from '@/lib/llm'

/** حداکثر حجم فایل: ~۱۰ مگابایت (به‌صورت base64 حدود ۱۴ میلیون کاراکتر) */
const MAX_BASE64 = 14_000_000
/** حداکثر کاراکتر متن استخراج‌شده که به مدل داده می‌شه */
const MAX_TEXT_CHARS = 90_000

const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yml', 'yaml',
  'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c',
  'cpp', 'cs', 'go', 'rs', 'rb', 'php', 'sh', 'bat', 'sql', 'log',
  'ini', 'toml', 'env', 'svg', 'vue', 'svelte', 'kt', 'swift',
])

function fileExt(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

function stripDataUrl(dataUrl: string): string | null {
  const idx = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || idx < 0) return null
  return dataUrl.slice(idx + 1)
}

/** استخراج متن از فایل بر اساس نوعش */
async function extractText(
  name: string,
  mime: string,
  buffer: Buffer
): Promise<string> {
  const ext = fileExt(name)

  // ---------- PDF ----------
  if (ext === 'pdf' || mime === 'application/pdf') {
    const { extractText: extractPdf, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractPdf(pdf, { mergePages: true })
    const merged = Array.isArray(text) ? text.join('\n') : text
    return merged || ''
  }

  // ---------- Word (docx) ----------
  if (ext === 'docx' || mime.includes('wordprocessingml')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  }

  // ---------- متن/کد ----------
  if (
    ext === 'doc' ||
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    TEXT_EXT.has(ext)
  ) {
    return buffer.toString('utf8')
  }

  throw new UnsupportedError()
}

class UnsupportedError extends Error {
  constructor() {
    super('unsupported file type')
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const name: unknown = body?.name
    const mime: unknown = body?.mime
    const dataUrl: unknown = body?.dataUrl
    const question: unknown = body?.question
    const conversationId: unknown = body?.conversationId
    const power: boolean = body?.power === true

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'اسم فایل نیومده!' }, { status: 400 })
    }
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return NextResponse.json(
        { error: 'محتوای فایل نرسید! دوباره امتحان کن 📄' },
        { status: 400 }
      )
    }

    const base64 = stripDataUrl(dataUrl)
    if (!base64) {
      return NextResponse.json(
        { error: 'محتوای فایل خراب رسیده! دوباره آپلود کن 📄' },
        { status: 400 }
      )
    }
    if (base64.length > MAX_BASE64) {
      return NextResponse.json(
        { error: 'فایل خیلی حجیمه داداش! تا ۱۰ مگابایت بفرست 📄' },
        { status: 413 }
      )
    }

    const cleanName = name.trim().slice(0, 200)
    const cleanMime = typeof mime === 'string' ? mime : ''
    const sizeBytes = Math.floor((base64.length * 3) / 4)

    // ---------- استخراج متن ----------
    let fileText = ''
    try {
      const buffer = Buffer.from(base64, 'base64')
      fileText = await extractText(cleanName, cleanMime, buffer)
    } catch (err) {
      if (err instanceof UnsupportedError) {
        return NextResponse.json(
          {
            error:
              'این نوع فایل رو فعلاً نمی‌تونم بخونم! 📄 PDF، Word (docx)، متن و کد بفرست.',
          },
          { status: 415 }
        )
      }
      console.error('[api/file] extract failed:', err)
      return NextResponse.json(
        {
          error:
            'نتونستم متن این فایل رو دربیارم! 😵‍💫 شاید اسکن‌شده یا قفل باشه؛ یه نسخهٔ ساده‌تر بفرست.',
        },
        { status: 422 }
      )
    }

    fileText = fileText.replace(/\u0000/g, '').trim()

    if (!fileText) {
      return NextResponse.json(
        {
          error:
            'فایلت خالی به نظر می‌رسه یا متن قابل خوندنی نداره! 🤔 یه فایل متن‌دار بفرست.',
        },
        { status: 422 }
      )
    }

    const truncated = fileText.length > MAX_TEXT_CHARS
    const fileContent = truncated
      ? fileText.slice(0, MAX_TEXT_CHARS) + '\n…[ادامهٔ فایل بریده شد]'
      : fileText

    const userQuestion =
      typeof question === 'string' && question.trim()
        ? question.trim().slice(0, 4000)
        : 'این فایل رو کامل برام تحلیل کن: چیه، خلاصه‌ش چیه و نکته‌های مهمش کدوم‌ها هستن؟'

    // ---------- گفتگو ----------
    let conversation =
      typeof conversationId === 'string' && conversationId
        ? await db.conversation.findUnique({ where: { id: conversationId } })
        : null

    if (!conversation) {
      const user = await getUserFromRequest(req)
      conversation = await db.conversation.create({
        data: { title: makeTitle(`📄 ${userQuestion}`), userId: user?.id ?? null },
      })
    }

    // ذخیرهٔ پیام کاربر (فقط اسم و حجم فایل ذخیره می‌شه، نه محتوا)
    const userContent = `${MARKER_FILE}${cleanName}::${sizeBytes}::${userQuestion}`
    await db.message.create({
      data: { conversationId: conversation.id, role: 'user', content: userContent },
    })

    // ---------- کانتکست و صدا زدن مدل ----------
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

    const systemPrompt = buildSystemPrompt(
      memoryText ? `چند تا خاطرهٔ اخیر از چت‌های دیگه:\n${memoryText}` : '',
      conversation.title,
      power
    )

    const reply = await callLlm(
      [
        { role: 'assistant', content: systemPrompt },
        ...history.slice(-12),
        {
          role: 'user',
          content: [
            `کاربر فایل «${cleanName}» رو فرستاده${truncated ? ' (خیلی بزرگه، یه بخشیش رو می‌بینی)' : ''}.`,
            `سؤال/درخواستش: ${userQuestion}`,
            ``,
            `لطفاً به‌صورت فارسی خودمونی (لحن همیشگی‌ت) فایل رو تحلیل کن؛ دقیق، ساختارمند و مفید. اگه فایل جدول یا داده‌ایه، خلاصهٔ آماری هم بده. اگه کده، مشکلاتش رو بگو.`,
            ``,
            `===== شروع محتوای فایل «${cleanName}» =====`,
            fileContent,
            `===== پایان محتوای فایل =====`,
          ].join('\n'),
        },
      ],
      power
    )

    if (!reply) {
      return NextResponse.json(
        {
          error: 'تحلیل فایل قاطی شد داداش! 😵‍💫 یه بار دیگه امتحان کن.',
          conversationId: conversation.id,
        },
        { status: 502 }
      )
    }

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
    console.error('[api/file] unexpected error:', err)
    return NextResponse.json(
      { error: 'آنالیز فایل قاطی شد! یه بار دیگه امتحان کن 📄' },
      { status: 500 }
    )
  }
}
