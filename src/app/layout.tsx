import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "تکا | هوش مصنوعی خودمونی",
  description:
    "تکا، هوش مصنوعی فارسی‌زبان و خودمونی — ساختهٔ محمد صادقی. با تکا مثل یه رفیق صمیمی چت کن.",
  keywords: ["تکا", "Teka", "هوش مصنوعی", "چت بات فارسی", "محمد صادقی", "AI فارسی"],
  authors: [{ name: "محمد صادقی" }],
  icons: {
    icon: "/teka-avatar.png",
    apple: "/teka-avatar.png",
  },
  openGraph: {
    title: "تکا | هوش مصنوعی خودمونی",
    description: "با تکا مثل یه رفیق صمیمی حرف بزن — ساختهٔ محمد صادقی",
    siteName: "تکا",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c1210",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
