'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  ArrowDown,
  Download,
  Loader2,
  Menu,
  Moon,
  Sun,
  Volume2,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { TekaSidebar } from '@/components/chat/sidebar'
import { ChatInput } from '@/components/chat/chat-input'
import { EmptyState, MessageBubble, TypingIndicator } from '@/components/chat/message-list'
import type { ChatMessage, ConversationSummary } from '@/components/chat/types'

export default function TekaPage() {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()

  const [mounted, setMounted] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [input, setInput] = useState('')
  const [power, setPower] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [speakingLoadingId, setSpeakingLoadingId] = useState<string | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const activeIdRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  activeIdRef.current = activeId

  // ---------- mount ----------
  useEffect(() => {
    setMounted(true)
    try {
      setPower(localStorage.getItem('teka-power') === '1')
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('teka-power', power ? '1' : '0')
    } catch {
      /* noop */
    }
  }, [power])

  // ---------- لیست گفتگوها ----------
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setConversations(
          (data.conversations ?? []).map(
            (c: {
              id: string
              title: string
              updatedAt: string
              _count?: { messages: number }
            }) => ({
              id: c.id,
              title: c.title,
              updatedAt: c.updatedAt,
              messageCount: c._count?.messages,
            })
          )
        )
      }
    } catch {
      // ساکت رد شو؛ خطای شبکه برای لیست مهم نیست
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // ---------- اسکرول خودکار ----------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending, regenerating])

  // ---------- Ctrl+K چت جدید ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSidebarOpen(false)
        setActiveId(null)
        setMessages([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleMainScroll = useCallback(() => {
    const el = mainRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(dist > 350)
  }, [])

  // ---------- باز کردن یک گفتگو ----------
  const openConversation = useCallback(
    async (id: string) => {
      stopSpeaking()
      if (id === activeIdRef.current) {
        setSidebarOpen(false)
        return
      }
      setSidebarOpen(false)
      setActiveId(id)
      setLoadingMessages(true)
      setMessages([])
      try {
        const res = await fetch(`/api/conversations/${id}`, { cache: 'no-store' })
        const data = await res.json()
        if (res.ok && data.conversation) {
          setMessages(data.conversation.messages ?? [])
        } else {
          toast({
            title: 'آخ!',
            description: data?.error ?? 'این چت باز نشد.',
            variant: 'destructive',
          })
        }
      } catch {
        toast({
          title: 'آخ!',
          description: 'اینترنت قاطی کرد؟ دوباره امتحان کن.',
          variant: 'destructive',
        })
      } finally {
        setLoadingMessages(false)
      }
    },
    [toast]
  )

  // ---------- چت جدید ----------
  const newChat = useCallback(() => {
    stopSpeaking()
    setSidebarOpen(false)
    setActiveId(null)
    setMessages([])
  }, [])

  // ---------- حذف گفتگو ----------
  const deleteConversation = useCallback(
    async (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeIdRef.current === id) {
        setActiveId(null)
        setMessages([])
      }
      try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
        toast({ title: 'پاک شد! 🗑️', description: 'اون چت رفت که رفت، حالا تازه بپرسیم!' })
      } catch {
        loadConversations()
      }
    },
    [loadConversations, toast]
  )

  // ---------- به‌روزرسانی لیست بعد از هر رد و بدل ----------
  const bumpConversation = useCallback((convId: string, title: string) => {
    const nowIso = new Date().toISOString()
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === convId)
      const item: ConversationSummary = existing
        ? {
            ...existing,
            title: title || existing.title,
            updatedAt: nowIso,
            messageCount: (existing.messageCount ?? 0) + 2,
          }
        : {
            id: convId,
            title: title || 'چت جدید',
            updatedAt: nowIso,
            messageCount: 2,
          }
      return [item, ...prev.filter((c) => c.id !== convId)]
    })
  }, [])

  // ---------- ارسال پیام ----------
  const send = useCallback(
    async (text: string) => {
      if (sending || regenerating) return
      const content = text.trim()
      if (!content) return

      stopSpeaking()
      const usedConvId = activeIdRef.current
      const tempId = `local-${Date.now()}`

      setMessages((m) => [...m, { id: tempId, role: 'user', content }])
      setSending(true)

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, conversationId: usedConvId, power }),
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'یه چیزی قاطی شد، دوباره بفرست!')
        }

        const convId: string = data.conversationId

        if (activeIdRef.current === usedConvId) {
          setMessages((m) => [...m, data.reply])
        }
        setActiveId(convId)
        bumpConversation(convId, data.title)
      } catch (err) {
        setMessages((m) => m.filter((x) => x.id !== tempId))
        setInput(text)
        toast({
          title: 'اووپس!',
          description: err instanceof Error ? err.message : 'یه خطای ناشناخته پیش اومد!',
          variant: 'destructive',
        })
      } finally {
        setSending(false)
      }
    },
    [sending, regenerating, power, bumpConversation, toast]
  )

  // ---------- دوباره جواب بده ----------
  const regenerate = useCallback(async () => {
    if (sending || regenerating || !activeIdRef.current) return
    stopSpeaking()
    setRegenerating(true)
    try {
      const res = await fetch('/api/chat/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeIdRef.current, power }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'جواب جدید نیومد!')

      setMessages((m) => {
        const copy = [...m]
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === 'assistant') {
            copy[i] = data.reply
            break
          }
        }
        // اگه هیچ جوابی نبود، اضافه کن
        if (!copy.some((x) => x.role === 'assistant')) copy.push(data.reply)
        return copy
      })
    } catch (err) {
      toast({
        title: 'اووپس!',
        description: err instanceof Error ? err.message : 'یه خطا پیش اومد!',
        variant: 'destructive',
      })
    } finally {
      setRegenerating(false)
    }
  }, [sending, regenerating, power, toast])

  // ---------- بلند بخون ----------
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeakingId(null)
    setSpeakingLoadingId(null)
  }, [])

  const speak = useCallback(
    async (message: ChatMessage) => {
      if (speakingId === message.id) {
        stopSpeaking()
        return
      }
      stopSpeaking()
      setSpeakingLoadingId(message.id)
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message.content }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || 'صدا ساخته نشد!')
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        setSpeakingLoadingId(null)
        setSpeakingId(message.id)
        audio.onended = () => {
          setSpeakingId(null)
          URL.revokeObjectURL(url)
        }
        audio.onerror = () => {
          setSpeakingId(null)
        }
        await audio.play()
      } catch (err) {
        setSpeakingLoadingId(null)
        setSpeakingId(null)
        toast({
          title: 'اووپس!',
          description: err instanceof Error ? err.message : 'صدام درنیومد!',
          variant: 'destructive',
        })
      }
    },
    [speakingId, stopSpeaking, toast]
  )

  // ---------- کپی ----------
  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        toast({ title: 'کپی شد! 📋', description: 'پیام تکا توی کلیپ‌بورده.' })
      } catch {
        toast({ title: 'آخ!', description: 'کپی نشد!', variant: 'destructive' })
      }
    },
    [toast]
  )

  // ---------- خروجی چت ----------
  const exportChat = useCallback(() => {
    if (messages.length === 0) {
      toast({ title: 'چیزی برای خروجی نیست!', description: 'اول یه چی بپرس داداش 😄' })
      return
    }
    const lines = [
      `# چت تکا — هوش مصنوعی ساختهٔ محمد صادقی`,
      ``,
      ...messages.map(
        (m) => `${m.role === 'user' ? '🙋 شما' : '🤖 تکا'}:\n${m.content}\n`
      ),
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/plain;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `teka-chat-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'خروجی گرفتی! 📥', description: 'فایل چت دانلود شد.' })
  }, [messages, toast])

  // ---------- تغییر تم ----------
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  // آخرین جواب تکا (برای دکمه دوباره بگو)
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [messages])

  const busy = sending || regenerating

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      {/* پس‌زمینهٔ aurora */}
      <div className="teka-aurora" aria-hidden="true">
        <div className="teka-blob teka-blob-1" />
        <div className="teka-blob teka-blob-2" />
        <div className="teka-blob teka-blob-3" />
      </div>

      <TekaSidebar
        conversations={conversations}
        activeId={activeId}
        loading={loadingList}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={openConversation}
        onNewChat={newChat}
        onDelete={deleteConversation}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* هدر */}
        <header className="flex items-center gap-2 border-b border-border/60 bg-background/70 px-3 py-2.5 backdrop-blur-xl md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="باز کردن تاریخچه چت‌ها"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-5">تکا</p>
              <p className="truncate text-[11px] leading-4 text-muted-foreground">
                همیشه آنلاین • حافظه داره
              </p>
            </div>
          </div>

          {/* حالت قدرتمند */}
          <Button
            variant={power ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setPower((p) => !p)}
            className={`gap-1.5 rounded-full text-xs font-semibold transition-all ${
              power ? 'shadow-lg shadow-primary/30' : 'text-muted-foreground'
            }`}
            aria-pressed={power}
            title="حالت قدرتمند: جواب‌های عمیق‌تر و باهوش‌تر"
          >
            <Zap className={`size-4 ${power ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{power ? 'قدرتمند' : 'عادی'}</span>
          </Button>

          {/* خروجی چت */}
          <Button
            variant="ghost"
            size="icon"
            onClick={exportChat}
            className="text-muted-foreground"
            aria-label="دانلود خروجی چت"
            title="خروجی چت"
          >
            <Download className="size-4.5" />
          </Button>

          {/* تم */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground"
            aria-label={theme === 'dark' ? 'تم روشن' : 'تم تیره'}
            title="تغییر تم"
          >
            {mounted && theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
          </Button>

          <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary lg:inline">
            ساختهٔ محمد صادقی
          </span>
        </header>

        {/* پیام‌ها */}
        <main
          ref={mainRef}
          onScroll={handleMainScroll}
          className="teka-scroll relative flex-1 overflow-y-auto"
          aria-label="گفتگو"
        >
          <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
            {messages.length === 0 && !loadingMessages && !busy ? (
              <EmptyState onSuggestion={send} power={power} />
            ) : (
              <div className="flex flex-col gap-4 pb-2">
                {loadingMessages &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}
                      aria-hidden="true"
                    >
                      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-muted/50" />
                    </div>
                  ))}
                {!loadingMessages &&
                  messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      isLastAssistant={m.id === lastAssistantId && !busy}
                      onCopy={copyText}
                      onSpeak={speak}
                      onRegenerate={regenerate}
                      speakingId={speakingId}
                      speakingLoadingId={speakingLoadingId}
                    />
                  ))}
                {busy && <TypingIndicator power={power} />}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* دکمه اسکرول به پایین */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="sticky bottom-4 flex justify-center"
              >
                <Button
                  size="icon"
                  onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="size-10 rounded-full border bg-card shadow-xl"
                  aria-label="برو پایین"
                >
                  <ArrowDown className="size-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* اینپوت (فوتر چسبیده به پایین) */}
        <ChatInput value={input} onChange={setInput} onSend={send} sending={sending} power={power} />
      </div>
    </div>
  )
}
