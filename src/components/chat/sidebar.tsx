'use client'

import Image from 'next/image'
import { Plus, MessageSquare, Trash2, X, BrainCircuit } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useState } from 'react'
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
        className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-sidebar-border bg-sidebar transition-transform duration-300 md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="تاریخچه چت‌ها"
      >
        {/* لوگو و اسم */}
        <div className="flex items-center gap-3 border-b border-sidebar-border p-4">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-2xl ring-2 ring-primary/40">
            <Image
              src="/teka-avatar.png"
              alt="لوگوی تکا"
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">تکا</h1>
            <p className="truncate text-xs text-muted-foreground">ساختهٔ محمد صادقی</p>
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
        </div>

        {/* دکمه چت جدید */}
        <div className="p-3">
          <Button
            onClick={onNewChat}
            className="w-full gap-2 rounded-2xl font-semibold shadow-lg shadow-primary/20"
            aria-label="شروع چت جدید"
          >
            <Plus className="size-4" />
            چت جدید
          </Button>
        </div>

        {/* لیست گفتگوها */}
        <nav className="teka-scroll flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="space-y-2 pt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl bg-muted/60" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <MessageSquare className="size-8 opacity-40" />
              <p className="text-sm leading-6">
                هنوز چتی نداری!
                <br />
                یه چی بپرس تا یاد بگیرم 🧠
              </p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start transition-colors ${
                  c.id === activeId
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/30'
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
              </button>
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
