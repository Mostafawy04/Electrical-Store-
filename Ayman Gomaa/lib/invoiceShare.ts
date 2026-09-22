// أدوات مشاركة الفاتورة: نص منسق + Web Share API + واتساب — تعمل على الموبايل والديسكتوب
import type { Sale } from "./types";
import { DEFAULT_STORE_NAME, DEFAULT_STORE_PHONES } from "./types";
import { fmtDate, fmtMoney, toNum } from "./utils";
import { getRandomDhikr } from "./i18n";

/** رقم مختصر للفاتورة من الـ id */
export function shortInvoiceNo(id: string | undefined | null): string {
  if (!id) return "—";
  const s = String(id);
  return s.length > 6 ? s.slice(-6) : s;
}

/** بناء نص الفاتورة للمشاركة (واتساب / نسخ / Web Share) */
export function buildInvoiceText(sale: Sale, companyName: string, storePhones?: string): string {
  const name = (companyName || DEFAULT_STORE_NAME).trim();
  const phones = (storePhones || "").trim() || DEFAULT_STORE_PHONES;
  const items = sale?.items ?? [];
  const lines: string[] = [];

  lines.push(`⚡ *${name}*`);
  lines.push(`📞 ${phones}`);
  lines.push(`🧾 فاتورة بيع #${shortInvoiceNo(sale?.id)}`);
  lines.push(`📅 ${fmtDate(sale?.date)}`);
  lines.push(`———————————`);

  if (items.length === 0) {
    lines.push(`(لا توجد أصناف)`);
  } else {
    lines.push(`م | الصنف | الكمية | السعر | الإجمالي`);
    items.forEach((it, i) => {
      const qty = toNum(it?.qty, 0);
      const price = toNum(it?.salePrice, 0);
      const total = toNum(it?.total ?? qty * price, 0);
      lines.push(`${i + 1}) ${it?.name || "صنف"}`);
      lines.push(`   ${qty} × ${price} = ${total}`);
    });
  }

  lines.push(`———————————`);
  lines.push(`عدد الأصناف: ${items.length}`);
  lines.push(`الإجمالي الفرعي: ${fmtMoney(sale?.subtotal)}`);
  if (toNum(sale?.discount, 0) > 0) {
    lines.push(`الخصم: ${fmtMoney(sale?.discount)}`);
  }
  lines.push(`*الإجمالي الكلي: ${fmtMoney(sale?.netTotal)}*`);
  if (sale?.notes?.trim()) {
    lines.push(`📝 ملاحظات: ${sale.notes.trim()}`);
  }
  lines.push(`———————————`);
  lines.push(`شكراً لتعاملكم معنا 🌹`);
  lines.push(`📞 ${phones}`);

  // خاتمة دينية متجددة (غير ثابتة)
  try {
    lines.push(getRandomDhikr().text);
  } catch {
    lines.push("صلي على النبي ﷺ");
  }

  return lines.join("\n");
}

/** هل المتصفح يدعم المشاركة الأصلية (موبايل غالباً)؟ */
export function canNativeShare(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof (navigator as never as { share?: unknown }).share === "function";
  } catch {
    return false;
  }
}

/** مشاركة عبر Web Share API مع fallback تلقائي للنسخ */
export async function shareInvoice(sale: Sale, companyName: string, storePhones?: string): Promise<"shared" | "copied" | "failed"> {
  const text = buildInvoiceText(sale, companyName, storePhones);
  const title = `فاتورة ${companyName} #${shortInvoiceNo(sale?.id)}`;

  // 1) Web Share API (الأفضل للموبايل — يفتح قائمة واتساب/تليجرام/…)
  if (canNativeShare()) {
    try {
      await (navigator as never as { share: (d: { title: string; text: string }) => Promise<void> }).share({
        title,
        text,
      });
      return "shared";
    } catch (err) {
      // المستخدم ألغى المشاركة → لا نعتبره فشلاً ولا ننسخ
      if (err instanceof Error && err.name === "AbortError") return "failed";
      // أكمل للـ fallback
    }
  }

  // 2) النسخ للحافظة كبديل
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    /* fallback أخير */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return "copied";
  } catch {
    return "failed";
  }
}

/** فتح واتساب مباشرة مع نص الفاتورة (اختياري: رقم العميل بدون + مثل 2010xxxxxxx) */
export function openWhatsAppShare(sale: Sale, companyName: string, customerPhone = "", storePhones?: string): void {
  const text = buildInvoiceText(sale, companyName, storePhones);
  const phone = (customerPhone || "").replace(/[^\d]/g, "");
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}

/** نسخ نص الفاتورة فقط — تُرجع true عند النجاح */
export async function copyInvoiceText(sale: Sale, companyName: string, storePhones?: string): Promise<boolean> {
  const text = buildInvoiceText(sale, companyName, storePhones);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}
