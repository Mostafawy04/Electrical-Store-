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
  // صلاة على النبي ﷺ
  "اللهم صلِّ وسلِّم على نبينا محمد ﷺ",
  "صلي على النبي ﷺ",
  "اللهم صل على محمد وعلى آل محمد 🌿",
  // استغفار
  "أستغفر الله العظيم وأتوب إليه",
  "رب اغفر لي وتب علي إنك أنت التواب الرحيم",
  "استغفر الله… فالاستغفار يفتح أبواب الرزق 🤲",
  // تسبيح وتوحيد
  "سبحان الله وبحمده، سبحان الله العظيم",
  "سبحان الله والحمد لله ولا إله إلا الله والله أكبر",
  "لا حول ولا قوة إلا بالله",
  "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير",
  "سبحان الله، الحمد لله، الله أكبر",
  // أدعية الرزق والبركة
  "اللهم ارزقنا رزقاً حلالاً طيباً مباركاً فيه",
  "اللهم بارك لنا في تجارتنا وأعمالنا 💚",
  "اللهم إنّا نسألك من فضلك ورحمتك",
  "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار",
  "اللهم اكفنا بحلالك عن حرامك وأغننا بفضلك عمن سواك",
  // حكم ومواعظ قصيرة
  "الكلمة الطيبة صدقة 🌹",
  "الصدق في التجارة بركة — «التاجر الصدوق مع النبيين»",
  "ما نقص مال من صدقة 🤍",
  "الأمانة تجلب الرزق والثقة",
  "ابتسم في وجه عميلك… تبسُّمك صدقة 😊",
  "الإتقان في العمل عبادة",
  // أدعية عامة متجددة
  "اللهم اشرح صدورنا ويسّر أمورنا",
  "يا حي يا قيوم برحمتك نستغيث",
  "اللهم أعنا على ذكرك وشكرك وحسن عبادتك",
  "حسبنا الله ونعم الوكيل",
  "اللهم اجعل يومنا هذا مباركاً 🌅",
  "توكلنا على الله… ولا حول ولا قوة إلا بالله",
  "اللهم احفظنا وبارك في أهلنا وأرزاقنا",
  "الحمد لله على كل حال 🤍",
  "اللهم اجعلنا من الشاكرين لنعمك",
  "لا إله إلا أنت سبحانك إني كنت من الظالمين",
  "اللهم عافنا واعف عنا",
];

/** يختار ذكراً عشوائياً مع تجنّب تكرار نفس العنصر مرتين متتاليتين */
export function pickNextDhikrIndex(prevIndex: number, length = DHIKR_LIST.length): number {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  // تجنّب التكرار المباشر
  if (next === prevIndex) next = (next + 1 + Math.floor(Math.random() * (length - 1))) % length;
  return next;
}

/** ذكر عشوائي (يستثني فهرساً معيناً إن وُجد) */
export function getRandomDhikr(excludeIndex = -1): { text: string; index: number } {
  const index = pickNextDhikrIndex(excludeIndex, DHIKR_LIST.length);
  return { text: DHIKR_LIST[index], index };
}
