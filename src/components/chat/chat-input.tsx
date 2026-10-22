'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Feather,
  FileText,
  ImagePlus,
  Laugh,
  Lightbulb,
  Loader2,
  Lock,
  LogIn,
  Mic,
  Paperclip,
  Puzzle,
  SendHorizonal,
  Sparkles,
  Square,
  Wand2,
  Coffee,
  X,
  Camera,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { TekaRecorder, blobToDataUrl } from '@/lib/audio-recorder'
import {
  ANALYZABLE_ACCEPT,
  formatFileSize,
  readFileAsDataUrl,
  resizeImageToDataUrl,
} from '@/lib/media'

const MAX_RECORD_MS = 60_000
const MAX_FILE_SIZE = 10 * 1024 * 1024 // ۱۰ مگابایت

export type PendingFile = { name: string; mime: string; size: number; dataUrl: string }

type ChatInputProps = {
  value: string
  onChange: (v: string) => void
  onSend: (text: string) => void
  onSendImage: (text: string) => void
  onSendVision: (imageDataUrl: string, question: string) => void
  onSendFile: (file: PendingFile, question: string) => void
  sending: boolean
  analyzing: boolean
  power: boolean
  locked: boolean
  onLockedClick: () => void
  onVoiceSent?: () => void
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

export function ChatInput({
  value,
  onChange,
  onSend,
  onSendImage,
  onSendVision,
  onSendFile,
  sending,
  analyzing,
  power,
  locked,
  onLockedClick,
  onVoiceSent,
}: ChatInputProps) {
  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<TekaRecorder | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const [imageMode, setImageMode] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)

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

  const clearAll = useCallback(() => {
    onChange('')
    setPendingImage(null)
    setPendingFile(null)
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }, [onChange])

  const submit = () => {
    if (sending || recording || transcribing) return
    const text = value.trim()

    if (pendingFile) {
      onSendFile(pendingFile, text)
      clearAll()
      return
    }
    if (pendingImage) {
      onSendVision(pendingImage, text)
      clearAll()
      return
    }

    if (!text) return
    if (imageMode) {
      onSendImage(text)
    } else {
      onSend(text)
    }
    clearAll()
  }

  // ---------- پیوست عکس (برای تحلیل) ----------
  const pickImage = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'این عکس نیست! 📷',
          description: 'یه فایل JPG یا PNG انتخاب کن داداش.',
          variant: 'destructive',
        })
        return
      }
      if (file.size > 15 * 1024 * 1024) {
        toast({
          title: 'عکس خیلی حجیمه! 📷',
          description: 'یه عکس سبک‌تر (زیر ۱۵ مگ) انتخاب کن.',
          variant: 'destructive',
        })
        return
      }
      try {
        const dataUrl = await resizeImageToDataUrl(file)
        setPendingFile(null)
        setPendingImage(dataUrl)
        requestAnimationFrame(resize)
      } catch {
        toast({
          title: 'عکس خونده نشد!',
          description: 'یه بار دیگه امتحان کن داداش.',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

  // ---------- پیوست فایل (برای آنالیز) ----------
  const pickFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'فایل خیلی حجیمه! 📄',
          description: `تا ۱۰ مگابایت پشتیبانی می‌شه؛ این ${formatFileSize(file.size)}ـه!`,
          variant: 'destructive',
        })
        return
      }
      try {
        const dataUrl = await readFileAsDataUrl(file)
        setPendingImage(null)
        setPendingFile({
          name: file.name,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl,
        })
        requestAnimationFrame(resize)
      } catch {
        toast({
          title: 'فایل خونده نشد!',
          description: 'یه بار دیگه امتحان کن داداش.',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

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
        onVoiceSent?.()
      }
    } catch (err) {
      toast({
        title: 'اوه اوه! 🙈',
        description: err instanceof Error ? err.message : 'صدات ضبط نشد!',
        variant: 'destructive',
      })
    } finally {
      setTranscribing(false)
    }
  }, [clearTimers, onChange, toast, onVoiceSent])

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

  const hasAttachment = !!pendingImage || !!pendingFile
  const busy = sending || recording || transcribing

  const placeholder = locked
    ? 'برای چت با تکا اول وارد حسابت شو! 🔒'
    : recording
    ? `دارم گوش می‌دم… 🎤 (${formatSeconds(recordSeconds)})`
    : transcribing
      ? 'دارم صدات رو تبدیل می‌کنم… ⏳'
      : analyzing
        ? 'تکا داره بررسی می‌کنه… 🔍'
        : pendingImage
          ? 'بگو این عکس چیه یا چه سوالی ازش داری… 📷'
          : pendingFile
            ? 'بگو فایلت رو چطوری تحلیل کنم… 📄'
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
        {!recording && !transcribing && !hasAttachment && (
          <div
            className="teka-scroll mb-2 flex gap-1.5 overflow-x-auto pb-1"
            aria-label="ابزارک‌های سریع"
          >
            {QUICK_TOOLS.map((tool) => (
              <button
                key={tool.text}
                onClick={() => {
                  if (locked) {
                    onLockedClick()
                    return
                  }
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

        {/* پیش‌نمایش پیوست‌ها */}
        <AnimatePresence>
          {hasAttachment && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 8, height: 0 }}
              className="mb-2 overflow-hidden"
            >
              <div className="flex items-center gap-2">
                {pendingImage && (
                  <div className="teka-glass relative flex items-center gap-2.5 rounded-2xl p-2 pe-3">
                    <img
                      src={pendingImage}
                      alt="پیش‌نمایش عکس پیوست‌شده"
                      className="size-12 rounded-xl object-cover ring-1 ring-primary/30"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">عکس آمادهٔ تحلیله 👁️</p>
                      <p className="text-[10px] text-muted-foreground">
                        بگو چی ببینم و بفرست!
                      </p>
                    </div>
                    <button
                      onClick={() => setPendingImage(null)}
                      className="absolute -end-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow-md transition-transform hover:scale-110"
                      aria-label="حذف عکس پیوست"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
                {pendingFile && (
                  <div className="teka-glass relative flex items-center gap-2.5 rounded-2xl p-2 pe-3">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                      <FileText className="size-6" />
                    </span>
                    <div className="min-w-0 max-w-[220px]">
                      <p className="truncate text-xs font-semibold" dir="ltr">
                        {pendingFile.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(pendingFile.size)} • آمادهٔ آنالیزه 📄
                      </p>
                    </div>
                    <button
                      onClick={() => setPendingFile(null)}
                      className="absolute -end-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow-md transition-transform hover:scale-110"
                      aria-label="حذف فایل پیوست"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

        {/* بنر قفل: مهمان */}
        {locked && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onLockedClick}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-bold text-foreground transition-all hover:bg-primary/15 active:scale-[0.99]"
            aria-label="ورود به حساب برای چت"
          >
            <Lock className="size-4 text-primary" />
            <span>برای چت با تکا اول وارد حسابت شو</span>
            <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
              <LogIn className="size-3" />
              ورود / ثبت‌نام
            </span>
          </motion.button>
        )}

        {/* اینپوت شیشه‌ای */}
        <div
          className={`teka-glass-strong flex items-end gap-1.5 rounded-3xl p-2 transition-shadow focus-within:shadow-primary/25 ${
            locked ? 'cursor-pointer opacity-90' : ''
          }`}
          onClick={locked ? onLockedClick : undefined}
          role={locked ? 'button' : undefined}
          aria-label={locked ? 'برای فعال‌شدن چت، وارد شو' : undefined}
        >
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
              if (locked) return
              onChange(e.target.value)
              resize()
            }}
            onKeyDown={(e) => {
              if (locked) return
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            readOnly={locked}
            disabled={sending}
          />

          {/* پیوست: عکس یا فایل */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                disabled={busy || locked}
                variant="ghost"
                className={`size-11 shrink-0 rounded-2xl transition-transform hover:scale-105 active:scale-95 ${
                  hasAttachment ? 'text-primary' : 'text-muted-foreground'
                }`}
                aria-label="پیوست عکس یا فایل"
                title="عکس یا فایل بفرست"
              >
                <Paperclip className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              className="rounded-2xl border-primary/20 bg-card/90 backdrop-blur-xl"
            >
              <DropdownMenuItem
                onClick={() => imageInputRef.current?.click()}
                className="gap-2.5 rounded-xl py-2.5 text-sm"
              >
                <Camera className="size-4.5 text-primary" />
                <div className="flex flex-col">
                  <span className="font-semibold">📷 عکس بفرست</span>
                  <span className="text-[11px] text-muted-foreground">
                    تکا عکست رو تحلیل می‌کنه
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                className="gap-2.5 rounded-xl py-2.5 text-sm"
              >
                <FileText className="size-4.5 text-primary" />
                <div className="flex flex-col">
                  <span className="font-semibold">📄 فایل/سند بفرست</span>
                  <span className="text-[11px] text-muted-foreground">
                    PDF، Word، متن و کد رو آنالیز می‌کنه
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* میکروفن */}
          <Button
            size="icon"
            onClick={() => void toggleMic()}
            disabled={locked || sending || transcribing}
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
            disabled={locked || sending}
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
            onClick={() => {
              if (locked) {
                onLockedClick()
                return
              }
              submit()
            }}
            disabled={
              !locked &&
              (sending || (!value.trim() && !hasAttachment) || recording || transcribing)
            }
            className="teka-shine size-11 shrink-0 rounded-2xl shadow-md shadow-primary/25 transition-transform hover:scale-105 active:scale-95"
            aria-label={
              locked
                ? 'ورود به حساب برای چت'
                : pendingImage
                  ? 'ارسال عکس برای تحلیل'
                  : pendingFile
                    ? 'ارسال فایل برای آنالیز'
                    : imageMode
                      ? 'ساخت تصویر'
                      : 'ارسال پیام'
            }
          >
            {locked ? (
              <Lock className="size-5" />
            ) : analyzing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <SendHorizonal className="size-5 -scale-x-100" />
            )}
          </Button>
        </div>

        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center text-[11px] text-muted-foreground">
          <span className="hidden sm:inline">Enter بفرست • Shift+Enter خط جدید •</span>
          {pendingImage ? (
            <span className="font-semibold text-primary">📷 عکس پیوست شد — تکا می‌بینه‌ش!</span>
          ) : pendingFile ? (
            <span className="font-semibold text-primary">📄 فایل پیوست شد — تکا می‌خونش!</span>
          ) : imageMode ? (
            <span className="font-semibold text-primary">🎨 حالت تصویرساز فعاله</span>
          ) : power ? (
            <span className="font-semibold text-primary">حالت قدرتمند فعاله ⚡</span>
          ) : (
            <span>تکا ممکنه اشتباه کنه؛ چک مهم کن داداش 😉</span>
          )}
        </p>

        {/* اینپوت‌های مخفی فایل */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pickImage(e.target.files?.[0])
            e.target.value = ''
          }}
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={ANALYZABLE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void pickFile(e.target.files?.[0])
            e.target.value = ''
          }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </motion.div>
  )
}
