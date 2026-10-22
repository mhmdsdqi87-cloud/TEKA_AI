/**
 * کمکی‌های سمت کلاینت برای پیوست‌ها:
 * - تغییر سایز عکس (کم شدن حجم و سریع شدن ارسال)
 * - خواندن فایل به‌صورت data URL
 * - فرمت حجم فایل به فارسی
 */

const MAX_DIM = 1280

/** عکس رو به حداکثر ۱۲۸۰ پیکسل تغییر سایز می‌ده و JPEG برمی‌گردونه */
export async function resizeImageToDataUrl(file: File): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file)

  try {
    const img = await loadImage(rawDataUrl)
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale >= 1 && file.size < 900_000) {
      return rawDataUrl // همینطور خوبه، فشرده‌سازی لازم نیست
    }

    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return rawDataUrl
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return rawDataUrl // اگه canvas قاطی کرد، همون عکس اصلی رو بده
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

/** حجم فایل به فارسی: ۱٫۲ مگابایت */
export function formatFileSize(bytes: number): string {
  const fmt = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })
  if (bytes < 1024) return `${fmt.format(bytes)} بایت`
  if (bytes < 1024 * 1024) return `${fmt.format(bytes / 1024)} کیلوبایت`
  return `${fmt.format(bytes / (1024 * 1024))} مگابایت`
}

/** انواع فایل قابل آنالیز برای accept اینپوت */
export const ANALYZABLE_ACCEPT =
  '.pdf,.docx,.txt,.md,.csv,.tsv,.json,.xml,.yml,.yaml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.sh,.sql,.log,.ini,.toml,.vue,.svelte,.kt,.swift,application/pdf,text/*,application/json'
