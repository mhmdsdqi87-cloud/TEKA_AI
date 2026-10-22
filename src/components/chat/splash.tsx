'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/* جمله‌های وضعیت ورود (چرخش هر ~۶۵۰ms) */
const SPLASH_STATUS = [
  'دارم مغزمو روشن می‌کنم… 🧠',
  'حافظه‌ها لود شد! ✅',
  'نورون‌ها آتیشی شدن! 🔥',
  'انرژی‌ها رو شارژ می‌کنم… ⚡',
  'آماده‌ام داداش! 🚀',
]

/* ⭐ موقعیت‌های ثابت ستاره‌ها (بدون Math.random تا hydration mismatch نشه) */
const SPLASH_STARS = [
  { top: '12%', left: '18%', size: 3, dur: '3.2s', delay: '0s' },
  { top: '22%', left: '78%', size: 2, dur: '4.1s', delay: '0.6s' },
  { top: '68%', left: '12%', size: 2, dur: '3.6s', delay: '1.1s' },
  { top: '78%', left: '84%', size: 3, dur: '4.6s', delay: '0.3s' },
  { top: '30%', left: '8%', size: 2, dur: '5s', delay: '1.6s' },
  { top: '16%', left: '52%', size: 2, dur: '3.9s', delay: '0.9s' },
  { top: '84%', left: '38%', size: 2, dur: '4.3s', delay: '1.4s' },
  { top: '58%', left: '90%', size: 3, dur: '3.4s', delay: '0.2s' },
]

