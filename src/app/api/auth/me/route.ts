import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

/** کاربر فعلی (یا null برای مهمان) */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  return NextResponse.json({ user })
}
