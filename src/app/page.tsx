'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { TekaSidebar } from '@/components/chat/sidebar'
import { ChatInput } from '@/components/chat/chat-input'
import { EmptyState, MessageBubble, TypingIndicator } from '@/components/chat/message-list'
import type { ChatMessage, ConversationSummary } from '@/components/chat/types'

export default function TekaPage() {
  const { toast } = useToast()

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [input, setInput] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

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
      // ساکت رد شو؛ خطای شبکه مهم نیست برای لیست
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
  }, [messages, sending])

  // ---------- باز کردن یک گفتگو ----------
  const openConversation = useCallback(async (id: string) => {
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
        toast({ title: 'آخ!', description: data?.error ?? 'این چت باز نشد.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'آخ!', description: 'اینترنت قاطی کرد؟ دوباره امتحان کن.', variant: 'destructive' })
    } finally {
      setLoadingMessages(false)
    }
  }, [toast])

  // ---------- چت جدید ----------
  const newChat = useCallback(() => {
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

  // ---------- ارسال پیام ----------
  const send = useCallback(
    async (text: string) => {
      if (sending) return
      const content = text.trim()
      if (!content) return

      const usedConvId = activeIdRef.current
      const tempId = `local-${Date.now()}`

      setMessages((m) => [...m, { id: tempId, role: 'user', content }])
      setSending(true)

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, conversationId: usedConvId }),
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'یه چیزی قاطی شد، دوباره بفرست!')
        }

        const convId: string = data.conversationId

        // فقط اگه هنوز توی همون چتی هستیم که پیام رفته، جواب رو نشون بده
        if (activeIdRef.current === usedConvId) {
          setMessages((m) => [...m, data.reply])
        }
        setActiveId(convId)

        // آپدیت لیست گفتگوها بدون فلایکر
        const nowIso = new Date().toISOString()
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === convId)
          const item: ConversationSummary = existing
            ? {
                ...existing,
                title: data.title || existing.title,
                updatedAt: nowIso,
                messageCount: (existing.messageCount ?? 0) + 2,
              }
            : {
                id: convId,
                title: data.title || content.slice(0, 32),
                updatedAt: nowIso,
                messageCount: 2,
              }
          return [item, ...prev.filter((c) => c.id !== convId)]
        })
      } catch (err) {
        // پیام موقت رو بردار و متن رو برگردون توی اینپوت
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
    [sending, toast]
  )

  return (
    <div className="teka-glow flex h-dvh w-full overflow-hidden">
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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* هدر */}
        <header className="flex items-center gap-3 border-b border-border/60 bg-background/70 px-3 py-2.5 backdrop-blur md:px-6">
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
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            ساختهٔ محمد صادقی
          </span>
        </header>

        {/* پیام‌ها */}
        <main className="teka-scroll relative flex-1 overflow-y-auto" aria-label="گفتگو">
          <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
            {messages.length === 0 && !loadingMessages && !sending ? (
              <EmptyState onSuggestion={send} />
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
                  messages.map((m) => <MessageBubble key={m.id} message={m} />)}
                {sending && <TypingIndicator />}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        {/* اینپوت (فوتر چسبیده به پایین) */}
        <ChatInput value={input} onChange={setInput} onSend={send} sending={sending} />
      </div>
    </div>
  )
}
