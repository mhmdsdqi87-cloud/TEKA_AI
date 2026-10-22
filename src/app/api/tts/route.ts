import { NextRequest, NextResponse } from 'next/server'
import { getZai } from '@/lib/llm'
import { cleanTextForTts } from '@/lib/teka'

/**
 * 🔊 تبدیل جواب تکا به صدا (نسخهٔ ۲ — «فارسی روان»)
 * - متن‌های بلند به تکه‌های ≤۹۵۰ کاراکتری شکسته می‌شن (محدودیت API: ۱۰۲۴)
 * - فایل‌های WAV تکه‌ها با هدر درست به هم می‌چسپن → یک فایل پیوسته
 * - سرعت و صدا قابل تنظیمه (کلاینت می‌تونه بفرسته)
 */

const VOICES = new Set(['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo'])

/** تقسیم متن روی مرز جمله‌های فارسی */
function splitForTts(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const sentences = text.match(/[^.!؟?;\n]+[.!؟?;\n]*/g) ?? [text]
  const chunks: string[] = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + s).length <= maxLen) {
      cur += s
      continue
    }
    if (cur.trim()) chunks.push(cur.trim())
    if (s.length <= maxLen) {
      cur = s
      continue
    }
    // جملهٔ خیلی بلند: تکه‌تکه روی فاصله
    let rest = s
    while (rest.length > maxLen) {
      let cut = rest.lastIndexOf(' ', maxLen)
      if (cut < maxLen * 0.5) cut = maxLen
      chunks.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut)
    }
    cur = rest
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks
}

/** پیدا کردن چانک داخل فایل WAV (fmt / data) */
function findChunk(buf: Buffer, id: string): { offset: number; size: number } | null {
  let pos = 12 // رد کردن RIFF size + 'WAVE'
  while (pos + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    if (chunkId === id) return { offset: pos + 8, size }
    pos += 8 + size + (size % 2)
  }
  return null
}

/** چسباندن چند فایل WAV به یک فایل پیوسته (نمونه‌ریت و کانال‌ها باید یکسان باشن) */
function concatWav(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) throw new Error('no audio')
  if (buffers.length === 1) return buffers[0]

  const first = buffers[0]
  const fmt = findChunk(first, 'fmt ')
  const audioFormat = fmt ? fmt.readUInt16LE(fmt.offset) : 1
  const channels = fmt ? fmt.readUInt16LE(fmt.offset + 2) : 1
  const sampleRate = fmt ? fmt.readUInt32LE(fmt.offset + 4) : 24000
  const bitsPerSample = fmt ? fmt.readUInt16LE(fmt.offset + 14) : 16
  const blockAlign = (channels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign

  const parts: Buffer[] = []
  let dataLen = 0
  for (const b of buffers) {
    const data = findChunk(b, 'data') ?? { offset: 44, size: Math.max(0, b.length - 44) }
    parts.push(b.subarray(data.offset, data.offset + data.size))
    dataLen += data.size
  }

  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + dataLen, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(audioFormat, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(dataLen, 40)

  return Buffer.concat([header, ...parts])
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const text: unknown = body?.text
    const voiceRaw: unknown = body?.voice
    const speedRaw: unknown = body?.speed

    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'متنی برای خوندن نیست!' }, { status: 400 })
    }

    const voice = typeof voiceRaw === 'string' && VOICES.has(voiceRaw) ? voiceRaw : 'xiaochen'
    let speed = 1.0
    if (typeof speedRaw === 'number' && Number.isFinite(speedRaw)) {
      speed = Math.min(2.0, Math.max(0.5, speedRaw))
    }

    const clean = cleanTextForTts(text, 4000)
    if (!clean) {
      return NextResponse.json({ error: 'این پیام قابل خوندن نیست!' }, { status: 400 })
    }

    const chunks = splitForTts(clean, 950)
    const zai = await getZai()
    const buffers: Buffer[] = []

    for (const chunk of chunks) {
      let buf: Buffer | null = null
      let rateLimited = false
      // هر تکه ۳ تلاش با بک‌آف فزاینده — ۴۲۹/۵۰۰ سرور نرم هندل می‌شه
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await zai.audio.tts.create({
            input: chunk,
            voice,
            speed,
            response_format: 'wav',
            stream: false,
          })
          const arrayBuffer = await response.arrayBuffer()
          const b = Buffer.from(new Uint8Array(arrayBuffer))
          if (b.length > 44) {
            buf = b
            break
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes('429')) rateLimited = true
          if (attempt >= 3) {
            if (msg.includes('429')) throw err // ریت‌لیمیت واقعی — کل درخواست ۵۰۰
            break // ارور موقت سرور — به‌جای ارور کل، همونی که داریم بدیم
          }
          await new Promise((r) =>
            setTimeout(r, rateLimited ? 2000 * attempt : 1200 * attempt)
          )
        }
      }
      if (buf) buffers.push(buf)
      else if (buffers.length === 0) throw new Error('empty audio')
      // اگه تکه‌های قبلی اومده، نیمه‌کاره رو بدیم بهتر از اروره
    }

    const out = concatWav(buffers)

    return new NextResponse(out as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': out.length.toString(),
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
