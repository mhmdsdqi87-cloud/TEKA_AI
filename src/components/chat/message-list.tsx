'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Code2, Laugh, Lightbulb, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from './types'

const SUGGESTIONS: { icon: React.ElementType; text: string }[] = [
  { icon: Sparkles, text: 'سلام تکا! خودتو معرفی کن 🙂' },
  { icon: Laugh, text: 'یه جوک خفن بگو 😂' },
  { icon: Code2, text: 'برنامه‌نویسی رو از کجا شروع کنم؟' },
  { icon: Lightbulb, text: 'یه نکتهٔ جالب که نمی‌دونستم بگو!' },
]

function TekaAvatar({ size = 'size-8' }: { size?: string }) {
  return (
    <div
      className={`${size} relative shrink-0 overflow-hidden rounded-full ring-2 ring-primary/40`}
    >
      <Image src="/teka-avatar.png" alt="آواتار تکا" fill sizes="40px" className="object-cover" />
    </div>
  )
}

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-end gap-2"
      aria-label="تکا داره فکر می‌کنه"
    >
      <TekaAvatar />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tr-md border bg-card px-4 py-3.5">
        <span className="teka-dot size-2 rounded-full bg-primary" />
        <span className="teka-dot size-2 rounded-full bg-primary" />
        <span className="teka-dot size-2 rounded-full bg-primary" />
      </div>
    </motion.div>
  )
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-primary px-4 py-3 text-[15px] leading-7 text-primary-foreground shadow-md shadow-primary/10 md:max-w-[70%]">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-2"
    >
      <TekaAvatar />
      <div className="teka-md max-w-[85%] rounded-2xl rounded-tr-md border bg-card px-4 py-3 text-[15px] shadow-sm md:max-w-[75%]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </motion.div>
  )
}

export function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center px-4 py-10 text-center md:py-16"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 scale-125 rounded-full bg-primary/25 blur-2xl" />
        <div className="relative size-24 overflow-hidden rounded-[2rem] ring-4 ring-primary/30 shadow-2xl shadow-primary/20">
          <Image
            src="/teka-avatar.png"
            alt="لوگوی هوش مصنوعی تکا"
            fill
            sizes="96px"
            className="object-cover"
            priority
          />
        </div>
      </div>

      <h2 className="text-2xl font-bold md:text-3xl">سلام داداش! من تکام 👋</h2>
      <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground md:text-base">
        هوش مصنوعی خودمونیِ فارسی‌زبان — ساختهٔ{' '}
        <span className="font-semibold text-primary">محمد صادقی</span> 🙌
        <br />
        هرچی دلت خواست بپرس؛ خاطره‌هامو هم همیشه یادم می‌مونه 🧠
      </p>

      <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            onClick={() => onSuggestion(s.text)}
            className="flex items-center gap-2.5 rounded-2xl border bg-card/60 px-4 py-3 text-start text-sm transition-all hover:border-primary/40 hover:bg-card hover:shadow-md hover:shadow-primary/10 active:scale-[0.98]"
          >
            <s.icon className="size-4 shrink-0 text-primary" />
            <span className="leading-6">{s.text}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
