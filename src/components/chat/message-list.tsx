'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  Code2,
  Copy,
  Download,
  FileText,
  Laugh,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Volume2,
  Loader2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from './types'
import { formatFileSize } from '@/lib/media'

const IMAGE_MARKER = 'TEKA_IMG::'
const MARKER_UIMG = 'TEKA_UIMG::'
const MARKER_FILE = 'TEKA_FILE::'

const ALL_SUGGESTIONS: { icon: React.ElementType; text: string }[] = [
  { icon: Sparkles, text: 'سلام تکا! خودتو معرفی کن 🙂' },
  { icon: Laugh, text: 'یه جوک خفن بگو 😂' },
  { icon: Code2, text: 'برنامه‌نویسی رو از کجا شروع کنم؟' },
  { icon: Lightbulb, text: 'یه نکتهٔ جالب که نمی‌دونستم بگو!' },
  { icon: Sparkles, text: 'برام یه شعر خودمونی بگو 🌹' },
  { icon: Laugh, text: 'اگه یه روز معلم بودی چیکار می‌کردی؟ 😄' },
  { icon: Code2, text: 'یه ایدهٔ استارتاپی خفن بده!' },
  { icon: Lightbulb, text: 'چطور تو ۳۰ روز زبون انگلیسی رو خوب یاد بگیرم؟' },
  { icon: Sparkles, text: 'حال دلت که باشه؟ برام تعریف کن 🙌' },
]

const TYPING_PHRASES = [
  'دارم فکر می‌کنم…',
  'مغزم داره داغ می‌شه… 🧠',
  'نورون‌ها رو گرم کردم…',
  'یه لحظه داداش…',
  'دارم بهترین جوابو می‌چینم…',
  'در حال پردازش خفن…',
]

const SPRING = { type: 'spring' as const, stiffness: 340, damping: 28 }

/**
 * شافل با seed ثابت (بر اساس روز)
 * ⚠️ رفع باگ hydration: با Math.random() سرور و کلاینت ترتیب متفاوت می‌ساختن
 * و ریکت خطای hydration mismatch می‌داد. الان روزانه ثابته.
 */
function dailyShuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  let seed = Math.floor(Date.now() / 86_400_000) // ایندکس روز UTC
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280
    const j = Math.floor((seed / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function TekaAvatar({ size = 'size-8' }: { size?: string }) {
  return (
    <div
      className={`${size} relative shrink-0 overflow-hidden rounded-full ring-2 ring-primary/50 shadow-lg shadow-primary/25`}
    >
      <Image
        src="/teka-logo-gold.png"
        alt="آواتار تکا"
        fill
        sizes="40px"
        className="object-cover"
      />
    </div>
  )
}

export function TypingIndicator({
  power,
  painting,
  analyzing,
}: {
  power?: boolean
  painting?: boolean
  analyzing?: boolean
}) {
  const [phraseIdx, setPhraseIdx] = useState(0)

  useEffect(() => {
    if (painting || analyzing) return
    const t = setInterval(() => setPhraseIdx((i) => (i + 1) % TYPING_PHRASES.length), 2000)
    return () => clearInterval(t)
  }, [painting, analyzing])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="flex items-end gap-2"
      aria-label="تکا داره فکر می‌کنه"
      role="status"
    >
      <TekaAvatar />
      <div className="teka-think teka-glass flex items-center gap-2 rounded-2xl rounded-tr-md px-4 py-3.5">
        <span className="flex items-center gap-1.5">
          <span className="teka-dot size-2 rounded-full bg-primary" />
          <span className="teka-dot size-2 rounded-full bg-primary" />
          <span className="teka-dot size-2 rounded-full bg-primary" />
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={painting ? 'painting' : phraseIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-xs text-muted-foreground"
          >
            {painting
              ? '🎨 داره نقاشی می‌کشه…'
              : analyzing
                ? '🔍 دارم عکس/فایلت رو دقیق بررسی می‌کنم…'
                : power
                  ? '⚡ دارم عمیق فکر می‌کنم…'
                  : TYPING_PHRASES[phraseIdx]}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ---------- پیام تصویری (خروجی تصویرساز) ---------- */
function ImageMessage({ content }: { content: string }) {
  const dataUrl = content.slice(IMAGE_MARKER.length)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.05 }}
      className="teka-img-frame w-full max-w-sm"
    >
      <img
        src={dataUrl}
        alt="تصویر ساخته‌شده توسط تکا"
        className="block w-full"
        loading="lazy"
      />
      <div className="flex items-center justify-between bg-background/70 px-3 py-2 backdrop-blur">
        <span className="text-[11px] font-medium text-muted-foreground">
          🎨 تصویرساز تکا
        </span>
        <a
          href={dataUrl}
          download={`teka-art-${Date.now()}.png`}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label="دانلود تصویر"
        >
          <Download className="size-3.5" />
          دانلود
        </a>
      </div>
    </motion.div>
  )
}

type BubbleProps = {
  message: ChatMessage
  isLastAssistant: boolean
  onCopy: (text: string) => void
  onSpeak: (message: ChatMessage) => void
  onRegenerate: () => void
  speakingId: string | null
  speakingLoadingId: string | null
}

/* ---------- تجزیهٔ پیام کاربر (عکس/فایل پیوست) ---------- */
type ParsedUser = {
  imageUrl?: string
  file?: { name: string; size: number }
  question: string
}

function parseUserContent(content: string): ParsedUser {
  if (content.startsWith(MARKER_UIMG)) {
    const rest = content.slice(MARKER_UIMG.length)
    const nl = rest.indexOf('\n')
    return {
      imageUrl: nl >= 0 ? rest.slice(0, nl) : rest,
      question: nl >= 0 ? rest.slice(nl + 1).trim() : '',
    }
  }
  if (content.startsWith(MARKER_FILE)) {
    const rest = content.slice(MARKER_FILE.length)
    const parts = rest.split('::')
    const size = Number.parseInt(parts[1] ?? '0', 10)
    return {
      file: { name: parts[0] || 'فایل', size: Number.isFinite(size) ? size : 0 },
      question: parts.slice(2).join('::').trim(),
    }
  }
  return { question: content }
}

/* ---------- چیپ فایل پیوست کاربر ---------- */
function UserFileChip({ name, size }: { name: string; size: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING}
      className="teka-glass flex items-center gap-2.5 rounded-2xl px-3 py-2"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 max-w-[180px]">
        <p className="truncate text-xs font-semibold" dir="ltr">
          {name}
        </p>
        <p className="text-[10px] text-muted-foreground">{formatFileSize(size)} • سند</p>
      </div>
    </motion.div>
  )
}

