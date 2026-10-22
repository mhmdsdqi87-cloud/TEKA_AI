# 🚀 دیپلوی «تکا» روی ورسل (Vercel)

تکا با Next.js 16 ساخته شده و برای ورسل کاملاً آماده‌ست. این راهنما قدم‌به‌قدمه — ۱۰ دقیقه‌ای آنلاین می‌شه!

## ✅ پیش‌نیازها (همینه الان!)

- ریپو روی گیت‌هاب: `github.com/mhmdsdqi87-cloud/TEKA_AI` ✅
- دیتابیس برای سرورلس آماده شده (Prisma + آداپتور libsql) ✅
- لایهٔ هوش مصنوعی قابل‌حمل شده ✅

## قدم ۱: دیتابیس Turso بساز (رایگان)

روی ورسل نمی‌شه از فایل SQLite استفاده کرد (سرورلس هست و فایل پاک می‌شه)، پس از **Turso** استفاده می‌کنیم — دقیقاً همون SQLite ولی ابری و رایگان:

**راه ساده (پیشنهادی):** وقتی داشتن پروژه تو ورسل شدی، از تب **Storage → Marketplace → Turso** یه دیتابیس بساز — ورسل خودش `DATABASE_URL` و `DATABASE_AUTH_TOKEN` رو ست می‌کنه. تمام!

**راه دستی:** برو به [turso.tech](https://turso.tech) → ثبت‌نام با گیت‌هاب → Create Database → بعد `DATABASE_URL` و `DATABASE_AUTH_TOKEN` رو از پنل بردار تو ورسل ست کن.

بعدش اسکیمای جدول‌ها رو یه بار به Turso بفرست (روی سیستم خودت):

```bash
# خروجی SQL اسکیما:
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > init.sql

# اعمال روی Turso (با turso CLI):
turso db shell <DB-NAME> < init.sql
```

## قدم ۲: ایمپورت تو ورسل

1. برو به [vercel.com/new](https://vercel.com/new)
2. ریپوی `TEKA_AI` رو انتخاب کن → **Import**
3. Framework خودکار «Next.js» تشخیص داده می‌شه؛ دست نزن.
4. قبل از Deploy، بریم متغیرها (قدم ۳) ⬇️

## قدم ۳: متغیرهای محیطی

توی ورسل (Project → Settings → Environment Variables):

| کلید | اجباری؟ | مقدار |
|---|---|---|
| `DATABASE_URL` | ✅ | از Turso (قدم ۱) — با `libsql://` شروع می‌شه |
| `DATABASE_AUTH_TOKEN` | ✅ | توکن Turso از قدم ۱ |
| `AUTH_SECRET` | ✅ | یه رشتهٔ تصادفی بلند — بساز با `openssl rand -base64 32` |
| `AI_BASE_URL` | ➖ | آدرس سرویس AI سازگار-OpenAI (مثل `https://api.openai.com/v1`) |
| `AI_API_KEY` | ➖ | کلید API همون سرویس |
| `AI_MODEL` | ➖ | مدل چت (پیش‌فرض `gpt-4o-mini`) |
| `AI_IMAGE_MODEL` | ➖ | مدل تصویرساز (پیش‌فرض `dall-e-3`) |
| `AI_ASR_MODEL` | ➖ | مدل صوت‌به‌متن (پیش‌فرض `whisper-1`) |
| `GOOGLE_CLIENT_ID` | ➖ | برای دکمهٔ «ورود با گوگل» |
| `GOOGLE_CLIENT_SECRET` | ➖ | مثل بالا |

> ⚠️ **دربارهٔ هوش مصنوعی:** روی ورسل، کانفیگ داخلی سندباکس وجود نداره — برای اینکه تکا جواب بده **حتماً** `AI_BASE_URL` و `AI_API_KEY` رو ست کن (هر سرویس سازگار با OpenAI کافیه؛ OpenRouter ارزون‌ترین گزینه‌ست). بدون این دو تا، چت «هوش مصنوعی پیکربندی نشده» میده ولی بقیهٔ اپ سالم بالا میاد.

> 🔐 **دربارهٔ دیتابیس لوکال:** اگه `.env` لوکال `DATABASE_URL=file:...` داشته باشه، تکا همون SQLite لوکال رو می‌خونه — یعنی روی سیستم خودت بدون Turso هم همه‌چیز کار می‌کنه.

## قدم ۴: Deploy بزن! 🚀

دکمهٔ **Deploy** — بعد از ~۲ دقیقه تکا آنلاینه!

## قدم ۵ (اختیاری): ورود با گوگل

1. برو به [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create Credentials → OAuth client ID → Web application**
3. تو **Authorized redirect URIs** اینو بذار:
   ```
   https://<YOUR-APP>.vercel.app/api/auth/google/callback
   ```
   (و برای تست لوکال: `http://localhost:3000/api/auth/google/callback`)
4. `Client ID` و `Client Secret` رو تو ورسل ست کن و **Redeploy** بزن.

## قدم ۶ (اختیاری): دامنهٔ خودت

Project → Settings → Domains → دامنه‌ت رو وصل کن — ورسل SSL خودکار میده.

## 🔧 نکته‌های فنی

- **استریم چت:** روت `/api/chat` با `maxDuration = 60` ست شده (سقف پلن Hobby) — استریم حرف‌به‌حرف روی ورسل هم کار می‌کنه.
- **بکاپ دیتابیس لوکال:** `bun run backup` — آخرین ۱۰ نسخه تو `db/backups/` نگه داشته می‌شه.
- **دیتابیس:** لوکال = SQLite (`db/custom.db`)، ورسل = Turso — کد یکیه، آداپتور خودش تشخیص میده.
- **Build لوکال (self-host):** `bun run build:standalone` و بعد `bun run start`.
