'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Feather,
  ImagePlus,
  Laugh,
  Lightbulb,
  Loader2,
  Mic,
  Puzzle,
  SendHorizonal,
  Sparkles,
  Square,
  Wand2,
  Coffee,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { TekaRecorder, blobToDataUrl } from '@/lib/audio-recorder'

const MAX_RECORD_MS = 60_000

type ChatInputProps = {
  value: string
  onChange: (v: string) => void
  onSend: (text: string) => void
  onSendImage: (text: string) => void
  sending: boolean
  power: boolean
}

const QUICK_TOOLS: { icon: React.ElementType; text: string }[] = [
  { icon: Laugh, text: 'یه جک خفن بگو 😂' },
  { icon: Feather, text: 'یه شعر کوتاه قشنگ بگو 🌹' },
  { icon: Lightbulb, text: 'یه فکت جالب که نمی‌دونستم بگو 💡' },
  { icon: Puzzle, text: 'یه معمای باحال بده 🧩' },
  { icon: Wand2, text: 'یه کپشن اینستاگرامی خفن بنویس ✨' },
  { icon: Coffee, text: 'حوصله‌م سر رفته، سرگرمم کن ☕' },
  { icon: Sparkles, text: 'برام یه برنامهٔ موفقیت می‌چینی؟ 🎯' },
]

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ChatInput({ value, onChange, onSend, onSendImage, sending, power }: ChatInputProps) {
  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<TekaRecorder | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const [imageMode, setImageMode] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const clearTimers = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current)
      tickTimerRef.current = null
    }
  }, [])

  // موقع بستن صفحه ضبط رو قطع کن
  useEffect(() => {
    return () => {
      clearTimers()
      recorderRef.current?.abort()
    }
  }, [clearTimers])

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }

  const submit = () => {
    const text = value.trim()
    if (!text || sending || recording || transcribing) return
    if (imageMode) {
      onSendImage(text)
    } else {
      onSend(text)
    }
    onChange('')
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  // ---------- میکروفن ----------
  const stopAndTranscribe = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || !recorder.isRecording) return
    clearTimers()
    setRecording(false)
    setTranscribing(true)
    try {
      const blob = await recorder.stop()
      if (blob.size < 2000) {
        throw new Error('خیلی کوتاه بود! دوباره و کمی بلندتر بگو 🎤')
      }
      const dataUrl = await blobToDataUrl(blob)
      const res = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'صدا به متن تبدیل نشد!')
      }
      const text: string = (data?.text ?? '').trim()
      if (text) {
        const prev = valueRef.current.trim()
        onChange(prev ? `${prev} ${text}` : text)
        toast({ title: 'شنیدم! 🎤', description: 'متنش رفت توی چت، چکش کن بعد بفرست.' })
      }
    } catch (err) {
      toast({
        title: 'اووپس!',
        description: err instanceof Error ? err.message : 'صدات ضبط نشد!',
        variant: 'destructive',
      })
    } finally {
      setTranscribing(false)
    }
  }, [clearTimers, onChange, toast])

  const toggleMic = useCallback(async () => {
    if (transcribing) return
    if (recording) {
      void stopAndTranscribe()
      return
    }
    try {
      if (!recorderRef.current) recorderRef.current = new TekaRecorder()
      await recorderRef.current.start()
      setRecording(true)
      setRecordSeconds(0)
      tickTimerRef.current = setInterval(
        () => setRecordSeconds((s) => s + 1),
        1000
      )
      maxTimerRef.current = setTimeout(() => {
        void stopAndTranscribe()
      }, MAX_RECORD_MS)
    } catch {
      toast({
        title: 'میکروفن باز نشد! 🎤',
        description: 'اجازهٔ دسترسی به میکروفن رو بده داداش.',
        variant: 'destructive',
      })
    }
  }, [recording, stopAndTranscribe, toast, transcribing])

  const busy = sending || recording || transcribing

  const placeholder = recording
    ? `دارم گوش می‌دم… 🎤 (${formatSeconds(recordSeconds)})`
    : transcribing
      ? 'دارم صدات رو تبدیل می‌کنم… ⏳'
      : imageMode
        ? 'چی برام بکشم داداش؟ 🎨 مثلا: یه روباه فضایی'
        : sending
          ? power
            ? 'تکا داره عمیق فکر می‌کنه… ⚡🤔'
            : 'تکا داره فکر می‌کنه… 🤔'
          : 'پیامت رو بنویس یا بگو تا بنویسم… 🎤'

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="border-t border-border/60 bg-background/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:px-6"
    >
      <div className="mx-auto max-w-3xl">
        {/* ابزارک‌های سریع */}
        {!recording && !transcribing && (
          <div
            className="teka-scroll mb-2 flex gap-1.5 overflow-x-auto pb-1"
            aria-label="ابزارک‌های سریع"
          >
            {QUICK_TOOLS.map((tool) => (
              <button
                key={tool.text}
                onClick={() => {
                  if (!busy) onSend(tool.text)
                }}
                disabled={busy}
                className="teka-glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-lg hover:shadow-primary/10 active:scale-95 disabled:opacity-50"
              >
                <tool.icon className="size-3.5 text-primary" />
                <span className="whitespace-nowrap">{tool.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* نوار ضبط فعال */}
        {recording && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 flex items-center justify-center gap-2 rounded-full bg-destructive/10 px-4 py-1.5 text-xs font-semibold text-destructive"
            role="status"
          >
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
            </span>
            در حال ضبط — {formatSeconds(recordSeconds)} (حداکثر ۱ دقیقه)
          </motion.div>
        )}

        {/* اینپوت شیشه‌ای */}
        <div className="teka-glass-strong flex items-end gap-1.5 rounded-3xl p-2 transition-shadow focus-within:shadow-primary/25">
          <label htmlFor="teka-input" className="sr-only">
            پیامت رو بنویس
          </label>
          <textarea
            id="teka-input"
            ref={textareaRef}
            value={value}
            rows={1}
            maxLength={imageMode ? 600 : 4000}
            placeholder={placeholder}
            className="max-h-[150px] min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-7 outline-none placeholder:text-muted-foreground"
            onChange={(e) => {
              onChange(e.target.value)
              resize()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            disabled={sending}
          />

          {/* میکروفن */}
          <Button
            size="icon"
            onClick={() => void toggleMic()}
            disabled={sending || transcribing}
            variant={recording ? 'destructive' : 'ghost'}
            className={`size-11 shrink-0 rounded-2xl transition-transform hover:scale-105 active:scale-95 ${
              recording ? 'teka-rec' : 'text-muted-foreground'
            }`}
            aria-label={recording ? 'تموم کردن ضبط' : 'حرف زدن با تکا'}
            title={recording ? 'تموم کن و تبدیل به متن کن' : 'با صدا بگو'}
          >
            {transcribing ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : recording ? (
              <Square className="size-4.5 fill-current" />
            ) : (
              <Mic className="size-5" />
            )}
          </Button>

          {/* حالت تصویرساز */}
          <Button
            size="icon"
            onClick={() => setImageMode((v) => !v)}
            disabled={sending}
            variant={imageMode ? 'default' : 'ghost'}
            className={`size-11 shrink-0 rounded-2xl transition-transform hover:scale-105 active:scale-95 ${
              imageMode ? 'shadow-lg shadow-primary/40' : 'text-muted-foreground'
            }`}
            aria-pressed={imageMode}
            aria-label="حالت تصویرساز"
            title="حالت تصویرساز: از نوشته‌ت عکس بساز"
          >
            <ImagePlus className="size-5" />
          </Button>

          {/* ارسال */}
          <Button
            size="icon"
            onClick={submit}
            disabled={sending || !value.trim() || recording || transcribing}
            className="teka-shine size-11 shrink-0 rounded-2xl shadow-md shadow-primary/25 transition-transform hover:scale-105 active:scale-95"
            aria-label={imageMode ? 'ساخت تصویر' : 'ارسال پیام'}
          >
            <SendHorizonal className="size-5 -scale-x-100" />
          </Button>
        </div>

        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center text-[11px] text-muted-foreground">
          <span className="hidden sm:inline">Enter بفرست • Shift+Enter خط جدید •</span>
          {imageMode ? (
            <span className="font-semibold text-primary">🎨 حالت تصویرساز فعاله</span>
          ) : power ? (
            <span className="font-semibold text-primary">حالت قدرتمند فعاله ⚡</span>
          ) : (
            <span>تکا ممکنه اشتباه کنه؛ چک مهم کن داداش 😉</span>
          )}
        </p>
      </div>
    </motion.div>
  )
}
