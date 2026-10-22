'use client'

/**
 * 🎮 موتور گیمیفیکیشن تکا — استریک، ماموریت روزانه، دستاوردها
 * همه‌چیز سبک و روی localStorage؛ سریع و بدون دردسر.
 */

/* ---------- انواع ---------- */
export type QuestEvent = 'chat' | 'image' | 'vision' | 'file' | 'voice' | 'mood'

export type Quest = {
  id: string
  icon: string
  label: string
  event: QuestEvent
  goal: number
  reward: number
  progress: number
}

export type Achievement = {
  id: string
  icon: string
  title: string
  desc: string
}

/* ---------- کلیدها ---------- */
const K_QUESTS = 'teka-quests-v1'
const K_STREAK = 'teka-streak-v1'
const K_STATS = 'teka-stats-v1'
const K_ACH = 'teka-achievements-v1'
const K_BONUS = 'teka-bonus-xp-v1'
const K_LEVEL = 'teka-level-v1'
const K_MOOD = 'teka-mood-v1'

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD محلی
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* noop */
  }
}

/* ---------- استریک 🔥 ---------- */
export type StreakInfo = { count: number; isNewDay: boolean; record: number }

export function updateStreakOnVisit(): StreakInfo {
  const data = readJson<{ count: number; last: string; record: number }>(K_STREAK, {
    count: 0,
    last: '',
    record: 0,
  })
  const today = todayKey()
  if (data.last === today) {
    return { count: data.count, isNewDay: false, record: data.record }
  }
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
  const count = data.last === yesterday ? data.count + 1 : 1
  const record = Math.max(count, data.record)
  writeJson(K_STREAK, { count, last: today, record })
  return { count, isNewDay: true, record }
}

/* ---------- ماموریت روزانه 🎯 ---------- */
type QuestDef = Omit<Quest, 'progress'>

export const QUEST_POOL: QuestDef[] = [
  { id: 'chatty', icon: '💬', label: '۳ پیام به تکا بده', event: 'chat', goal: 3, reward: 20 },
  { id: 'talker', icon: '🗣️', label: '۷ پیام بده', event: 'chat', goal: 7, reward: 40 },
  { id: 'artist', icon: '🎨', label: 'یه عکس بساز', event: 'image', goal: 1, reward: 25 },
  { id: 'eye', icon: '📷', label: 'یه عکس بفرست تا ببینم', event: 'vision', goal: 1, reward: 20 },
  { id: 'scholar', icon: '📄', label: 'یه فایل آنالیز کن', event: 'file', goal: 1, reward: 25 },
  { id: 'voice', icon: '🎤', label: 'با صدا با تکا حرف بزن', event: 'voice', goal: 1, reward: 15 },
  { id: 'mood', icon: '🎭', label: 'حالت تکا رو عوض کن', event: 'mood', goal: 1, reward: 10 },
]

type QuestStore = { day: string; quests: Quest[] }

/** ۳ ماموریتِ روز، با شافل ثابت بر اساس روز (بدون hydration issue) */
export function loadQuests(): Quest[] {
  const day = todayKey()
  const store = readJson<QuestStore>(K_QUESTS, { day: '', quests: [] })
  if (store.day === day && store.quests.length > 0) return store.quests

  let seed = [...day].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const pool = [...QUEST_POOL]
  const picked: QuestDef[] = []
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    seed = (seed * 9301 + 49297) % 233280
    const idx = Math.floor((seed / 233280) * pool.length)
    picked.push(pool.splice(idx, 1)[0])
  }
  const quests = picked.map((q) => ({ ...q, progress: 0 }))
  writeJson(K_QUESTS, { day, quests })
  return quests
}

export type QuestProgressResult = {
  quests: Quest[]
  justCompleted: Quest[]
}

/** ثبت یک رویداد برای ماموریت‌ها */
export function trackQuestEvent(event: QuestEvent): QuestProgressResult {
  const quests = loadQuests()
  const justCompleted: Quest[] = []
  for (const q of quests) {
    if (q.event !== event || q.progress >= q.goal) continue
    q.progress = Math.min(q.goal, q.progress + 1)
    if (q.progress === q.goal) justCompleted.push(q)
  }
  writeJson(K_QUESTS, { day: todayKey(), quests })
  return { quests, justCompleted }
}

/* ---------- آمار و دستاوردها 🏅 ---------- */
export type TekaStats = {
  messages: number
  images: number
  visions: number
  files: number
  voices: number
  moods: number
}

export function loadStats(): TekaStats {
  return readJson<TekaStats>(K_STATS, {
    messages: 0,
    images: 0,
    visions: 0,
    files: 0,
    voices: 0,
    moods: 0,
  })
}

