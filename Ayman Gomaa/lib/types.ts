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
  table: "products" | "purchases" | "sales";
  action: "upsert" | "delete";
  payload: unknown;
  createdAt: string;
}