/**
 * اسپلش سینمایی ورود تکا 🌅
 * اول کاملاً پخش می‌شه (‏~۳.۲ ثانیه)، بعد صفحه باز می‌شه.
 * روت با exit تعریف‌شده — والد با AnimatePresence ترکش رو هندل می‌کنه.
 * onDone بعد از ~۳۲۰۰ms یا با اولین کلیک/تپ/کیبورد دقیقاً یک بار صدا زده می‌شه.
 * ⭐ initial opacity:1 → SSR هم لودش رندر می‌کنه (قبل از هیدریشن هم صفحهٔ خالی دیده نمی‌شه)
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion() ?? false
  const [statusIdx, setStatusIdx] = useState(0)
  const firedRef = useRef(false)
  const onDoneRef = useRef(onDone)

  /* همیشه آخرین onDone رو نگه می‌داریم */
  useEffect(() => {
    onDoneRef.current = onDone
  })

  /* پایان خودکار بعد از ~۳.۲ ثانیه + رد شدن با کلیک/تپ/کیبورد — فقط یک بار */
  useEffect(() => {
    const fire = () => {
      if (firedRef.current) return
      firedRef.current = true
      onDoneRef.current()
    }
    const t = window.setTimeout(fire, 3200)
    window.addEventListener('pointerdown', fire)
    window.addEventListener('keydown', fire)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', fire)
      window.removeEventListener('keydown', fire)
    }
  }, [])

  /* چرخش جمله‌های وضعیت */
  useEffect(() => {
    const t = window.setInterval(
      () => setStatusIdx((i) => (i + 1) % SPLASH_STATUS.length),
      650
    )
    return () => window.clearInterval(t)
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background"
      dir="rtl"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.14, filter: 'blur(16px)' }}
      transition={{ duration: 0.65, ease: 'easeInOut' }}
      aria-label="در حال آماده‌سازی تکا"
    >
      {/* ── مینی‌آرورا: هاله‌های طلایی شناور ── */}
      <motion.div
        aria-hidden="true"
        className="absolute blur-3xl"
        style={{
          top: '-12%',
          left: '-10%',
          width: 460,
          height: 460,
          background:
            'radial-gradient(circle, oklch(0.8 0.15 85 / 0.32), transparent 70%)',
        }}
        animate={
          reduced
            ? undefined
            : { x: [0, -46, 18, 0], y: [0, 34, -22, 0], scale: [1, 1.14, 0.96, 1] }
        }
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute blur-3xl"
        style={{
          top: '58%',
          left: '62%',
          width: 420,
          height: 420,
          background:
            'radial-gradient(circle, oklch(0.77 0.15 60 / 0.28), transparent 70%)',
        }}
        animate={
          reduced
            ? undefined
            : { x: [0, 40, -20, 0], y: [0, -48, 24, 0], scale: [1, 0.94, 1.1, 1] }
        }
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute blur-3xl"
        style={{
          top: '34%',
          left: '22%',
          width: 340,
          height: 340,
          background:
            'radial-gradient(circle, oklch(0.73 0.16 45 / 0.26), transparent 70%)',
        }}
        animate={
          reduced
            ? undefined
            : { x: [0, -38, 24, 0], y: [0, -40, 30, 0], scale: [1, 1.12, 0.95, 1] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute blur-3xl"
        style={{
          top: '74%',
          left: '6%',
          width: 400,
          height: 400,
          background:
            'radial-gradient(circle, oklch(0.86 0.12 95 / 0.3), transparent 70%)',
        }}
        animate={
          reduced
            ? undefined
            : { x: [0, 44, -18, 0], y: [0, 28, -34, 0], scale: [1, 1.08, 0.97, 1] }
        }
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── درخشش مخروطیِ چرخان (آهسته) ── */}
      <motion.div
        aria-hidden="true"
        className="absolute -inset-[35%] blur-3xl"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0%, oklch(0.82 0.14 85 / 0.35) 12%, transparent 28%, transparent 55%, oklch(0.75 0.15 55 / 0.3) 70%, transparent 88%)',
          opacity: 0.3,
          mixBlendMode: 'screen',
        }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />

      {/* ── ستاره‌های چشمک‌زن ── */}
      {SPLASH_STARS.map((s, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="teka-star"
          style={
            {
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
              '--dur': s.dur,
            } as React.CSSProperties
          }
        />
      ))}

      {/* ── محتوای مرکزی ── */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
        {/* ۱) گویِ درخشان با حلقه‌های نبض‌دار */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative"
        >
          {/* هالهٔ طلایی پشت لوگو */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 scale-[1.8] rounded-full blur-2xl"
            style={{
              background:
                'radial-gradient(circle, oklch(0.8 0.15 80 / 0.55), transparent 65%)',
            }}
          />
          {/* حلقه‌های منبسط‌شونده */}
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-2 border-primary/40"
              animate={
                reduced
                  ? { opacity: 0.25 }
                  : { scale: [1, 1.7], opacity: [0.5, 0] }
              }
              transition={
                reduced
                  ? { duration: 0.5 }
                  : {
                      duration: 2.4,
                      repeat: Infinity,
                      ease: 'easeOut',
                      delay: i * 0.8,
                    }
              }
            />
          ))}
          <div className="relative size-36 overflow-hidden rounded-full shadow-2xl shadow-primary/40 ring-4 ring-primary/40">
            <Image
              src="/teka-logo-gold.png"
              alt="لوگوی هوش مصنوعی تکا"
              fill
              priority
              sizes="144px"
              className="object-cover"
            />
          </div>
        </motion.div>

        {/* ۲) واژه‌نگار تکا با شیمر طلایی */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, ease: 'easeOut' }}
          className="teka-splash-shimmer text-6xl font-black leading-[1.2]"
        >
          تکا
        </motion.h1>

        {/* ۳) شعار */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5, ease: 'easeOut' }}
          className="text-sm text-muted-foreground"
        >
          هوش مصنوعی فارسی ساختهٔ محمد صادقی
        </motion.p>

        {/* ۴) نوار پیشرفت + ۵) خط وضعیت */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
          className="mt-1 flex flex-col items-center gap-3"
        >
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-primary/15">
            <motion.div
              className="teka-xp-bar h-full rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.9, ease: 'easeInOut' }}
            />
          </div>
          <div className="flex h-5 items-center justify-center" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.span
                key={statusIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="text-xs font-medium text-muted-foreground"
              >
                {SPLASH_STATUS[statusIdx]}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
