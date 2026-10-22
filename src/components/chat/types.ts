export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export type ConversationSummary = {
  id: string
  title: string
  updatedAt: string
  messageCount?: number
}

export function faTime(iso?: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso)
    )
  } catch {
    return ''
  }
}

export function faRelativeDay(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
    if (diffDays < 1) return 'امروز'
    if (diffDays === 1) return 'دیروز'
    return new Intl.DateTimeFormat('fa-IR', { month: 'long', day: 'numeric' }).format(d)
  } catch {
    return ''
  }
}
