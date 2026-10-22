#!/bin/bash
# 🗄️ بکاپ‌گیر دیتابیس تکا — آخرین ۱۰ نسخه نگه داشته می‌شه
set -euo pipefail
cd "$(dirname "$0")/.."
DB="db/custom.db"
BACKUP_DIR="db/backups"
mkdir -p "$BACKUP_DIR"
if [ -f "$DB" ]; then
  SIZE=$(stat -c%s "$DB")
  # اگه فایل ناگهانی خیلی کوچیک شد (احتمال خرابی/ریست)، بکاپ نگیر که بکاپ خوب رو بازنویسی نکنه
  if [ "$SIZE" -lt 10000 ]; then
    echo "⚠️  db خیلی کوچیکه ($SIZE بایت) — احتمالاً ریست شده؛ بکاپ رد شد."
    exit 0
  fi
  STAMP=$(date +%Y%m%d-%H%M%S)
  cp "$DB" "$BACKUP_DIR/custom-$STAMP.db"
  # فقط ۱۰ نسخهٔ آخر
  ls -1t "$BACKUP_DIR"/custom-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
  echo "✅ بکاپ: $BACKUP_DIR/custom-$STAMP.db ($SIZE بایت)"
else
  echo "❌ $DB پیدا نشد!"
  exit 1
fi
