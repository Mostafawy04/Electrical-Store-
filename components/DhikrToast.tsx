"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../lib/store";
import { DHIKR_LIST, pickNextDhikrIndex } from "../lib/i18n";

const LAST_INDEX_KEY = "salesapp_dhikr_last_index";
const ICONS = ["🤲", "🌿", "✨", "💚", "🌙", "🤍"];

function loadLastIndex(): number {
  try {
    const raw = localStorage.getItem(LAST_INDEX_KEY);
    const n = raw == null ? -1 : parseInt(raw, 10);
    return Number.isFinite(n) ? n : -1;
  } catch {
    return -1;
  }
}

export function DhikrToast() {
  const { settings } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const idxRef = useRef<number>(-1);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNext = useCallback(() => {
    try {
      const next = pickNextDhikrIndex(idxRef.current, DHIKR_LIST.length);
      idxRef.current = next;
      try {
        localStorage.setItem(LAST_INDEX_KEY, String(next));
      } catch {
        /* ignore */
      }
      setMsg(DHIKR_LIST[next]);
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), 9000);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!settings.dhikrEnabled) {
      setVisible(false);
      setMsg(null);
      return;
    }
    try {
      idxRef.current = loadLastIndex();
    } catch {
      idxRef.current = -1;
    }
    const mins = Math.min(Math.max(1, Number(settings.dhikrIntervalMin) || 30), 180);
    // أول تذكير بعد 10 ثوانٍ حتى لا يزعج عند الفتح
    const first = setTimeout(showNext, 10000);
    const timer = setInterval(showNext, mins * 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [settings.dhikrEnabled, settings.dhikrIntervalMin, showNext]);

  // إخفاء فعلي بعد انتهاء الأنيميشن
  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => setMsg(null), 400);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!msg) return null;

  const icon = ICONS[(idxRef.current >= 0 ? idxRef.current : 0) % ICONS.length];

  return (
    <div
      className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex max-w-[92vw] items-center gap-3 rounded-2xl border border-emerald-200 bg-white/95 px-5 py-3 shadow-2xl backdrop-blur dark:border-emerald-800 dark:bg-gray-900/95">
        <span className="shrink-0 text-2xl">{icon}</span>
        <p className="text-center text-base font-bold leading-relaxed text-emerald-700 dark:text-emerald-300">
          {msg}
        </p>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 rounded-full px-2 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="إغلاق التذكير"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
