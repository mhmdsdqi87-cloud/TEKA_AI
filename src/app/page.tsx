'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  ArrowDown,
  ChevronDown,
  Download,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Sun,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { TekaSidebar } from '@/components/chat/sidebar'
import { ChatInput } from '@/components/chat/chat-input'
import {
  EmptyState,
  MessageBubble,
  PaintingPlaceholder,
  TypingIndicator,
} from '@/components/chat/message-list'
import { AuthDialog, type TekaUser } from '@/components/chat/auth-dialog'
import { Splash } from '@/components/chat/splash'
import {
  AchievementsChip,
  LevelUpOverlay,
  QuestsChip,
  StreakChip,
} from '@/components/chat/gamification'
import { ConfettiBurst } from '@/components/chat/confetti'
import {
  addBonusXp,
  loadBonusXp,
  loadMood,
  loadQuests,
  loadSeenLevel,
  recordActivity,
  saveMood,
  saveSeenLevel,
  updateStreakOnVisit,
  type Quest,
  type QuestEvent,
  type TekaMoodClient,
} from '@/lib/game'
import type { ChatMessage, ConversationSummary } from '@/components/chat/types'
import type { PendingFile } from '@/components/chat/chat-input'

/* مارکرهای محتوا (باید با بک‌اند سینک باشه؛ teka.ts سمت سروره و اینجا ایمپورت نمی‌شه) */
const MARKER_UIMG = 'TEKA_UIMG::'
const MARKER_FILE = 'TEKA_FILE::'

/* حالت‌های تکا 🎭 (کپی کلاینتی — teka.ts سمت سروره) */
const MOOD_OPTIONS: { id: TekaMoodClient; label: string; emoji: string; desc: string }[] = [
  { id: 'normal', label: 'تکای عادی', emoji: '😎', desc: 'همون رفیق همیشگی' },
  { id: 'playful', label: 'شیطون', emoji: '😈', desc: 'شوخی و تیکهٔ بامزه' },
  { id: 'master', label: 'استاد', emoji: '🎓', desc: 'عمیق و ساختارمند' },
  { id: 'poet', label: 'شاعر', emoji: '☕', desc: 'لطیف و تصویری' },
]

