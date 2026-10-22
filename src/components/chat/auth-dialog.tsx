'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, LogIn, Mail, ShieldCheck, User } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

export type TekaUser = { id: string; email: string; name: string; image: string | null }

type AuthDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (user: TekaUser) => void
}

/** آیکون رسمی گوگل (چندرنگ) */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
      />
    </svg>
  )
}

/** 🔐 دیالوگ ورود / ثبت‌نام تکا */
export function AuthDialog({ open, onOpenChange, onSuccess }: AuthDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [googleHint, setGoogleHint] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)

  // گوگل فقط وقتی نشون داده می‌شه که سرور کلیدهاش رو داشته باشه
  useEffect(() => {
    let alive = true
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((d: { google?: boolean }) => {
        if (alive) setGoogleEnabled(Boolean(d?.google))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const submit = async (mode: 'login' | 'register') => {
    const form = document.getElementById('teka-auth-form') as HTMLFormElement | null
    if (!form) return
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    const email = String(fd.get('email') ?? '').trim()
    const password = String(fd.get('password') ?? '')

    setLoading(true)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, email, password } : { email, password }),
        signal: AbortSignal.timeout(20_000),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'یه چیزی قاطی شد!')
      toast({
        title: mode === 'register' ? 'خوش اومدی داداش! 🎉' : 'برگشتی! دلتنگت شده بودم 🙌',
        description: `آقای/خانم ${data.user.name} — حسابکت فعال شد!`,
      })
      onSuccess(data.user as TekaUser)
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'اوه اوه! 🙈',
        description: err instanceof Error ? err.message : 'یه خطای ناشناخته پیش اومد!',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const googleLogin = () => {
    // اگه کلیدها ست نباشن، سرور برمی‌گردونه و پیام رو صفحهٔ اصلی نشون می‌ده
    setGoogleHint(true)
    window.location.href = '/api/auth/google'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="teka-glass-strong max-w-[92vw] rounded-3xl p-0 sm:max-w-md">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-gradient-to-l from-primary via-primary/40 to-primary" />
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-lg font-bold">
            <span className="teka-gradient-text">ورود به دنیای تکا</span> 🔐
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            حساب بساز تا چت‌هات همیشه همین‌جا بمونه — با ایمیل یا یه کلیک با گوگل!
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* دکمهٔ گوگل — فقط وقتی کانفیگ شده باشه */}
          {googleEnabled && (
            <>
              <button
                onClick={googleLogin}
                disabled={loading}
                className="teka-lift flex w-full items-center justify-center gap-2.5 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-md transition-all hover:shadow-lg disabled:opacity-60"
                aria-label="ورود با گوگل"
              >
                <GoogleIcon />
                ورود با گوگل
              </button>
              {googleHint && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 text-center text-[11px] text-muted-foreground"
                >
                  داریم می‌بریمت گوگل… 🚀
                </motion.p>
              )}

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">یا با ایمیل</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <Tabs defaultValue="login" dir="rtl">
            <TabsList className="mb-4 grid w-full grid-cols-2 rounded-2xl">
              <TabsTrigger value="login" className="gap-1.5 rounded-xl text-sm">
                <LogIn className="size-4" /> ورود
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-1.5 rounded-xl text-sm">
                <User className="size-4" /> ثبت‌نام
              </TabsTrigger>
            </TabsList>

            <form id="teka-auth-form" onSubmit={(e) => e.preventDefault()}>
              <TabsContent value="login" className="mt-0 space-y-3">
                <EmailPassFields />
                <Button
                  onClick={() => submit('login')}
                  disabled={loading}
                  className="teka-shine w-full rounded-2xl py-3 font-semibold shadow-lg shadow-primary/25"
                >
                  {loading ? <Loader2 className="size-4.5 animate-spin" /> : 'بریم تو! 🚀'}
                </Button>
              </TabsContent>

              <TabsContent value="register" className="mt-0 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name" className="flex items-center gap-1.5 text-xs">
                    <User className="size-3.5 text-primary" /> اسمت چیه؟
                  </Label>
                  <Input
                    id="auth-name"
                    name="name"
                    placeholder="مثلاً سعید جان"
                    minLength={2}
                    maxLength={40}
                    required
                    className="rounded-xl bg-card/60"
                  />
                </div>
                <EmailPassFields />
                <Button
                  onClick={() => submit('register')}
                  disabled={loading}
                  className="teka-shine w-full rounded-2xl py-3 font-semibold shadow-lg shadow-primary/25"
                >
                  {loading ? (
                    <Loader2 className="size-4.5 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="size-4.5" /> حسابم رو بساز
                    </span>
                  )}
                </Button>
              </TabsContent>
            </form>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EmailPassFields() {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="auth-email" className="flex items-center gap-1.5 text-xs">
          <Mail className="size-3.5 text-primary" /> ایمیل
        </Label>
        <Input
          id="auth-email"
          name="email"
          type="email"
          dir="ltr"
          placeholder="you@example.com"
          required
          className="rounded-xl bg-card/60 text-start"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="auth-password" className="flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5 text-primary" /> رمز عبور
        </Label>
        <Input
          id="auth-password"
          name="password"
          type="password"
          dir="ltr"
          placeholder="حداقل ۶ کاراکتر"
          minLength={6}
          required
          className="rounded-xl bg-card/60 text-start"
        />
      </div>
    </>
  )
}
