import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createToken, hashPassword, sessionCookie, validateCredentials } from '@/lib/auth'

/** ثبت‌نام با ایمیل و رمز */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const valid = validateCredentials(body?.name, body?.email, body?.password)
    if (!valid.ok) {
      return NextResponse.json({ error: valid.error }, { status: 400 })
    }

    const exists = await db.user.findUnique({ where: { email: valid.email } })
    if (exists) {
      return NextResponse.json(
        { error: 'این ایمیل قبلاً ثبت شده! وارد شو یا یه ایمیل دیگه بزن.' },
        { status: 409 }
      )
    }

    const user = await db.user.create({
      data: {
        email: valid.email,
        name: valid.name,
        passwordHash: hashPassword(valid.password),
      },
    })

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, image: user.image },
    })
    res.headers.append('Set-Cookie', sessionCookie(createToken(user.id)))
    return res
  } catch (err) {
    console.error('[api/auth/register] failed:', err)
    return NextResponse.json(
      { error: 'ثبت‌نام قاطی شد! یه بار دیگه امتحان کن.' },
      { status: 500 }
    )
  }
}