function bumpStat(key: keyof TekaStats): TekaStats {
  const stats = loadStats()
  stats[key] += 1
  writeJson(K_STATS, stats)
  return stats
}

export const ACHIEVEMENTS: (Achievement & { test: (s: TekaStats, streak: number) => boolean })[] = [
  { id: 'first_chat', icon: '🌱', title: 'اولین حرف', desc: 'اولین پیامت رو فرستادی', test: (s) => s.messages >= 1 },
  { id: 'chat_10', icon: '💬', title: 'پرحرف', desc: '۱۰ پیام فرستادی', test: (s) => s.messages >= 10 },
  { id: 'chat_50', icon: '🚀', title: 'رفیق فداکار', desc: '۵۰ پیام فرستادی', test: (s) => s.messages >= 50 },
  { id: 'first_image', icon: '🎨', title: 'نقاش منتخب', desc: 'اولین عکست رو ساختی', test: (s) => s.images >= 1 },
  { id: 'image_5', icon: '🖼️', title: 'پیکاسوی دیجیتال', desc: '۵ عکس ساختی', test: (s) => s.images >= 5 },
  { id: 'first_vision', icon: '👁️', title: 'چشم تیزبین', desc: 'یه عکس براش فرستادی', test: (s) => s.visions >= 1 },
  { id: 'first_file', icon: '📚', title: 'محقق', desc: 'اولین فایلت رو آنالیز کردی', test: (s) => s.files >= 1 },
  { id: 'first_voice', icon: '🎤', title: 'صدای گرم', desc: 'با صدا با تکا حرف زدی', test: (s) => s.voices >= 1 },
  { id: 'mood_swapper', icon: '🎭', title: 'فازباز', desc: 'حالت تکا رو عوض کردی', test: (s) => s.moods >= 1 },
  { id: 'streak_3', icon: '🔥', title: 'سه‌روزهٔ آتیشی', desc: '۳ روز پشت‌سرهم اومدی', test: (_s, st) => st >= 3 },
  { id: 'streak_7', icon: '🏆', title: 'هفت‌روزهٔ افسانه‌ای', desc: '۷ روز پشت‌سرهم اومدی', test: (_s, st) => st >= 7 },
]

export function loadUnlocked(): Record<string, number> {
  return readJson<Record<string, number>>(K_ACH, {})
}

export type NewlyUnlocked = Achievement[]

export function checkAchievements(streak: number): NewlyUnlocked {
  const stats = loadStats()
  const unlocked = loadUnlocked()
  const fresh: Achievement[] = []
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue
    if (a.test(stats, streak)) {
      unlocked[a.id] = Date.now()
      fresh.push(a)
    }
  }
  if (fresh.length > 0) writeJson(K_ACH, unlocked)
  return fresh
}

/** آمار + ماموریت + دستاورد رو یکجا هندل می‌کنه */
export function recordActivity(
  event: QuestEvent,
  streakCount: number
): { quests: Quest[]; completed: Quest[]; unlocked: Achievement[] } {
  const statKey: keyof TekaStats | null =
    event === 'chat'
      ? 'messages'
      : event === 'image'
        ? 'images'
        : event === 'vision'
          ? 'visions'
          : event === 'file'
            ? 'files'
            : event === 'voice'
              ? 'voices'
              : event === 'mood'
                ? 'moods'
                : null
  if (statKey) bumpStat(statKey)

  const { quests, justCompleted } = trackQuestEvent(event)
  const unlocked = checkAchievements(streakCount)
  return { quests, completed: justCompleted, unlocked }
}

/* ---------- XP اضافه و لول ---------- */
export function loadBonusXp(): number {
  return readJson<number>(K_BONUS, 0)
}

export function addBonusXp(amount: number): number {
  const next = loadBonusXp() + amount
  writeJson(K_BONUS, next)
  return next
}

export function loadSeenLevel(): number {
  return readJson<number>(K_LEVEL, 0)
}

export function saveSeenLevel(level: number): void {
  writeJson(K_LEVEL, level)
}

/* ---------- حالت تکا 🎭 ---------- */
export type TekaMoodClient = 'normal' | 'playful' | 'master' | 'poet'

export function loadMood(): TekaMoodClient {
  const m = readJson<string>(K_MOOD, 'normal')
  return (['normal', 'playful', 'master', 'poet'] as const).includes(m as TekaMoodClient)
    ? (m as TekaMoodClient)
    : 'normal'
}

export function saveMood(mood: TekaMoodClient): void {
  writeJson(K_MOOD, mood)
}
