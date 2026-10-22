import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

/** چک دسترسی: چت‌های مهمان برای همه، چت کاربر فقط برای خودش */
async function canAccess(
  req: NextRequest,
  conversationId: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  })
  if (!conversation) return { ok: false, status: 404, error: 'این چت پیدا نشد!' }
  if (conversation.userId) {
    const user = await getUserFromRequest(req)
    if (!user || user.id !== conversation.userId) {
      return { ok: false, status: 403, error: 'این چت مال تو نیست داداش! 🔒' }
    }
  }
  return { ok: true }
}

type RouteParams = { params: Promise<{ id: string }> }

// پیام‌های یک گفتگو
// ?after=ISO → فقط پیام‌های بعد از این زمان (polling سبک برای تصویرسازی)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const access = await canAccess(req, id)
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error ?? 'دسترسی نداری!' },
        { status: access.status ?? 403 }
      )
    }
    const afterParam = req.nextUrl.searchParams.get('after')
    const after = afterParam ? new Date(afterParam) : null
    const validAfter = after && !Number.isNaN(after.getTime()) ? after : null

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          where: validAfter ? { createdAt: { gt: validAfter } } : undefined,
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
    const access = await canAccess(req, id)
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error ?? 'دسترسی نداری!' },
        { status: access.status ?? 403 }
      )
    }
    await db.conversation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/conversations/:id] delete failed:', err)
    return NextResponse.json({ error: 'حذف چت انجام نشد!' }, { status: 500 })
  }
}
