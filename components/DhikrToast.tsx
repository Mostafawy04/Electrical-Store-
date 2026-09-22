"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { DHIKR_LIST } from "@/lib/i18n";

export function DhikrToast() {
  const { settings } = useApp();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.dhikrEnabled) return;
    let idx = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let hide: ReturnType<typeof setTimeout> | null = null;
    try {
      const mins = Math.min(Math.max(1, Number(settings.dhikrIntervalMin) || 30), 180);
      const show = () => {
        try {
          setMsg(DHIKR_LIST[idx % DHIKR_LIST.length]);
          idx += 1;
          if (hide) clearTimeout(hide);
          hide = setTimeout(() => setMsg(null), 8000);
        } catch { /* ignore */ }
      };
      // أول تذكير بعد 10 ثوانٍ حتى لا يزعج عند الفتح
      const first = setTimeout(show, 10000);
      timer = setInterval(show, mins * 60 * 1000);
      return () => {
        clearTimeout(first);
        if (timer) clearInterval(timer);
        if (hide) clearTimeout(hide);
      };
    } catch {
      return undefined;
    }
  }, [settings.dhikrEnabled, settings.dhikrIntervalMin]);

  if (!msg) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white/95 px-5 py-3 shadow-2xl dark:border-emerald-800 dark:bg-gray-900/95">
        <span className="text-2xl">🤲</span>
        <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{msg}</p>
        <button
          onClick={() => setMsg(null)}
          className="rounded-full px-2 text-gray-400 hover:text-gray-600"
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
