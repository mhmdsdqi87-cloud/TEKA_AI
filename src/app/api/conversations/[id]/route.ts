import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type RouteParams = { params: Promise<{ id: string }> }

// پیام‌های یک گفتگو
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'این چت پیدا نشد!' }, { status: 404 })
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        messages: conversation.messages,
      },
    })
  } catch (err) {
    console.error('[api/conversations/:id] get failed:', err)
    return NextResponse.json({ error: 'خطا در گرفتن پیام‌ها!' }, { status: 500 })
  }
}

// حذف گفتگو
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    await db.conversation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/conversations/:id] delete failed:', err)
    return NextResponse.json({ error: 'حذف چت انجام نشد!' }, { status: 500 })
  }
}
