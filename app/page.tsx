"use client";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { StatCard, Empty } from "@/components/ui";
import { fmtMoney, fmtDate, isSameDay, isSameMonth, toNum } from "@/lib/utils";

export default function Dashboard() {
  const router = useRouter();
  const { ready, userEmail, sales, purchases, products, settings } = useApp();

  useEffect(() => {
    if (ready && !userEmail) router.replace("/login");
  }, [ready, userEmail, router]);

  const stats = useMemo(() => {
    const safeSales = Array.isArray(sales) ? sales : [];
    const safePurch = Array.isArray(purchases) ? purchases : [];
    const todayS = safeSales.filter((s) => isSameDay(s.date));
    const monthS = safeSales.filter((s) => isSameMonth(s.date));
    const revDay = todayS.reduce((a, s) => a + toNum(s.netTotal), 0);
    const revMonth = monthS.reduce((a, s) => a + toNum(s.netTotal), 0);
    const profDay = todayS.reduce((a, s) => a + toNum(s.profitTotal), 0);
    const profMonth = monthS.reduce((a, s) => a + toNum(s.profitTotal), 0);
    const totalPurch = safePurch.reduce((a, p) => a + toNum(p.grandTotal), 0);
    const stockVal = (Array.isArray(products) ? products : []).reduce(
      (a, p) => a + toNum(p.stock) * toNum(p.purchasePrice),
      0
    );
    return { revDay, revMonth, profDay, profMonth, totalPurch, stockVal, countDay: todayS.length, countMonth: monthS.length };
  }, [sales, purchases, products]);

  const lastSales = useMemo(
    () => [...(Array.isArray(sales) ? sales : [])].sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 8),
    [sales]
  );

  // رسم بياني بسيط لآخر 7 أيام (بدون مكتبات — يعمل Offline)
  const week = useMemo(() => {
    const days: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const total = (Array.isArray(sales) ? sales : [])
        .filter((s) => isSameDay(s.date, d))
        .reduce((a, s) => a + toNum(s.netTotal), 0);
      days.push({
        label: d.toLocaleDateString("ar-EG", { weekday: "short" }),
        total,
      });
    }
    const max = Math.max(1, ...days.map((x) => x.total));
    return { days, max };
  }, [sales]);

  if (!ready) return <p className="py-10 text-center">جارٍ التحميل…</p>;
  if (!userEmail) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-l from-green-600 to-emerald-500 p-5 text-white">
        <h2 className="text-xl font-black">أهلاً بك في {settings.companyName} 👋</h2>
        <p className="mt-1 text-sm opacity-90">ملخص حركة اليوم والشهر — الأرباح محسوبة بدقة (سعر البيع − سعر الشراء)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="إيراد اليوم" value={fmtMoney(stats.revDay)} sub={`${stats.countDay} فاتورة`} icon="💰" />
        <StatCard title="إيراد الشهر" value={fmtMoney(stats.revMonth)} sub={`${stats.countMonth} فاتورة`} icon="📈" />
        <StatCard title="ربح اليوم" value={fmtMoney(stats.profDay)} icon="✅" />
        <StatCard title="ربح الشهر" value={fmtMoney(stats.profMonth)} icon="🏆" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard title="إجمالي المشتريات" value={fmtMoney(stats.totalPurch)} icon="📦" />
        <StatCard title="قيمة المخزون (بسعر الشراء)" value={fmtMoney(stats.stockVal)} sub={`${products.length} صنف`} icon="🏬" />
        <StatCard title="عدد الأصناف" value={String(products.length)} icon="🏷️" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">مبيعات آخر 7 أيام</h3>
        <div className="flex h-32 items-end gap-2">
          {week.days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-lg bg-green-500"
                style={{ height: `${Math.max(4, (d.total / week.max) * 100)}px` }}
                title={fmtMoney(d.total)}
              />
              <span className="text-[11px] text-gray-500">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">أحدث الفواتير</h3>
        {lastSales.length === 0 ? (
          <Empty text="لا توجد مبيعات بعد — ابدأ من قسم المبيعات 🧾" />
        ) : (
          <div className="space-y-2">
            {lastSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <div>
                  <p className="font-bold">{fmtMoney(s.netTotal)}</p>
                  <p className="text-xs text-gray-500">{fmtDate(s.date)} • {(s.items ?? []).length} أصناف • ربح {fmtMoney(s.profitTotal)}</p>
                </div>
                <span className="text-xs text-gray-400">#{String(s.id).slice(-6)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
