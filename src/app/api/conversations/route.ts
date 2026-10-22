import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// لیست همهٔ گفتگوها
export async function GET() {
  try {
    const conversations = await db.conversation.findMany({
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
export async function POST() {
  try {
    const conversation = await db.conversation.create({
      data: { title: 'چت جدید' },
      select: { id: true, title: true, createdAt: true },
    })
    return NextResponse.json({ conversation }, { status: 201 })
  } catch (err) {
    console.error('[api/conversations] create failed:', err)
    return NextResponse.json({ error: 'چت جدید ساخته نشد!' }, { status: 500 })
  }
}
