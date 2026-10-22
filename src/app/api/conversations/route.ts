import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// لیست گفتگوهای کاربر (یا مهمان)
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    // کاربر لاگین‌شده: چت‌های خودش + چت‌های مهمانِ قدیمی
    // مهمان: فقط چت‌های بدون صاحب
    const conversations = await db.conversation.findMany({
      where: user ? { OR: [{ userId: user.id }, { userId: null }] } : { userId: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    })
    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('[api/conversations] list failed:', err)
    return NextResponse.json({ error: 'لیست چت‌ها نیومد!' }, { status: 500 })
  }
}

// ساخت گفتگوی جدید خالی
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    const conversation = await db.conversation.create({
      data: { title: 'چت جدید', userId: user?.id ?? null },
      select: { id: true, title: true, createdAt: true },
    })
    return NextResponse.json({ conversation }, { status: 201 })
  } catch (err) {
    console.error('[api/conversations] create failed:', err)
    return NextResponse.json({ error: 'چت جدید ساخته نشد!' }, { status: 500 })
  }
}
