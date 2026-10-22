import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "تکا | هوش مصنوعی خودمونی",
  description:
    "تکا، هوش مصنوعی فارسی‌زبان و خودمونی — ساختهٔ محمد صادقی. با تکا مثل یه رفیق صمیمی چت کن، بلند بخونش، و حالشو ببر!",
  keywords: ["تکا", "Teka", "هوش مصنوعی", "چت بات فارسی", "محمد صادقی", "AI فارسی"],
  authors: [{ name: "محمد صادقی" }],
  icons: {
    icon: "/teka-logo-gold.png",
    apple: "/teka-logo-gold.png",
  },
  openGraph: {
    title: "تکا | هوش مصنوعی خودمونی",
    description: "با تکا مثل یه رفیق صمیمی حرف بزن — ساختهٔ محمد صادقی",
    siteName: "تکا",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#171310",
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
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
