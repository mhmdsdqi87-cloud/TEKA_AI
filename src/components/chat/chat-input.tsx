'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { SendHorizonal } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ChatInputProps = {
  value: string
  onChange: (v: string) => void
  onSend: (text: string) => void
  sending: boolean
  power: boolean
}

export function ChatInput({ value, onChange, onSend, sending, power }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }

  const submit = () => {
    const text = value.trim()
    if (!text || sending) return
    onSend(text)
    onChange('')
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="border-t border-border/60 bg-background/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:px-6"
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-3xl border bg-card p-2 shadow-xl shadow-black/5 transition-all focus-within:border-primary/50 focus-within:shadow-primary/10">
          <label htmlFor="teka-input" className="sr-only">
            پیامت رو بنویس
          </label>
          <textarea
            id="teka-input"
            ref={textareaRef}
            value={value}
            rows={1}
            maxLength={4000}
            placeholder={
              sending
                ? power
                  ? 'تکا داره عمیق فکر می‌کنه… ⚡🤔'
                  : 'تکا داره فکر می‌کنه… 🤔'
                : 'پیامت رو بنویس داداش…'
            }
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
          <Button
            size="icon"
            onClick={submit}
            disabled={sending || !value.trim()}
            className="size-11 shrink-0 rounded-2xl shadow-md shadow-primary/25 transition-transform hover:scale-105 active:scale-95"
            aria-label="ارسال پیام"
          >
            <SendHorizonal className="size-5 -scale-x-100" />
          </Button>
        </div>
        <p className="mt-2 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
          <span className="hidden sm:inline">Enter بفرست • Shift+Enter خط جدید • </span>
          {power ? (
            <span className="font-semibold text-primary">حالت قدرتمند فعاله ⚡</span>
          ) : (
            <span>تکا ممکنه اشتباه کنه؛ چک مهم کن داداش 😉</span>
          )}
        </p>
      </div>
    </motion.div>
  )
}
