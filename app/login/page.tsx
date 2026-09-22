"use client";
import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { getSupabase, isSupabaseConfigured, isEmailAllowed, BLOCKED_MESSAGE } from "@/lib/supabase";
import { inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const em = email.trim().toLowerCase();
    if (!em || !password) {
      setError("أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      // 1) فحص الصلاحية أولاً — غير المصرح له يُرفض برسالة الدعم
      const check = await isEmailAllowed(em);
      if (!check.allowed) {
        setError(check.reason === "local_mode" ? BLOCKED_MESSAGE : BLOCKED_MESSAGE);
        setLoading(false);
        return;
      }

      // 2) تسجيل الدخول عبر Supabase (إن كان مُعداً)
      if (isSupabaseConfigured()) {
        const sb = getSupabase();
        const { data, error: err } = await sb!.auth.signInWithPassword({ email: em, password });
        if (err) {
          setError(err.message.includes("Invalid login") ? "بيانات الدخول غير صحيحة" : err.message);
          setLoading(false);
          return;
        }
        setUser(data.user?.email ?? em, data.user?.id ?? null);
      } else {
        // وضع محلي (بدون Supabase): قبول الإيميلات المسموحة في env فقط
        const raw = process.env.NEXT_PUBLIC_ALLOWED_EMAILS ?? "";
        if (raw.trim()) {
          const list = raw.split(",").map((s) => s.trim().toLowerCase());
          if (!list.includes(em)) {
            setError(BLOCKED_MESSAGE);
            setLoading(false);
            return;
          }
        }
        setUser(em, "local");
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ — حاول مجدداً");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-3xl text-white">🛒</div>
          <h1 className="text-xl font-black">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-gray-500">للمستخدمين المفعّلين فقط — لا يوجد تسجيل جديد</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <span className="mb-1 block text-sm font-semibold">البريد الإلكتروني</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputCls} dir-ltr`}
              dir="ltr"
              placeholder="you@store.com"
              autoComplete="email"
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold">كلمة المرور</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} dir-ltr`}
              dir="ltr"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {!!error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
              <div className="mt-2">
                <a
                  href="https://wa.me/201113008004"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  تواصل مع الدعم عبر واتساب: 01113008004
                </a>
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-600 py-2.5 font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "جارٍ الدخول…" : "دخول"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">
          تفعيل الحسابات يتم من لوحة Supabase أو عبر المسؤول فقط.
        </p>
      </div>
    </div>
  );
}
