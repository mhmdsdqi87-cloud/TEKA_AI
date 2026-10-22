'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, MessageSquare, Trash2, X, BrainCircuit, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { ConversationSummary } from './types'
import { faRelativeDay } from './types'

type SidebarProps = {
  conversations: ConversationSummary[]
  activeId: string | null
  loading: boolean
  open: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
}

export function TekaSidebar({
  conversations,
  activeId,
  loading,
  open,
  onClose,
  onSelect,
  onNewChat,
  onDelete,
}: SidebarProps) {
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => c.title.toLowerCase().includes(q))
  }, [conversations, query])

  return (
    <>
      {/* بک‌دراپ موبایل */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-transform duration-300 md:static md:z-auto md:translate-x-0 md:bg-sidebar ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="تاریخچه چت‌ها"
      >
        {/* لوگو و اسم */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 border-b border-sidebar-border p-4"
        >
          <div className="teka-pulse-ring relative size-12 shrink-0 overflow-hidden rounded-2xl ring-2 ring-primary/50">
            <Image
              src="/teka-logo-gold.png"
              alt="لوگوی تکا"
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="teka-gradient-text text-xl font-bold leading-tight">تکا</h1>
            <p className="truncate text-xs text-muted-foreground">
              ساختهٔ محمد صادقی • نسخهٔ خفن ۲.۰ ⚡
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
            aria-label="بستن منو"
          >
            <X className="size-5" />
          </Button>
        </motion.div>

        {/* دکمه چت جدید */}
        <div className="p-3">
          <Button
            onClick={onNewChat}
            className="group w-full gap-2 rounded-2xl font-semibold shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            aria-label="شروع چت جدید"
          >
            <Plus className="size-4 transition-transform group-hover:rotate-90" />
            چت جدید
            <kbd className="mr-auto hidden rounded bg-black/20 px-1.5 py-0.5 text-[10px] md:inline">
              Ctrl+K
            </kbd>
          </Button>
        </div>

        {/* جستجو */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو توی چت‌ها…"
              className="rounded-xl bg-card/60 ps-9 text-sm"
              aria-label="جستجوی گفتگوها"
            />
          </div>
        </div>

        {/* لیست گفتگوها */}
        <nav className="teka-scroll flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="space-y-2 pt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl bg-muted/60" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <MessageSquare className="size-8 opacity-40" />
              <p className="text-sm leading-6">
                {query ? 'چیزی پیدا نشد!' : 'هنوز چتی نداری!'}
                <br />
                {!query && 'یه چی بپرس تا یاد بگیرم 🧠'}
              </p>
            </div>
          ) : (
            filtered.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => onSelect(c.id)}
                className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start transition-all hover:translate-x-[-2px] ${
                  c.id === activeId
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/40'
                    : 'hover:bg-sidebar-accent/60'
                }`}
                aria-current={c.id === activeId ? 'true' : undefined}
              >
                <MessageSquare
                  className={`size-4 shrink-0 ${
                    c.id === activeId ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {faRelativeDay(c.updatedAt)}
                    {typeof c.messageCount === 'number' && c.messageCount > 0
                      ? ` • ${new Intl.NumberFormat('fa-IR').format(c.messageCount)} پیام`
                      : ''}
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`حذف چت ${c.title}`}
                  className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(c)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      setDeleteTarget(c)
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </span>
              </motion.button>
            ))
          )}
        </nav>

        {/* فوتر سایدبار */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-primary">
            <BrainCircuit className="size-4 shrink-0" />
            <p className="text-xs leading-5">
              تکا حافظه داره — همهٔ چت‌ها رو یادشه و یاد می‌گیره!
            </p>
          </div>
        </div>
      </aside>

      {/* دیالوگ تأیید حذف */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>چت پاک شه؟</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.title}» برای همیشه پاک می‌شه و دیگه یادم نمیاد توش چی گفته بودیم!
              مطمئنی؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>نه، بی‌خیال</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              آره، پاکش کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
