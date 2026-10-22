import { NextRequest, NextResponse } from 'next/server'
import { getZai } from '@/lib/llm'

/**
 * تبدیل صدای کاربر به متن (میکروفن چت)
 * ورودی: data URL صدا (wav) به‌صورت base64
 * خروجی: { text }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const audio: unknown = body?.audio

    if (typeof audio !== 'string' || audio.trim().length === 0) {
      return NextResponse.json({ error: 'صدایی نرسید داداش! دوباره بگو.' }, { status: 400 })
    }

    // جدا کردن هدر data URL
    const base64 = audio.includes(',') ? audio.slice(audio.indexOf(',') + 1) : audio

    // حداکثر ~۱۵ مگابایت صدا
    if (base64.length > 20_000_000) {
      return NextResponse.json(
        { error: 'صدا خیلی طولانی شد! کوتاه‌تر و شیواتر حرف بزن 🎤' },
        { status: 413 }
      )
    }

    const zai = await getZai()
    const result = await zai.audio.asr.create({ file_base64: base64 })
    const text = (result?.text ?? '').trim()

    if (!text) {
      return NextResponse.json(
        { error: 'نشنیدم چی گفتی! یه کم بلندتر بگو 🔉' },
        { status: 422 }
      )
    }

    return NextResponse.json({ text })
  } catch (err) {
    console.error('[api/asr] error:', err)
    return NextResponse.json(
      { error: 'تبدیل صدا به متن قاطی شد! یه بار دیگه امتحان کن 🎙️' },
      { status: 500 }
    )
  }
}
