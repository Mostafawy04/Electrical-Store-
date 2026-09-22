import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProvider } from "../lib/store";
import { Shell } from "../components/Shell";
import { DhikrToast } from "../components/DhikrToast";

export const metadata: Metadata = {
  title: "نظام المبيعات والمشتريات",
  description: "إدارة المبيعات والمشتريات — عربي، أوفلاين، PWA",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "المبيعات" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="المبيعات" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <link rel="icon" href="/icons/icon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AppProvider>
          <Shell>{children}</Shell>
          <DhikrToast />
        </AppProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            (function(){
              try {
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function(){
                    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function(){});
                  });
                }
              } catch(e){}
            })();`,
          }}
        />
      </body>
    </html>
  );
}
