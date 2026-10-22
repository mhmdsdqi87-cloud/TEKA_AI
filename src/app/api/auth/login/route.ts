import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createToken, sessionCookie, verifyPassword } from '@/lib/auth'

/** ورود با ایمیل و رمز */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'ایمیل و رمز رو پر کن داداش!' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'ایمیل یا رمز اشتباهه! دوباره امتحان کن.' },
        { status: 401 }
      )
    }

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, image: user.image },
    })
    res.headers.append('Set-Cookie', sessionCookie(createToken(user)))
    return res
  } catch (err) {
    console.error('[api/auth/login] failed:', err)
    return NextResponse.json({ error: 'ورود قاطی شد! یه بار دیگه امتحان کن.' }, { status: 500 })
  }
}
