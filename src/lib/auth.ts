import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'

/**
 * سیستم احراز هویت تکا (سبک، بدون وابستگی جدید)
 * - رمزها با scrypt هش می‌شن
 * - توکن نشست: HMAC-SHA256 (شبه‌JWT) توی کوکی HttpOnly
 * - ورود گوگل: OAuth2 استاندارد با متغیرهای محیطی
 */

const SECRET =
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'teka-dev-secret-change-me-please'

export const SESSION_COOKIE = 'teka_session'
export const OAUTH_STATE_COOKIE = 'teka_oauth_state'

export type SessionUser = { id: string; email: string; name: string; image: string | null }

/* ---------- رمز عبور (scrypt) ---------- */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  try {
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

/* ---------- توکن نشست (HMAC-SHA256) ---------- */
function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function createToken(userId: string, days = 30): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + days * 86_400_000 })
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function readToken(token: string | null | undefined): string | null {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(sign(payload))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      sub?: string
      exp?: number
    }
    if (!data.sub || !data.exp || data.exp < Date.now()) return null
    return data.sub
  } catch {
    return null
  }
}

/* ---------- کاربر از روی کوکی درخواست ---------- */
export async function getUserFromRequest(req: Request): Promise<SessionUser | null> {
  try {
    const header = req.headers.get('cookie') ?? ''
    const row = header
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${SESSION_COOKIE}=`))
    const token = row ? decodeURIComponent(row.slice(SESSION_COOKIE.length + 1)) : null
    const userId = readToken(token)
    if (!userId) return null
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, image: true },
    })
    return user ?? null
  } catch {
    return null
  }
}

/* ---------- کوکی‌ها ---------- */
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86_400}`
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

/* ---------- اعتبارسنجی فرم ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateCredentials(
  name: unknown,
  email: unknown,
  password: unknown
): { ok: true; name: string; email: string; password: string } | { ok: false; error: string } {
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const cleanPass = typeof password === 'string' ? password : ''

  if (cleanName.length < 2 || cleanName.length > 40) {
    return { ok: false, error: 'اسمت باید بین ۲ تا ۴۰ حرف باشه داداش!' }
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return { ok: false, error: 'این ایمیل معتبر نیست! یه ایمیل درست بزن.' }
  }
  if (cleanPass.length < 6) {
    return { ok: false, error: 'رمز باید حداقل ۶ کاراکتر باشه!' }
  }
  return { ok: true, name: cleanName, email: cleanEmail, password: cleanPass }
}