export function MessageBubble({
  message,
  isLastAssistant,
  onCopy,
  onSpeak,
  onRegenerate,
  speakingId,
  speakingLoadingId,
}: BubbleProps) {
  const [copied, setCopied] = useState(false)

  if (message.role === 'user') {
    const parsed = parseUserContent(message.content)
    return (
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className="flex justify-end"
      >
        <div className="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[70%]">
          {/* عکس ارسالی کاربر */}
          {parsed.imageUrl && (
            <div className="teka-img-frame w-full max-w-[280px]">
              <img
                src={parsed.imageUrl}
                alt="عکسی که فرستادی"
                className="block w-full"
                loading="lazy"
              />
            </div>
          )}
          {/* فایل پیوست کاربر */}
          {parsed.file && (
            <UserFileChip name={parsed.file.name} size={parsed.file.size} />
          )}
          {/* متن پیام */}
          {parsed.question && (
            <div className="rounded-2xl rounded-tl-md bg-gradient-to-tl from-primary to-primary/80 px-4 py-3 text-[15px] leading-7 text-primary-foreground shadow-lg shadow-primary/25">
              <p className="whitespace-pre-wrap break-words">{parsed.question}</p>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  // پیام تصویری
  if (message.content.startsWith(IMAGE_MARKER)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="group flex items-start gap-2"
      >
        <TekaAvatar />
        <div className="min-w-0 max-w-[85%] md:max-w-[75%]">
          <ImageMessage content={message.content} />
        </div>
      </motion.div>
    )
  }

  const isSpeaking = speakingId === message.id
  const isSpeakingLoading = speakingLoadingId === message.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="group flex items-start gap-2"
    >
      <TekaAvatar />
      <div className="min-w-0 max-w-[85%] md:max-w-[75%]">
        <div className="teka-md teka-glass rounded-2xl rounded-tr-md px-4 py-3 text-[15px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>

        {/* اکشن‌ها */}
        <div className="mt-1 flex items-center gap-1 opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <button
            onClick={() => {
              onCopy(message.content)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="کپی پیام"
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            {copied ? 'کپی شد!' : 'کپی'}
          </button>
          <button
            onClick={() => onSpeak(message)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="بلند بخون"
          >
            {isSpeakingLoading ? (
              <Loader2 className="size-3.5 animate-spin text-primary" />
            ) : (
              <Volume2 className={`size-3.5 ${isSpeaking ? 'text-primary' : ''}`} />
            )}
            {isSpeaking ? 'دارم می‌خونم…' : 'بلند بخون'}
          </button>
          {isLastAssistant && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="دوباره جواب بده"
            >
              <RefreshCw className="size-3.5" />
              دوباره بگو
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function EmptyState({
  onSuggestion,
  power,
}: {
  onSuggestion: (text: string) => void
  power: boolean
}) {
  const chips = useMemo(() => dailyShuffle(ALL_SUGGESTIONS).slice(0, 4), [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center px-4 py-8 text-center md:py-14"
    >
      <div className="teka-float relative mb-5">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-primary/25 blur-2xl" />
        <div className="teka-pulse-ring relative size-24 overflow-hidden rounded-[2rem] ring-4 ring-primary/40 shadow-2xl shadow-primary/20 md:size-28">
          <Image
            src="/teka-logo-gold.png"
            alt="لوگوی هوش مصنوعی تکا"
            fill
            sizes="112px"
            className="object-cover"
            priority
          />
        </div>
      </div>

      <h2 className="text-2xl font-bold md:text-3xl">
        سلام داداش! من <span className="teka-gradient-text">تکام</span> 👋
      </h2>
      <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground md:text-base">
        هوش مصنوعی خودمونیِ فارسی‌زبان — ساختهٔ{' '}
        <span className="font-semibold text-primary">محمد صادقی</span> 🙌
        <br />
        حرف می‌زنم، عکس دقیق می‌کشم، عکست رو می‌بینم، فایلت رو آنالیز می‌کنم 🧠
      </p>

      {/* امکانات */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {[
          { icon: '🎨', label: 'تصویرساز دقیق' },
          { icon: '📷', label: 'عکس بفرست تا ببینم' },
          { icon: '📄', label: 'فایل و PDF آنالیز کنم' },
          { icon: '🎤', label: 'با صدا بگو' },
          { icon: '🔊', label: 'بلند بخون' },
          { icon: '🧠', label: 'حافظهٔ دائمی' },
          { icon: '⚡', label: power ? 'حالت قدرتمند روشنه' : 'حالت قدرتمند' },
        ].map((f, i) => (
          <motion.span
            key={f.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="teka-glass rounded-full px-3 py-1 text-[11px] text-muted-foreground"
          >
            {f.icon} {f.label}
          </motion.span>
        ))}
      </div>

      <div className="mt-7 grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
        {chips.map((s, i) => (
          <motion.button
            key={s.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            onClick={() => onSuggestion(s.text)}
            className="teka-glass flex items-center gap-2.5 rounded-2xl px-4 py-3 text-start text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/15 active:scale-[0.98]"
          >
            <s.icon className="size-4 shrink-0 text-primary" />
            <span className="leading-6">{s.text}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
