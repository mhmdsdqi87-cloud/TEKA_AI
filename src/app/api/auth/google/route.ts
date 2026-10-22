import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { OAUTH_STATE_COOKIE } from '@/lib/auth'

/**
 * شروع ورود با گوگل (OAuth2 استاندارد)
 * کلیدها توی متغیرهای محیطی: GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET
 * اگه ست نباشن، کاربر با پیام واضح برمی‌گرده.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/?authError=google_not_configured`)
  }

  const state = randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
  res.headers.append(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
  )
  return res
}
