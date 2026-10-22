import { NextResponse } from 'next/server'

/**
 * کدوم روش‌های ورود فعاله؟ فرانت بر اساسش دکمه‌ها رو می‌چینه
 * تا کاربر روی گوگلِ کانفیگ‌نشده کلیک نکنه و لاپ رانده نشه
 */
export async function GET() {
  const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return NextResponse.json({ google })
}
