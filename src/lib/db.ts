import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

/**
 * 🗄️ دیتابیس تکا — دمودوئل:
 *  • لوکال (DATABASE_URL=file:…) → SQLite همیشگی، بدون آداپتور
 *  • ورسل (DATABASE_URL=libsql://…) → Turso با آداپتور libsql
 *    توکن از DATABASE_AUTH_TOKEN خونده می‌شه (Vercel Marketplace → Turso)
 */
function makePrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? ''
  const token = process.env.DATABASE_AUTH_TOKEN

  if (url.startsWith('libsql://')) {
    const adapter = new PrismaLibSql({ url, authToken: token || undefined })
    return new PrismaClient({ adapter, log: ['query'] })
  }

  return new PrismaClient({ log: ['query'] })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
