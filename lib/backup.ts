// النسخ الاحتياطي: تنزيل محلي + إرسال عبر إيميل + سحابة Supabase
import { db } from "./db";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { nowISO } from "./utils";

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  exportedBy?: string;
  settings: unknown;
  products: unknown[];
  purchases: unknown[];
  sales: unknown[];
  customers: unknown[];
}

export async function buildBackup(userEmail?: string): Promise<BackupPayload> {
  const [products, purchases, sales, customers, settings] = await Promise.all([
    db.getProducts().catch(() => []),
    db.getPurchases().catch(() => []),
    db.getSales().catch(() => []),
    db.getCustomers().catch(() => []),
    db.getSettings({
      companyName: "",
      storePhones: "",
      darkMode: false,
      fontSize: "medium",
      fontFamily: "cairo",
      language: "ar",
      dhikrEnabled: true,
      dhikrIntervalMin: 30,
    }).catch(() => ({})),
  ]);
  return {
    version: 1,
    exportedAt: nowISO(),
    exportedBy: userEmail,
    settings,
    products,
    purchases,
    sales,
    customers,
  };
}

export function downloadBackup(payload: BackupPayload): void {
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = (payload.exportedAt ?? "").slice(0, 10);
    a.href = url;
    a.download = `backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); a.remove(); } catch { /* ignore */ }
    }, 500);
  } catch { /* ignore */ }
}

/** نسخة عبر إيميل جوجل: يفتح Gmail مع ملخص + ينسخ البيانات للحافظة */
export async function backupViaEmail(payload: BackupPayload, userEmail?: string): Promise<{ opened: boolean }> {
  const json = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(json).catch(() => undefined);
    }
  } catch { /* ignore */ }
  try {
    const to = userEmail ?? "";
    const subject = encodeURIComponent(`نسخة احتياطية - ${payload.exportedAt.slice(0, 10)}`);
    const body = encodeURIComponent(
      `السلام عليكم،\n\nهذه نسخة احتياطية من نظام المبيعات بتاريخ ${payload.exportedAt}.\n` +
      `عدد المنتجات: ${(payload.products ?? []).length}\n` +
      `عدد العملاء: ${(payload.customers ?? []).length}\n` +
      `عدد فواتير المشتريات: ${(payload.purchases ?? []).length}\n` +
      `عدد فواتير المبيعات: ${(payload.sales ?? []).length}\n\n` +
      `ملاحظة: تم نسخ ملف JSON الكامل إلى الحافظة، والصقه في مسودة الإيميل أو احفظه كمرفق بعد تنزيله من زر "تنزيل نسخة محلية".\n`
    );
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${subject}&body=${body}`;
    window.open(gmail, "_blank", "noopener");
    return { opened: true };
  } catch {
    return { opened: false };
  }
}

/** استعادة نسخة من ملف JSON */
export async function restoreBackup(payload: BackupPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!payload || payload.version !== 1) return { ok: false, error: "ملف غير صالح" };
    const { products, purchases, sales, customers, settings } = payload as BackupPayload & {
      products: never[]; purchases: never[]; sales: never[]; customers: never[];
    };
    if (Array.isArray(products)) for (const p of products) await db.saveProduct(p as never);
    if (Array.isArray(purchases)) for (const p of purchases) await db.savePurchase(p as never);
    if (Array.isArray(sales)) for (const s of sales) await db.saveSale(s as never);
    if (Array.isArray(customers)) for (const c of customers) await db.saveCustomer(c as never);
    if (settings) await db.saveSettings(settings as never);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "فشل الاستعادة" };
  }
}

/** نسخة سحابية إلى Supabase Storage (إن توفر) */
export async function backupToCloud(payload: BackupPayload, userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase غير مُعد — استخدم النسخة المحلية" };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase غير متاح" };
  try {
    const path = `${userId}/backup-${payload.exportedAt.replace(/[:.]/g, "-")}.json`;
    const { error } = await sb.storage.from("backups").upload(path, JSON.stringify(payload), {
      contentType: "application/json",
      upsert: true,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "فشل الرفع" };
  }
}
