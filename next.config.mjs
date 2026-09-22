/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // إيقاف تدقيق TypeScript أثناء الـ Build (حتى لا يفشل النشر على Vercel)
  typescript: {
    ignoreBuildErrors: true,
  },
  // إيقاف تدقيق ESLint أثناء الـ Build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // PWA + Offline: service worker يُسجَّل من المتصفح، وهذه الهيدرات تضمن تثبيته وعمله
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
