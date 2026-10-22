import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ورسل خروجی standalone رو خودش هندل می‌کنه؛ لوکال برای اسکریپت start لازمه
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
