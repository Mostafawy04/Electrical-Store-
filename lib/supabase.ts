// عميل Supabase — آمن تماماً عند غياب الإعدادات (وضع محلي Offline)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    return url.startsWith("http") && key.length > 10;
  } catch {
    return false;
  }
}

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  try {
    if (!isSupabaseConfigured()) {
      cached = null;
      return cached;
    }
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );
    return cached;
  } catch {
    cached = null;
    return cached;
  }
}

/** هل هذا الإيميل مسموح له بالدخول؟ (قائمة env + جدول allowed_users) */
export async function isEmailAllowed(email: string): Promise<{ allowed: boolean; reason: string }> {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return { allowed: false, reason: "أدخل البريد الإلكتروني" };

  // 1) قائمة الإيميلات من الإعدادات
  try {
    const raw = process.env.NEXT_PUBLIC_ALLOWED_EMAILS ?? "";
    const list = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (list.includes(normalized)) return { allowed: true, reason: "" };
  } catch { /* ignore */ }

  // 2) جدول allowed_users في Supabase (يتحكم به المسؤول)
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("allowed_users")
        .select("email,is_active")
        .ilike("email", normalized)
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        if ((data as { is_active?: boolean }).is_active === false) {
          return { allowed: false, reason: "not_active" };
        }
        return { allowed: true, reason: "" };
      }
    } catch { /* يعمل محلياً عند انقطاع الإنترنت */ }
  }

  // 3) إن لم توجد أي قائمة مُعدّة: اسمح محلياً (وضع الإعداد الأولي) مع تنبيه
  try {
    const raw = process.env.NEXT_PUBLIC_ALLOWED_EMAILS ?? "";
    if (!raw.trim() && !isSupabaseConfigured()) {
      return { allowed: true, reason: "local_mode" };
    }
  } catch { /* ignore */ }

  return { allowed: false, reason: "not_allowed" };
}

export const BLOCKED_MESSAGE =
  "الحساب غير مفعّل. تواصل مع الدعم لتفعيل حسابك.";
