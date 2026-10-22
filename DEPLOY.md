# 🚀 دیپلوی «تکا» روی ورسل (Vercel)

تکا با Next.js 16 ساخته شده و روی ورسل بدون هیچ تنظیم اضافه‌ای اجرا می‌شه.

## قدم ۱: ریپو رو به گیت‌هاب بفرست

```bash
# اگه remote نداری (الان فقط لوکال کامیت شده):
git remote add origin https://github.com/<USERNAME>/teka.git
git push -u origin main
```

## قدم ۲: توی ورسل ایمپورت کن

1. برو به [vercel.com/new](https://vercel.com/new)
2. ریپوی `teka` رو انتخاب کن → **Import**
3. Framework رو خودکار «Next.js» تشخیص می‌ده؛ دست نزن.

## قدم ۳: متغیرهای محیطی (Environment Variables)

توی پنل ورسل (Settings → Environment Variables) اینا رو ست کن:

| کلید | مقدار | توضیح |
|---|---|---|
| `DATABASE_URL` | `file:./db/custom.db` | دیتابیس SQLite (روی ورسل بهتره یه Turso/Postgres بزنی) |
| `AUTH_SECRET` | یه رشتهٔ تصادفی بلند | کلید امضای کوکی لاگین — حتماً عوضش کن! |
| `GOOGLE_CLIENT_ID` | از Google Cloud Console | برای دکمهٔ ورود با گوگل |
| `GOOGLE_CLIENT_SECRET` | از Google Cloud Console | برای دکمهٔ ورود با گوگل |

## قدم ۴: ورود با گوگل رو فعال کن

1. برو به [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create Credentials → OAuth client ID → Web application**
3. توی **Authorized redirect URIs** اینو بذار:
   ```
   https://<YOUR-APP>.vercel.app/api/auth/google/callback
   ```
   (و برای تست لوکال: `http://localhost:3000/api/auth/google/callback`)
4. `Client ID` و `Client Secret` رو توی ورسل ست کن و **Redeploy** بزن.

## نکته‌های مهم

- ⚠️ **دیتابیس**: SQLite روی ورسل با هر دیپلوی ریست می‌شه. برای نسخهٔ واقعی یه
  [Turso](https://turso.tech) (سازگار با SQLite) یا Postgres وصل کن و
  `provider` رو توی `prisma/schema.prisma` عوض کن.
- ✅ بدون کلیدهای گوگل هم اپ کار می‌کنه؛ فقط دکمهٔ گوگل پیام «فعال نشد» می‌ده
  و کاربر می‌تونه با ایمیل/رمز وارد بشه.
- 🔁 هر push به `main` خودکار دیپلوی می‌شه.
