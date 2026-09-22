// الأنواع الأساسية للتطبيق — كل الحقول اختيارية حيث أمكن لمنع Runtime Errors

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  purchasePrice: number; // سعر الشراء
  salePrice: number; // سعر البيع للجمهور
  stock: number;
  supplier?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  synced?: boolean;
}

export interface PurchaseItem {
  id: string;
  productName: string;
  productId?: string;
  barcode?: string;
  qty: number;
  purchasePrice: number;
  discount: number; // خصم على السطر (قيمة مطلقة)
  salePrice: number; // سعر البيع المقترح للجمهور
  total: number; // (qty * purchasePrice) - discount
}

export interface Purchase {
  id: string;
  supplier: string;
  items: PurchaseItem[];
  subtotal: number;
  discountTotal: number;
  grandTotal: number; // الإجمالي بعد الخصم
  date: string; // ISO
  notes?: string;
  synced?: boolean;
}

export interface SaleItem {
  id: string;
  productId?: string;
  name: string;
  barcode?: string;
  qty: number;
  salePrice: number; // البيع بسعر الجمهور حصراً
  purchasePrice: number; // للربح (0 إن غير معروف)
  total: number; // qty * salePrice
  profit: number; // (salePrice - purchasePrice) * qty
}

export interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  netTotal: number; // الصافي بسعر الجمهور
  profitTotal: number;
  date: string; // ISO
  notes?: string;
  synced?: boolean;
  // ——— بيانات الفاتورة الكلاسيكية (حسابات العملاء) ———
  customerName?: string; // اسم العميل
  invoiceNo?: string; // رقم الفاتورة المتسلسل المعروض
  previousBalance?: number; // الحساب السابق (عليكم)
  paid?: number; // المدفوع من هذه الفاتورة
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  balance: number; // الحساب الحالي (عليكم + / لكم −)
  notes?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  synced?: boolean;
}

export type FontSizeOpt = "small" | "medium" | "large";
export type FontFamilyOpt = "cairo" | "tajawal" | "system";
export type LangOpt = "ar" | "en";

export interface AppSettings {
  companyName: string;
  storePhones: string;
  darkMode: boolean;
  fontSize: FontSizeOpt;
  fontFamily: FontFamilyOpt;
  language: LangOpt;
  dhikrEnabled: boolean;
  dhikrIntervalMin: number; // كل كم دقيقة
}

export const DEFAULT_STORE_NAME = "مؤسسة الجبالي للأدوات الكهربائية";
export const DEFAULT_STORE_PHONES = "01158869448 - 01013454036";

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: DEFAULT_STORE_NAME,
  storePhones: DEFAULT_STORE_PHONES,
  darkMode: false,
  fontSize: "medium",
  fontFamily: "cairo",
  language: "ar",
  dhikrEnabled: true,
  dhikrIntervalMin: 30,
};

export interface OutboxOp {
  id: string;
  table: "products" | "purchases" | "sales" | "customers";
  action: "upsert" | "delete";
  payload: unknown;
  createdAt: string;
}

/** رقم الفاتورة المعروض: المتسلسل إن وُجد وإلا مختصر الـ id */
export function displayInvoiceNo(sale: Pick<Sale, "id" | "invoiceNo"> | null | undefined): string {
  const no = (sale?.invoiceNo ?? "").trim();
  if (no) return no;
  const id = sale?.id ?? "";
  return id.length > 6 ? id.slice(-6) : id || "—";
}

/** إجماليات الفاتورة الكلاسيكية */
export function calcInvoiceTotals(sale: {
  items?: Array<{ qty?: unknown } | null> | null;
  subtotal?: unknown;
  discount?: unknown;
  netTotal?: unknown;
  previousBalance?: unknown;
  paid?: unknown;
}): {
  totalQty: number;
  itemCount: number;
  invoiceTotal: number;
  prevBalance: number;
  grandTotal: number;
  paid: number;
  currentBalance: number;
} {
  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const totalQty = items.reduce((a, it) => {
    const q = Math.max(0, Math.floor(num((it as { qty?: unknown } | null)?.qty)));
    return a + q;
  }, 0);
  const subtotal = Math.max(0, num(sale?.subtotal));
  const discount = Math.min(Math.max(0, num(sale?.discount)), subtotal);
  const invoiceTotal = Math.max(0, num(sale?.netTotal) || subtotal - discount);
  const prevBalance = Math.max(0, num(sale?.previousBalance));
  const grandTotal = prevBalance + invoiceTotal;
  const paid = Math.min(Math.max(0, num(sale?.paid)), grandTotal);
  return {
    totalQty,
    itemCount: items.length,
    invoiceTotal,
    prevBalance,
    grandTotal,
    paid,
    currentBalance: Math.max(0, grandTotal - paid),
  };
}
