import { NextRequest, NextResponse } from 'next/server'
import { getZai } from '@/lib/llm'
import { cleanTextForTts } from '@/lib/teka'

/**
 * تبدیل جواب تکا به صدا (برای دکمه «بلند بخون»)
 * خروجی: فایل wav برای پخش توی مرورگر
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const text: unknown = body?.text

    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'متنی برای خوندن نیست!' }, { status: 400 })
    }

    const clean = cleanTextForTts(text)
    if (!clean) {
      return NextResponse.json({ error: 'این پیام قابل خوندن نیست!' }, { status: 400 })
    }

    const zai = await getZai()
    const response = await zai.audio.tts.create({
      input: clean,
      voice: 'tongtong',
      speed: 1.0,
      response_format: 'wav',
      stream: false,
    })

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))

    if (buffer.length === 0) {
      throw new Error('empty audio')
    }

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[api/tts] error:', err)
    return NextResponse.json(
      { error: 'صدا ساخته نشد! یه بار دیگه امتحان کن.' },
      { status: 500 }
    )
  }
}
