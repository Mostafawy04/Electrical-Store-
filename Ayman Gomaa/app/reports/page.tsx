"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { StatCard, Empty } from "@/components/ui";
import { fmtMoney, toNum } from "@/lib/utils";

type Range = "today" | "month" | "all";

export default function ReportsPage() {
  const router = useRouter();
  const { ready, userEmail, sales, purchases, products, settings } = useApp();
  const [range, setRange] = useState<Range>("month");

  useEffect(() => {
    if (ready && !userEmail) router.replace("/login");
  }, [ready, userEmail, router]);

  const data = useMemo(() => {
    const now = new Date();
    const fs = (Array.isArray(sales) ? sales : []).filter((s) => {
      if (range === "all") return true;
      try {
        const d = new Date(s.date);
        if (range === "today") return d.toDateString() === now.toDateString();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      } catch { return false; }
    });
    const fp = (Array.isArray(purchases) ? purchases : []).filter((p) => {
      if (range === "all") return true;
      try {
        const d = new Date(p.date);
        if (range === "today") return d.toDateString() === now.toDateString();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      } catch { return false; }
    });
    const revenue = fs.reduce((a, s) => a + toNum(s.netTotal), 0);
    const profit = fs.reduce((a, s) => a + toNum(s.profitTotal), 0);
    const purch = fp.reduce((a, p) => a + toNum(p.grandTotal), 0);
    // الأكثر مبيعاً
    const map = new Map<string, { name: string; qty: number; total: number }>();
    fs.forEach((s) => (s.items ?? []).forEach((it) => {
      const e = map.get(it.name) ?? { name: it.name, qty: 0, total: 0 };
      e.qty += toNum(it.qty); e.total += toNum(it.total);
      map.set(it.name, e);
    }));
    const top = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
    return { revenue, profit, purch, net: revenue - purch, count: fs.length, top };
  }, [sales, purchases, range]);

  function printReport() {
    try { window.print(); } catch { /* ignore */ }
  }

  if (!ready) return <p className="py-10 text-center">جارٍ التحميل…</p>;
  if (!userEmail) return null;

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center justify-between">
        <h2 className="text-xl font-black">📊 التقارير — {settings.companyName}</h2>
        <button onClick={printReport} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white dark:bg-gray-700">
          🖨️ طباعة التقرير
        </button>
      </div>

      <div className="no-print flex gap-2">
        {(["today", "month", "all"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold ${range === r ? "bg-green-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}
          >
            {r === "today" ? "اليوم" : r === "month" ? "الشهر" : "الكل"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="الإيرادات" value={fmtMoney(data.revenue)} sub={`${data.count} فاتورة`} icon="💰" />
        <StatCard title="الأرباح" value={fmtMoney(data.profit)} icon="✅" />
        <StatCard title="المشتريات" value={fmtMoney(data.purch)} icon="📦" />
        <StatCard title="الصافي (إيراد − مشتريات)" value={fmtMoney(data.net)} icon="📊" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">🏆 الأصناف الأكثر مبيعاً</h3>
        {data.top.length === 0 ? <Empty text="لا توجد بيانات" /> : (
          <div className="space-y-2">
            {data.top.map((x, i) => (
              <div key={x.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <p className="font-bold">#{i + 1} {x.name}</p>
                <p className="text-sm text-gray-500">كمية {x.qty} • {fmtMoney(x.total)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-2 font-bold">ملخص المخزون</h3>
        <p>عدد الأصناف: <b>{products.length}</b> • قيمة المخزون بسعر الشراء: <b>{fmtMoney(products.reduce((a, p) => a + toNum(p.stock) * toNum(p.purchasePrice), 0))}</b></p>
      </div>
    </div>
  );
}
