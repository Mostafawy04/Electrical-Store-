// قواميس اللغة (العربية أساس + إنجليزية اختيارية)
import type { LangOpt } from "./types";

const ar = {
  dashboard: "الرئيسية",
  purchases: "المشتريات",
  sales: "المبيعات",
  inventory: "المخزون",
  reports: "التقارير",
  settings: "الإعدادات",
  logout: "تسجيل الخروج",
  todayRevenue: "إيراد اليوم",
  monthRevenue: "إيراد الشهر",
  todayProfit: "ربح اليوم",
  monthProfit: "ربح الشهر",
  totalSales: "إجمالي المبيعات",
  totalPurchases: "إجمالي المشتريات",
  stockValue: "قيمة المخزون",
  invoicesToday: "فواتير اليوم",
  save: "حفظ",
  cancel: "إلغاء",
  delete: "حذف",
  edit: "تعديل",
  add: "إضافة",
  print: "طباعة",
  support: "تواصل مع الدعم",
};

const en: Record<keyof typeof ar, string> = {
  dashboard: "Dashboard",
  purchases: "Purchases",
  sales: "Sales",
  inventory: "Inventory",
  reports: "Reports",
  settings: "Settings",
  logout: "Logout",
  todayRevenue: "Today revenue",
  monthRevenue: "Month revenue",
  todayProfit: "Today profit",
  monthProfit: "Month profit",
  totalSales: "Total sales",
  totalPurchases: "Total purchases",
  stockValue: "Stock value",
  invoicesToday: "Today invoices",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  add: "Add",
  print: "Print",
  support: "Contact support",
};

export function t(lang: LangOpt, key: keyof typeof ar): string {
  return lang === "en" ? en[key] : ar[key];
}

export const DHIKR_LIST = [
  "صلي على النبي ﷺ",
  "لا حول ولا قوة إلا بالله",
  "لا إله إلا الله",
  "سبحان الله وبحمده، سبحان الله العظيم",
  "استغفر الله العظيم وأتوب إليه",
];
