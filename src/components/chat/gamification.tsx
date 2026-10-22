'use client'

import { motion } from 'framer-motion'
import { Flame, Target, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ACHIEVEMENTS,
  loadUnlocked,
  type Quest,
} from '@/lib/game'

const fa = new Intl.NumberFormat('fa-IR')

/* ---------- چیپ استریک 🔥 ---------- */
export function StreakChip({ count }: { count: number }) {
  return (
    <span
      className="teka-chip cursor-default select-none text-xs font-bold text-foreground"
      title={`${fa.format(count)} روز پشت‌سرهم با تکا!`}
      role="status"
      aria-label={`استریک ${fa.format(count)} روزه`}
    >
      <Flame className="teka-flame size-4 text-orange-500" aria-hidden="true" />
      {fa.format(count)}
    </span>
  )
}

/* ---------- پاپ‌آور ماموریت روزانه 🎯 ---------- */
export function QuestsChip({ quests }: { quests: Quest[] }) {
  const doneCount = quests.filter((q) => q.progress >= q.goal).length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="teka-chip text-xs font-bold text-foreground"
          aria-label="ماموریت‌های روزانه"
          title="ماموریت‌های روزانه"
        >
          <Target className="size-4 text-primary" aria-hidden="true" />
          {fa.format(doneCount)}/{fa.format(quests.length)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="teka-glass-strong w-80 rounded-2xl border-primary/20 p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Target className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold">ماموریت‌های امروز</p>
            <p className="text-[11px] text-muted-foreground">
              هر روز ۳ ماموریت تازه — XP جایزه بگیر! ⚡
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {quests.map((q) => {
            const done = q.progress >= q.goal
            return (
              <div
                key={q.id}
                className={`rounded-xl border p-2.5 transition-all ${
                  done
                    ? 'teka-quest-done border-primary/40 bg-primary/10'
                    : 'border-border/70 bg-card/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden="true">
                    {q.icon}
                  </span>
                  <span className="flex-1 text-xs font-semibold leading-5">{q.label}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {done ? '✓ XP+' + fa.format(q.reward) : `+${fa.format(q.reward)} XP`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="teka-xp-bar h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((q.progress / q.goal) * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {fa.format(Math.min(q.progress, q.goal))} از {fa.format(q.goal)}
                </p>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ---------- پاپ‌آور دستاوردها 🏅 ---------- */
export function AchievementsChip() {
  const unlocked = loadUnlocked()
  const count = Object.keys(unlocked).length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="teka-chip text-xs font-bold text-foreground"
          aria-label="دستاوردها"
          title="دستاوردها"
        >
          <Trophy className="size-4 text-primary" aria-hidden="true" />
          {fa.format(count)}/{fa.format(ACHIEVEMENTS.length)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="teka-glass-strong max-h-96 w-80 overflow-y-auto rounded-2xl border-primary/20 p-4 teka-scroll"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Trophy className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold">دستاوردهات</p>
            <p className="text-[11px] text-muted-foreground">
              {fa.format(count)} از {fa.format(ACHIEVEMENTS.length)} مدال گرفتی!
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const got = !!unlocked[a.id]
            return (
              <div
                key={a.id}
                className={`flex items-start gap-2 rounded-xl border p-2.5 ${
                  got
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border/60 bg-card/40 opacity-55 grayscale'
                }`}
                title={a.desc}
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  {got ? a.icon : '🔒'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold leading-4">{a.title}</p>
                  <p className="text-[10px] leading-4 text-muted-foreground">{a.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ---------- اوورلی لول‌آپ 🎉 ---------- */
export function LevelUpOverlay({
  level,
  rank,
  onClose,
}: {
  level: number
  rank: string
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 backdrop-blur-sm"
      onClick={onClose}
      role="alert"
      aria-label={`سطح ${level}`}
    >
      {/* فلش طلایی */}
      <div className="teka-level-flash pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_38%,transparent),transparent_65%)]" />
      <motion.div
        initial={{ scale: 0.6, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="teka-glass-strong relative mx-4 flex max-w-xs flex-col items-center gap-3 rounded-3xl p-8 text-center"
      >
        <motion.span
          className="text-6xl"
          animate={{ rotate: [0, -12, 12, 0], scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          🎉
        </motion.span>
        <p className="text-xs font-bold text-muted-foreground">سطح جدید باز شد!</p>
        <p className="teka-gradient-text text-4xl font-black">
          سطح {fa.format(level)}
        </p>
        <p className="text-sm font-bold">{rank}</p>
        <p className="text-xs leading-6 text-muted-foreground">
          داری خفن‌تر می‌شی داداش! یه ماموریت دیگه کامل کن تا XP بیشتری بگیری ⚡
        </p>
        <Button onClick={onClose} className="teka-shine rounded-full px-6 font-bold">
          یولا! 🚀
        </Button>
      </motion.div>
    </motion.div>
  )
}
