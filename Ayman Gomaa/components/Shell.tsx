"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "https://wa.me/201113008004";
const YOUTUBE = process.env.NEXT_PUBLIC_YOUTUBE_URL ?? "https://youtube.com/@mostafawy04?si=Qlc05WchkaOHN3Dz";

const NAV = [
  { href: "/", key: "dashboard" as const, icon: "🏠" },
  { href: "/sales", key: "sales" as const, icon: "🧾" },
  { href: "/purchases", key: "purchases" as const, icon: "📦" },
  { href: "/inventory", key: "inventory" as const, icon: "🏬" },
  { href: "/reports", key: "reports" as const, icon: "📊" },
  { href: "/settings", key: "settings" as const, icon: "⚙️" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings, userEmail, setUser, online, syncing, doSync } = useApp();

  async function logout() {
    try {
      if (isSupabaseConfigured()) await getSupabase()?.auth.signOut();
      setUser(null, null);
      router.push("/login");
    } catch {
      setUser(null, null);
      router.push("/login");
    }
  }

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-xl text-white">🛒</div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{settings.companyName || "مؤسسة الجبالي للأدوات الكهربائية"}</h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {userEmail ?? ""} • {online ? "🟢 متصل" : "🔴 أوفلاين — يعمل محلياً"}
              {syncing ? " • جارٍ المزامنة…" : ""}
            </p>
          </div>
          <button
            onClick={() => void doSync()}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            title="مزامنة الآن"
          >
            🔄
          </button>
          <button
            onClick={() => void logout()}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            {t(settings.language, "logout")}
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  active
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {n.icon} {t(settings.language, n.key)}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-5 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {settings.companyName} — جميع الحقوق محفوظة © {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-3">
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
            >
              <span>💬</span> {t(settings.language, "support")} واتساب: 01113008004
            </a>
            <a
              href={YOUTUBE}
              target="_blank"
              rel="noopener noreferrer"
              title="قناة اليوتيوب"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
