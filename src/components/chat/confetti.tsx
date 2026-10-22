'use client'

import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const COLORS = ['#E8B93E', '#7BC47F', '#F08C7D', '#F5D76E', '#B5CC8C', '#E98A6B']

const PIECE_COUNT = 38

type Piece = {
  id: number
  x: number
  delay: number
  duration: number
  color: string
  size: number
  rotate: number
  drift: number
  round: boolean
}

/** 🎉 انفجار کانفتی — بدون هیچ وابستگی جدید */
export function ConfettiBurst({ trigger }: { trigger: number }) {
  const pieces = useMemo<Piece[]>(() => {
    if (!trigger) return []
    return Array.from({ length: PIECE_COUNT }, (_, i) => ({
      id: trigger * 1000 + i,
      x: 50 + (Math.random() * 60 - 30),
      delay: Math.random() * 0.25,
      duration: 1.6 + Math.random() * 1.2,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 8,
      rotate: Math.random() * 720 - 360,
      drift: Math.random() * 160 - 80,
      round: Math.random() > 0.5,
    }))
  }, [trigger])

  return (
    <AnimatePresence>
      {pieces.length > 0 && (
        <div
          key={trigger}
          className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
          aria-hidden="true"
        >
          {pieces.map((p) => (
            <motion.span
              key={p.id}
              className="absolute top-[-16px]"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 0.45,
                background: p.color,
                borderRadius: p.round ? '999px' : '2px',
              }}
              initial={{ opacity: 1, y: 0, rotate: 0 }}
              animate={{
                opacity: [1, 1, 0.9, 0],
                y: ['0vh', '105vh'],
                x: [0, p.drift],
                rotate: [0, p.rotate],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: p.duration, delay: p.delay, ease: [0.15, 0.6, 0.45, 1] }}
              onAnimationComplete={() => {
                // آخرین تکه که تمام شد، لیست رو خالی کن
                if (p.id === trigger * 1000 + PIECE_COUNT - 1) {
                  void 0
                }
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
