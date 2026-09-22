// أدوات مساعدة آمنة (تمنع NaN / undefined crashes)

export function toNum(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function uid(prefix = "id"): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch { /* ignore */ }
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function fmtMoney(n: unknown, currency = "ج.م"): string {
  const v = toNum(n, 0);
  try {
    return `${v.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currency}`;
  } catch {
    return `${v} ${currency}`;
  }
}

export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function startOfDay(d = new Date()): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function startOfMonth(d = new Date()): Date {
  const c = new Date(d);
  c.setDate(1);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function isSameDay(aISO: string, b = new Date()): boolean {
  try {
    const a = new Date(aISO);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  } catch {
    return false;
  }
}

export function isSameMonth(aISO: string, b = new Date()): boolean {
  try {
    const a = new Date(aISO);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  } catch {
    return false;
  }
}

/** حساب سطر مشتريات: الإجمالي بعد الخصم */
export function calcPurchaseLineTotal(qty: number, price: number, discount: number): number {
  const q = Math.max(0, toNum(qty));
  const p = Math.max(0, toNum(price));
  const d = Math.min(Math.max(0, toNum(discount)), q * p);
  return Math.max(0, q * p - d);
}

/** حساب سطر بيع بسعر الجمهور */
export function calcSaleLineTotal(qty: number, salePrice: number): number {
  return Math.max(0, toNum(qty)) * Math.max(0, toNum(salePrice));
}

export function calcSaleLineProfit(qty: number, salePrice: number, purchasePrice: number): number {
  return (Math.max(0, toNum(salePrice)) - Math.max(0, toNum(purchasePrice))) * Math.max(0, toNum(qty));
}

export function safeParseJSON<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
