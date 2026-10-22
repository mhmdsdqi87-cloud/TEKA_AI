import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createToken, OAUTH_STATE_COOKIE, sessionCookie } from '@/lib/auth'

/** مرحلهٔ دوم ورود گوگل: تبادل کد با توکن + ساخت/به‌روزرسانی کاربر */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  try {
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    const stateCookie = req.headers
      .get('cookie')
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${OAUTH_STATE_COOKIE}=`))
      ?.split('=')[1]

    if (!code || !state || state !== stateCookie) {
      return NextResponse.redirect(`${origin}/?authError=google_failed`)
    }

    // تبادل کد با access_token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = (await tokenRes.json().catch(() => null)) as
      | { access_token?: string }
      | null
    if (!tokenRes.ok || !tokenData?.access_token) {
      return NextResponse.redirect(`${origin}/?authError=google_failed`)
    }

    // پروفایل کاربر
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const info = (await infoRes.json().catch(() => null)) as
      | { email?: string; name?: string; picture?: string }
      | null
    if (!infoRes.ok || !info?.email) {
      return NextResponse.redirect(`${origin}/?authError=google_failed`)
    }

    const email = info.email.toLowerCase()
    const user = await db.user.upsert({
      where: { email },
      create: { email, name: info.name || email.split('@')[0], image: info.picture || null },
      update: { image: info.picture || undefined },
    })

    const res = NextResponse.redirect(`${origin}/?welcome=${encodeURIComponent(user.name)}`)
    res.headers.append('Set-Cookie', sessionCookie(createToken(user.id)))
    res.headers.append(
      'Set-Cookie',
      `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    )
    return res
  } catch (err) {
    console.error('[api/auth/google/callback] failed:', err)
    return NextResponse.redirect(`${origin}/?authError=google_failed`)
  }
}