function rankFor(level: number): string {
  if (level >= 15) return 'افسانه‌ای 🔥'
  if (level >= 10) return 'استار ⚡'
  if (level >= 5) return 'حرفه‌ای 😎'
  if (level >= 3) return 'رفیق باحال 🙌'
  return 'تازه‌کار خفن 🌱'
}

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
  const [imageBusy, setImageBusy] = useState(false)
  const [visionBusy, setVisionBusy] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [input, setInput] = useState('')
  const [power, setPower] = useState(true) // ⭐ پیش‌فرض: قدرتمند!
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [awaitingArt, setAwaitingArt] = useState(false) // منتظر عکسِ در حال ساخت تو چت عادی
  const [streamingId, setStreamingId] = useState<string | null>(null) // ⚡ حباب استریم زنده
  const [showSplash, setShowSplash] = useState(true) // 🎬 انیمیشن ورود (هر بار لود، پخش می‌شه)
  const [contentReady, setContentReady] = useState(false) // ریویل محتوا بعد اسپلش

  // 🔐 حساب کاربری
  const [user, setUser] = useState<TekaUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)

  // 🎮 گیمیفیکیشن
  const [streakCount, setStreakCount] = useState(0)
  const [quests, setQuests] = useState<Quest[]>([])
  const [bonusXp, setBonusXp] = useState(0)
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const [levelUp, setLevelUp] = useState<{ level: number; rank: string } | null>(null)
  const [mood, setMood] = useState<TekaMoodClient>('normal')

  const bottomRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const auroraRef = useRef<HTMLDivElement>(null)
  const activeIdRef = useRef<string | null>(null)
  const streakRef = useRef(0)
  const moodRef = useRef<TekaMoodClient>('normal')
  activeIdRef.current = activeId
  streakRef.current = streakCount
  moodRef.current = mood

  // ---------- mount ----------
  useEffect(() => {
    setMounted(true)
    try {
      const savedPower = localStorage.getItem('teka-power')
      setPower(savedPower === null ? true : savedPower === '1') // پیش‌فرض: قدرتمند
    } catch {
      /* noop */
    }

    // 🎮 استریک و ماموریت‌ها و حالت
    const streak = updateStreakOnVisit()
    setStreakCount(streak.count)
    if (streak.isNewDay && streak.count > 1) {
      toast({
        title: `استریک ${new Intl.NumberFormat('fa-IR').format(streak.count)} روزه! 🔥`,
        description: 'داداش تو آتیشی! ادامه بده که نشکنه.',
      })
    }
    setQuests(loadQuests())
    setBonusXp(loadBonusXp())
    const m = loadMood()
    setMood(m)
    moodRef.current = m

    // 🔐 کاربر فعلی + پیام‌های برگشت از گوگل
    ;(async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const authError = params.get('authError')
        const welcome = params.get('welcome')
        if (authError) {
          toast({
            title: 'ورود گوگل هنوز فعال نشد! 🔑',
            description: 'کلیدهای گوگل ست نشده؛ فعلاً با ایمیل وارد شو داداش.',
            variant: 'destructive',
          })
        }
        if (welcome) {
          toast({
            title: `خوش اومدی ${decodeURIComponent(welcome)}! 🎉`,
            description: 'با گوگل وصل شدی؛ همه‌چیز آماده‌ست!',
          })
        }
        if (authError || welcome) window.history.replaceState({}, '', '/')

        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.user) setUser(data.user)
      } catch {
        /* مهمان می‌مونه */
      }
    })()
  }, [toast])

  useEffect(() => {
    try {
      localStorage.setItem('teka-power', power ? '1' : '0')
    } catch {
      /* noop */
    }
  }, [power])

  // 🎬 پایان انیمیشن ورود → ریویل سینمایی محتوا
  const finishSplash = useCallback(() => {
    setShowSplash(false)
    setContentReady(true)
  }, [])

  // 🖱️ هالهٔ دنبال‌کنندهٔ موس
  useEffect(() => {
    const el = auroraRef.current
    if (!el) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${((e.clientX / window.innerWidth) * 100).toFixed(2)}%`)
        el.style.setProperty('--my', `${((e.clientY / window.innerHeight) * 100).toFixed(2)}%`)
        raf = 0
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // 🎉 پایش لول‌آپ
  useEffect(() => {
    const total =
      conversations.reduce((s, c) => s + (c.messageCount ?? 0), 0) + bonusXp
    const lvl = Math.floor(total / 10) + 1
    const seen = loadSeenLevel()
    if (seen === 0) {
      saveSeenLevel(lvl)
      return
    }
    if (lvl > seen) {
      saveSeenLevel(lvl)
      setLevelUp({ level: lvl, rank: rankFor(lvl) })
      setConfettiTrigger((v) => v + 1)
    }
  }, [conversations, bonusXp])

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
  }, [messages, sending, regenerating, imageBusy])

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

  // 🎮 ثبت فعالیت (ماموریت + دستاورد + XP)
  const trackEvent = useCallback(
    (event: QuestEvent) => {
      const result = recordActivity(event, streakRef.current)
      setQuests(result.quests)
      if (result.completed.length > 0) {
        for (const q of result.completed) {
          setBonusXp((prev) => {
            const next = addBonusXp(q.reward)
            return next
          })
          toast({
            title: `ماموریت کامل شد! ${q.icon}`,
            description: `${q.label} — ${new Intl.NumberFormat('fa-IR').format(q.reward)} XP گرفتی! ⚡`,
          })
        }
        setConfettiTrigger((v) => v + 1)
      }
      for (const a of result.unlocked) {
        toast({
          title: `دستاورد باز شد! ${a.icon}`,
          description: `${a.title} — ${a.desc}`,
        })
      }
      if (result.unlocked.length > 0) setConfettiTrigger((v) => v + 1)
    },
    [toast]
  )

  // 🎭 تغییر حالت تکا
  const selectMood = useCallback(
    (m: TekaMoodClient) => {
      setMood(m)
      moodRef.current = m
      saveMood(m)
      const opt = MOOD_OPTIONS.find((o) => o.id === m)
      if (m !== 'normal') trackEvent('mood')
      toast({
        title: `${opt?.emoji} فاز تکا عوض شد!`,
        description: `الان حالت «${opt?.label}» فعاله — ${opt?.desc}`,
      })
    },
    [toast, trackEvent]
  )

  // 🔐 لاگین موفق / خروج
  const handleAuthSuccess = useCallback(
    (u: TekaUser) => {
      setUser(u)
      setSidebarOpen(false)
      loadConversations()
      setConfettiTrigger((v) => v + 1)
    },
    [loadConversations]
  )

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* مهم نیست */
    }
    setUser(null)
    setStreamingId(null)
    setActiveId(null)
    setMessages([])
    loadConversations()
    toast({ title: 'خارج شدی! 👋', description: 'هر وقت خواستی برگرد، ما همینیم!' })
  }, [loadConversations, toast])

  // ---------- باز کردن یک گفتگو ----------
  const openConversation = useCallback(
    async (id: string) => {
      setStreamingId(null)
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
    setStreamingId(null)
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

  /**
   * ⭐ polling آسنکرون: منتظر پیام تازه (عکس) می‌مونه تا از سرور بیاد.
   * چون نقاشی تو پس‌زمینه ساخته می‌شه و جواب POST فوریه، هیچ‌وقت
   * تایم‌اوت پروکسی نمی‌تونه وسط کار بکُشه‌ش!
   */
  const waitForNewMessages = useCallback(
    async (convId: string, maxMs = 170_000): Promise<ChatMessage[]> => {
      const sinceIso = new Date(Date.now() - 5000).toISOString()
      const deadline = Date.now() + maxMs
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3500))
        try {
          const res = await fetch(
            `/api/conversations/${convId}?after=${encodeURIComponent(sinceIso)}`,
            { cache: 'no-store', signal: AbortSignal.timeout(20_000) }
          )
          if (!res.ok) continue
          const data = await res.json().catch(() => null)
          const fresh: ChatMessage[] = (data?.conversation?.messages ?? []).filter(
            (m: ChatMessage) => m.role === 'assistant'
          )
          if (fresh.length > 0) return fresh
        } catch {
          /* شبکه یه لحظه قاطی کرد — ادامه بده */
        }
      }
      return []
    },
    []
  )

  // ---------- ارسال پیام (⚡ استریم زنده — حرف‌به‌حرف) ----------
  const send = useCallback(
    async (text: string) => {
      if (sending || regenerating || imageBusy || visionBusy) return
      const content = text.trim()
      if (!content) return

      const usedConvId = activeIdRef.current
      const tempId = `local-${Date.now()}`
      const streamMsgId = `streaming-${Date.now()}`

      setMessages((m) => [...m, { id: tempId, role: 'user', content }])
      setSending(true)

      let convId: string | null = null
      let title: string | null = null
      let raw = ''
      let streamVisible = false

      const stillHere = () =>
        activeIdRef.current === usedConvId ||
        (convId !== null && activeIdRef.current === convId)

      /** نمایش دلتاها با مخفی‌کردن مارکرهای سروری (TEKA_DRAW:: و رفقا) */
      const showDelta = () => {
        const visible = raw
          .replace(/TEKA_[A-Z]+::[^\n]*/g, ' ')
          .replace(/TEKA_[A-Z]*:??:?$/, '')
        if (!visible.trim()) return
        if (!streamVisible) {
          streamVisible = true
          setStreamingId(streamMsgId)
        }
        if (stillHere()) {
          setMessages((m) =>
            m.map((x) => (x.id === streamMsgId ? { ...x, content: visible } : x))
          )
        }
      }

      /** منتظر عکسِ در حال ساخت بمون (نقاشی پس‌زمینه + polling) */
      const waitForArt = async () => {
        const cid = convId
        if (!cid) return
        setActiveId(cid)
        setAwaitingArt(true)
        try {
          const fresh = await waitForNewMessages(cid)
          if (fresh.length > 0) {
            if (activeIdRef.current === cid) {
              setMessages((m) => [...m, ...fresh])
            }
            bumpConversation(cid, title ?? 'چت جدید')
          } else {
            toast({
              title: 'داره آماده می‌شه! ⏳',
              description:
                'نقاشی تو پس‌زمینه کار می‌کنه؛ چند لحظه دیگه بیا تو همین چت، اینجاست! 🎨',
            })
            bumpConversation(cid, title ?? 'چت جدید')
          }
        } finally {
          setAwaitingArt(false)
        }
      }

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            conversationId: usedConvId,
            power,
            mood: moodRef.current,
            stream: true,
          }),
          signal: AbortSignal.timeout(150_000),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || 'یه چیزی قاطی شد، دوباره بفرست!')
        }

        const ctype = res.headers.get('content-type') ?? ''

        // ——— مسیر JSON: درخواست عکس مستقیم (processing) ———
        if (!ctype.includes('text/event-stream')) {
          const data = await res.json().catch(() => null)
          trackEvent('chat')
          convId = data?.conversationId ?? null
          title = data?.title ?? null
          if (data?.processing === true) {
            await waitForArt()
          } else if (data?.reply && stillHere()) {
            setMessages((m) => [...m, data.reply])
            if (convId) setActiveId(convId)
            if (convId) bumpConversation(convId, title ?? '')
          }
          return
        }

        // ——— ⚡ مسیر استریم: جواب همون لحظه حرف‌به‌حرف میاد ———
        if (!res.body) throw new Error('استریم از سرور نیومد!')
        setMessages((m) => [
          ...m,
          { id: streamMsgId, role: 'assistant', content: '' },
        ])
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let finalReply: ChatMessage | null = null
        let artStarted = false
        let gotError: string | null = null

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const parts = buf.split('\n\n')
          buf = parts.pop() ?? ''
          for (const part of parts) {
            let evt = 'message'
            let dataStr = ''
            for (const line of part.split('\n')) {
              if (line.startsWith('event:')) evt = line.slice(6).trim()
              else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
            }
            if (!dataStr) continue
            try {
              const d = JSON.parse(dataStr) as Record<string, unknown>
              if (evt === 'meta') {
                convId = d.conversationId as string
                title = (d.title as string) ?? title
                if (activeIdRef.current === usedConvId) setActiveId(convId)
              } else if (evt === 'delta') {
                raw += d.text as string
                showDelta()
              } else if (evt === 'done') {
                finalReply = d.reply as ChatMessage
                convId = (d.conversationId as string) ?? convId
                title = (d.title as string) ?? title
              } else if (evt === 'art') {
                artStarted = true
                convId = (d.conversationId as string) ?? convId
                title = (d.title as string) ?? title
              } else if (evt === 'error') {
                gotError = d.error as string
              }
            } catch {
              /* تکهٔ ناقص SSE — رد شو */
            }
          }
        }

        if (gotError) throw new Error(gotError)

        // نقاشی قراره ساخته بشه → حباب استریم رو بردار و polling کن
        if (artStarted && convId) {
          if (stillHere()) setMessages((m) => m.filter((x) => x.id !== streamMsgId))
          trackEvent('chat')
          await waitForArt()
          return
        }

        if (finalReply) {
          trackEvent('chat')
          if (convId) {
            setActiveId(convId)
            bumpConversation(convId, title ?? '')
          }
          if (stillHere()) {
            setMessages((m) => m.map((x) => (x.id === streamMsgId ? finalReply! : x)))
          }
        } else {
          // استریم تموم شد ولی جواب نهایی نیومد — حباب خالی رو بردار
          setMessages((m) => m.filter((x) => x.id !== streamMsgId))
        }
      } catch (err) {
        setMessages((m) =>
          m.filter((x) => x.id !== tempId && x.id !== streamMsgId)
        )
        setInput(text)
        toast({
          title: 'اوه اوه! 🙈',
          description: err instanceof Error ? err.message : 'یه خطای ناشناخته پیش اومد!',
          variant: 'destructive',
        })
      } finally {
        setSending(false)
        setStreamingId(null)
      }
    },
    [sending, regenerating, imageBusy, visionBusy, power, bumpConversation, toast, waitForNewMessages, trackEvent]
  )

  // ---------- ساخت تصویر ----------
  const sendImage = useCallback(
    async (prompt: string) => {
      if (sending || regenerating || imageBusy || visionBusy) return
      const content = prompt.trim()
      if (!content) return

      const usedConvId = activeIdRef.current
      const tempId = `local-img-${Date.now()}`

      setMessages((m) => [...m, { id: tempId, role: 'user', content }])
      setImageBusy(true)

      try {
        const res = await fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: content, conversationId: usedConvId }),
          signal: AbortSignal.timeout(30_000),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || 'تصویر ساخته نشد!')
        }

        trackEvent('image')
        const convId: string = data.conversationId

        // ⭐ جواب فوری اومد؛ عکس تو پس‌زمینه ساخته می‌شه — polling
        setActiveId(convId)
        setAwaitingArt(true)
        try {
          const fresh = await waitForNewMessages(convId)
          if (fresh.length > 0) {
            if (activeIdRef.current === convId) {
              setMessages((m) => [...m, ...fresh])
            }
            bumpConversation(convId, data.title)
            toast({ title: 'اینم عکسش! 🎨', description: 'تکا نقاشی زد، خوشت اومد؟' })
          } else {
            toast({
              title: 'داره آماده می‌شه! ⏳',
              description:
                'نقاشی تو پس‌زمینه کار می‌کنه؛ چند لحظه دیگه بیا تو همین چت، اینجاست! 🎨',
            })
            bumpConversation(convId, data.title)
          }
        } finally {
          setAwaitingArt(false)
        }
      } catch (err) {
        setMessages((m) => m.filter((x) => x.id !== tempId))
        setInput(content)
        toast({
          title: 'اوه اوه! 🙈',
          description: err instanceof Error ? err.message : 'تصویرسازی قاطی شد!',
          variant: 'destructive',
        })
      } finally {
        setImageBusy(false)
      }
    },
    [sending, regenerating, imageBusy, visionBusy, bumpConversation, toast, waitForNewMessages, trackEvent]
  )

  // ---------- تحلیل عکس کاربر (چشم ماشینی تکا) ----------
  const sendVision = useCallback(
    async (imageDataUrl: string, question: string) => {
      if (sending || regenerating || imageBusy || visionBusy) return

      const usedConvId = activeIdRef.current
      const tempId = `local-uimg-${Date.now()}`
      const localContent = `${MARKER_UIMG}${imageDataUrl}\n${question}`

      setMessages((m) => [...m, { id: tempId, role: 'user', content: localContent }])
      setVisionBusy(true)

      try {
        const res = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageDataUrl,
            question,
            conversationId: usedConvId,
          }),
          signal: AbortSignal.timeout(150_000),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || 'تحلیل عکس نشد!')
        }

        trackEvent('vision')
        if (activeIdRef.current === usedConvId) {
          setMessages((m) => [...m, data.reply])
        }
        setActiveId(data.conversationId)
        bumpConversation(data.conversationId, data.title)
      } catch (err) {
        setMessages((m) => m.filter((x) => x.id !== tempId))
        if (question) setInput(question)
        toast({
          title: 'اوه اوه! 🙈',
          description: err instanceof Error ? err.message : 'تحلیل عکس قاطی شد!',
          variant: 'destructive',
        })
      } finally {
        setVisionBusy(false)
      }
    },
    [sending, regenerating, imageBusy, visionBusy, bumpConversation, toast, trackEvent]
  )

  // ---------- آنالیز فایل/سند ----------
  const sendFile = useCallback(
    async (file: PendingFile, question: string) => {
      if (sending || regenerating || imageBusy || visionBusy) return

      const usedConvId = activeIdRef.current
      const tempId = `local-file-${Date.now()}`
      const localContent = `${MARKER_FILE}${file.name}::${file.size}::${question}`

      setMessages((m) => [...m, { id: tempId, role: 'user', content: localContent }])
      setVisionBusy(true)

      try {
        const res = await fetch('/api/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            mime: file.mime,
            dataUrl: file.dataUrl,
            question,
            conversationId: usedConvId,
            power,
          }),
          signal: AbortSignal.timeout(150_000),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || 'آنالیز فایل نشد!')
        }

        trackEvent('file')
        if (activeIdRef.current === usedConvId) {
          setMessages((m) => [...m, data.reply])
        }
        setActiveId(data.conversationId)
        bumpConversation(data.conversationId, data.title)
      } catch (err) {
        setMessages((m) => m.filter((x) => x.id !== tempId))
        if (question) setInput(question)
        toast({
          title: 'اوه اوه! 🙈',
          description: err instanceof Error ? err.message : 'آنالیز فایل قاطی شد!',
          variant: 'destructive',
        })
      } finally {
        setVisionBusy(false)
      }
    },
    [sending, regenerating, imageBusy, visionBusy, power, bumpConversation, toast, trackEvent]
  )

  // ---------- دوباره جواب بده ----------
  const regenerate = useCallback(async () => {
    if (sending || regenerating || imageBusy || visionBusy || !activeIdRef.current) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/chat/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeIdRef.current, power, mood: moodRef.current }),
        signal: AbortSignal.timeout(150_000),
      })
      const data = await res.json().catch(() => null)
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
        title: 'اوه اوه! 🙈',
        description: err instanceof Error ? err.message : 'یه خطا پیش اومد!',
        variant: 'destructive',
      })
    } finally {
      setRegenerating(false)
    }
  }, [sending, regenerating, power, toast])

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

  const busy = sending || regenerating || imageBusy || visionBusy
  const currentMood = MOOD_OPTIONS.find((m) => m.id === mood) ?? MOOD_OPTIONS[0]

  // ستاره‌های پس‌زمینه (ثابت برای جلوگیری از خطای hydration)
  const stars = useMemo(
    () => [
      { top: '12%', left: '8%', size: 3, dur: '3.6s', delay: '0s' },
      { top: '22%', left: '82%', size: 2, dur: '4.4s', delay: '0.6s' },
      { top: '38%', left: '15%', size: 2, dur: '5s', delay: '1.2s' },
      { top: '55%', left: '88%', size: 3, dur: '4s', delay: '0.3s' },
      { top: '68%', left: '6%', size: 2, dur: '4.8s', delay: '1.8s' },
      { top: '78%', left: '70%', size: 2, dur: '3.8s', delay: '0.9s' },
      { top: '30%', left: '45%', size: 2, dur: '5.2s', delay: '2.1s' },
      { top: '85%', left: '35%', size: 3, dur: '4.2s', delay: '1.5s' },
      { top: '8%', left: '55%', size: 2, dur: '4.6s', delay: '2.4s' },
      { top: '48%', left: '60%', size: 2, dur: '3.9s', delay: '0.4s' },
    ],
    []
  )

  const comets = useMemo(
    () => [
      { top: '10%', left: '55%', dur: '11s', delay: '1.5s' },
      { top: '30%', left: '80%', dur: '13s', delay: '6s' },
      { top: '55%', left: '35%', dur: '15s', delay: '10.5s' },
    ],
    []
  )

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      {/* پس‌زمینهٔ aurora v2 + ستاره‌ها و شهاب‌ها */}
      <div className="teka-aurora" aria-hidden="true" ref={auroraRef}>
        <div className="teka-conic" />
        <div className="teka-noise" />
        <div className="teka-blob teka-blob-1" />
        <div className="teka-blob teka-blob-2" />
        <div className="teka-blob teka-blob-3" />
        <div className="teka-blob teka-blob-4" />
        {comets.map((c, i) => (
          <span
            key={i}
            className="teka-comet"
            style={{
              top: c.top,
              left: c.left,
              ['--cdur' as string]: c.dur,
              animationDelay: c.delay,
            }}
          />
        ))}
        {stars.map((s, i) => (
          <span
            key={i}
            className="teka-star"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              ['--dur' as string]: s.dur,
              animationDelay: s.delay,
            }}
          />
        ))}
        <div className="teka-mouse-glow" />
      </div>

      {/* 🎉 کانفتی */}
      <ConfettiBurst trigger={confettiTrigger} />

      {/* 🎬 انیمیشن ورود */}
      <AnimatePresence>
        {showSplash && <Splash onDone={finishSplash} />}
      </AnimatePresence>

      <div
        className={`flex transition-opacity duration-700 ${
          contentReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <TekaSidebar
          conversations={conversations}
          activeId={activeId}
          loading={loadingList}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelect={openConversation}
          onNewChat={newChat}
          onDelete={deleteConversation}
          bonusXp={bonusXp}
        />
      </div>

      <motion.div
        className="relative z-10 flex min-w-0 flex-1 flex-col"
        initial={{ opacity: 0, y: 26, scale: 0.98, filter: 'blur(10px)' }}
        animate={
          contentReady
            ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
            : { opacity: 0, y: 26, scale: 0.98, filter: 'blur(10px)' }
        }
        transition={{ duration: 0.85, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* هدر */}
        <header className="flex items-center gap-1.5 border-b border-border/60 bg-background/70 px-3 py-2.5 backdrop-blur-xl md:gap-2 md:px-6">
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

          {/* 🎮 چیپای گیمیفیکیشن (در موبایل مخفی) */}
          {mounted && (
            <div className="hidden items-center gap-1.5 sm:flex">
              <StreakChip count={streakCount} />
              <QuestsChip quests={quests} />
              <AchievementsChip />
            </div>
          )}

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
            <span className="hidden md:inline">{power ? 'قدرتمند' : 'عادی'}</span>
          </Button>

          {/* 🎭 حالت تکا */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 rounded-full text-xs font-semibold text-muted-foreground transition-all hover:text-foreground"
                aria-label="حالت تکا"
                title="فاز تکا رو عوض کن!"
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {currentMood.emoji}
                </span>
                <span className="hidden md:inline">{currentMood.label}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="teka-glass-strong w-56 rounded-2xl border-primary/20"
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                فاز تکا رو انتخاب کن 🎭
              </DropdownMenuLabel>
              {MOOD_OPTIONS.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => selectMood(m.id)}
                  className={`gap-2.5 rounded-xl py-2.5 ${m.id === mood ? 'bg-primary/10' : ''}`}
                >
                  <span className="text-lg" aria-hidden="true">
                    {m.emoji}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">
                      {m.label}
                      {m.id === mood ? ' ✓' : ''}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{m.desc}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* خروجی چت */}
          <Button
            variant="ghost"
            size="icon"
            onClick={exportChat}
            className="hidden text-muted-foreground sm:inline-flex"
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
            aria-label={mounted && theme === 'dark' ? 'تم روشن' : 'تم تیره'}
            title="تغییر تم"
          >
            {mounted && theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
          </Button>

          {/* 🔐 حساب کاربری */}
          {mounted && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="teka-chip gap-1.5 ps-1 pe-2"
                  aria-label="حساب کاربری"
                  title="حساب کاربری"
                >
                  <span className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-black text-primary-foreground ring-2 ring-primary/40">
                    {user.image ? (
                      <img src={user.image} alt="" className="size-full object-cover" />
                    ) : (
                      user.name.slice(0, 1)
                    )}
                  </span>
                  <span className="hidden max-w-20 truncate text-xs font-bold md:inline">
                    {user.name}
                  </span>
                  <ChevronDown className="size-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="teka-glass-strong w-52 rounded-2xl border-primary/20"
              >
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-bold">{user.name}</p>
                  <p className="truncate text-[11px] font-normal text-muted-foreground" dir="ltr">
                    {user.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="gap-2 rounded-xl text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  خروج از حساب
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              onClick={() => setAuthOpen(true)}
              className="teka-shine gap-1.5 rounded-full px-3 text-xs font-bold shadow-md shadow-primary/25"
              aria-label="ورود یا ثبت‌نام"
            >
              <LogIn className="size-4" />
              <span className="hidden sm:inline">ورود / ثبت‌نام</span>
            </Button>
          )}
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
                  messages.map((m, idx) => {
                    // ⭐ برای عکس‌ها پرامپت اصلی رو پیدا کن تا «دوباره بکش» کار کنه
                    let redrawPrompt: string | undefined
                    if (m.role === 'assistant' && m.content.startsWith('TEKA_IMG::')) {
                      for (let j = idx - 1; j >= 0; j--) {
                        if (messages[j].role === 'user') {
                          redrawPrompt = messages[j].content
                            .replace(/^🎨 درخواست تصویر:\s*/, '')
                            .replace(/^TEKA_UIMG::.*\n?/, '')
                            .trim()
                          break
                        }
                      }
                    }
                    return (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        isLastAssistant={m.id === lastAssistantId && !busy}
                        onCopy={copyText}
                        onRegenerate={regenerate}
                        onRedraw={
                          redrawPrompt && !busy
                            ? () => sendImage(redrawPrompt)
                            : undefined
                        }
                        isStreaming={m.id === streamingId}
                        entryDelay={Math.min((messages.length - 1 - idx) * 0.04, 0.42)}
                        burst={m.role === 'user' && idx === messages.length - 1}
                      />
                    )
                  })}
                {(imageBusy || awaitingArt) && <PaintingPlaceholder />}
                {!imageBusy && !awaitingArt && busy && !streamingId && (
                  <TypingIndicator power={power} analyzing={visionBusy} />
                )}
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
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={send}
          onSendImage={sendImage}
          onSendVision={sendVision}
          onSendFile={sendFile}
          sending={busy}
          analyzing={visionBusy}
          power={power}
          onVoiceSent={() => trackEvent('voice')}
        />
      </motion.div>

      {/* 🔐 دیالوگ ورود/ثبت‌نام */}
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSuccess={handleAuthSuccess}
      />

      {/* 🎉 اوورلی لول‌آپ */}
      <AnimatePresence>
        {levelUp && (
          <LevelUpOverlay level={levelUp.level} rank={levelUp.rank} onClose={() => setLevelUp(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
