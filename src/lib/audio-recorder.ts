/**
 * ضبط‌کنندهٔ صدای مرورگر برای میکروفن تکا.
 * صدا رو با Web Audio API مستقیم به WAV تبدیل می‌کنه
 * (سازگار با همهٔ مرورگرها و با سرویس ASR).
 */
export class TekaRecorder {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private chunks: Float32Array[] = []
  private recording = false

  get isRecording(): boolean {
    return this.recording
  }

  async start(): Promise<void> {
    if (this.recording) return

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    this.ctx = new Ctx()
    this.chunks = []

    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    }

    this.source.connect(this.processor)
    this.processor.connect(this.ctx.destination)
    this.recording = true
  }

  /** ضبط رو تموم می‌کنه و فایل WAV برمی‌گردونه */
  async stop(): Promise<Blob> {
    this.recording = false

    // یه لحظه صبر تا آخرین بلاک هم جمع شه
    await new Promise((r) => setTimeout(r, 120))

    const sampleRate = this.ctx?.sampleRate ?? 44100
    const blob = encodeWav(this.chunks, sampleRate)

    this.cleanup()
    return blob
  }

  abort(): void {
    this.recording = false
    this.cleanup()
  }

  private cleanup(): void {
    try {
      this.processor?.disconnect()
      this.source?.disconnect()
    } catch {
      /* noop */
    }
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close().catch(() => undefined)
    this.processor = null
    this.source = null
    this.stream = null
    this.ctx = null
  }
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  let total = 0
  for (const c of chunks) total += c.length

  const buffer = new ArrayBuffer(44 + total * 2)
  const view = new DataView(buffer)

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }

  // هدر WAV (PCM 16bit mono)
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + total * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // طول بلاک fmt
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, total * 2, true)

  let offset = 44
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      const s = Math.max(-1, Math.min(1, c[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([view], { type: 'audio/wav' })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}
