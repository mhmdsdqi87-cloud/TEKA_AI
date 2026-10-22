import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

/**
 * 🗄️ دیتابیس تکا — دمودوئل:
 *  • لوکال (DATABASE_URL=file:…) → SQLite همیشگی، بدون آداپتور
 *  • ورسل (DATABASE_URL=libsql://…) → Turso با آداپتور libsql
 *    توکن از DATABASE_AUTH_TOKEN خونده می‌شه (Vercel Marketplace → Turso)
 *  • ورسل بدون Turso (file:/tmp/…) → اسکیما اولین بار خودکار و idempotent ساخته می‌شه
 */

/* ---------- اسکیمای idempotent برای دیتابیس تازه (مثل /tmp ورسل) ---------- */
const ENSURE_SQL = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email")`,
  `CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'چت جدید',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt")`,
  `CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt")`,
]

function makePrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? ''
  const token = process.env.DATABASE_AUTH_TOKEN

  /* ---------- حالت Turso (ورسل حرفه‌ای) ---------- */
  if (url.startsWith('libsql://')) {
    const adapter = new PrismaLibSql({ url, authToken: token || undefined })
    return new PrismaClient({ adapter })
  }

  /* ---------- حالت SQLite فایلی (لوکال + ورسل /tmp) ---------- */
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? [] : ['query'],
  })

  /** اولین کوئری‌ها منتظر ساخت idempotent اسکیما می‌مونن (یک‌بار به‌ازای هر پروسه) */
  let ensured = false
  let ensuring: Promise<void> | null = null
  const ensureSchema = (): Promise<void> => {
    if (ensured) return Promise.resolve()
    if (!ensuring) {
      ensuring = (async () => {
        try {
          for (const stmt of ENSURE_SQL) await client.$executeRawUnsafe(stmt)
          ensured = true
        } finally {
          ensuring = null
        }
      })()
    }
    return ensuring
  }

  /** دلیگیت هر مدل رو می‌پیچیم تا قبل از اجرا اسکیما تضمین‌شده باشه */
  const gate = <T extends object>(delegate: T): T =>
    new Proxy(delegate, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (typeof value !== 'function') return value
        return (...args: unknown[]) =>
          ensureSchema().then(() =>
            (value as (...a: unknown[]) => unknown).apply(target, args)
          )
      },
    })

  const gatedModels = new Map<string, unknown>()
  const modelName = (p: string | symbol): 'user' | 'conversation' | 'message' | null =>
    p === 'user' || p === 'conversation' || p === 'message' ? p : null

  const proxied = new Proxy(client, {
    get(target, prop, _receiver) {
      const model = typeof prop === 'string' ? modelName(prop) : null
      if (!model) return Reflect.get(target, prop, target) as any

      if (!gatedModels.has(model)) {
        gatedModels.set(model, gate(Reflect.get(target, prop, target) as any))
      }
      return gatedModels.get(model)
    },
  }) as PrismaClient

  return proxied
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
