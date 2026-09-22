"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { toNum, fmtMoney } from "@/lib/utils";
import { Field, inputCls, Empty } from "@/components/ui";
import { BarcodeInput } from "@/components/BarcodeInput";

export default function InventoryPage() {
  const router = useRouter();
  const { ready, userEmail, products, addOrUpdateProduct, deleteProduct } = useApp();
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");
  const [stock, setStock] = useState("");
  const [supplier, setSupplier] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (ready && !userEmail) router.replace("/login");
  }, [ready, userEmail, router]);

  const filtered = useMemo(() => {
    const needle = q.trim();
    if (!needle) return [...products].sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return products.filter(
      (p) => p.name.includes(needle) || (p.barcode ?? "").includes(needle) || (p.supplier ?? "").includes(needle)
    );
  }, [products, q]);

  async function save() {
    if (!name.trim()) { setMsg("أدخل اسم المنتج"); return; }
    try {
      await addOrUpdateProduct({
        name: name.trim(), barcode: barcode.trim() || undefined,
        purchasePrice: toNum(buy), salePrice: toNum(sell),
        stock: Math.floor(toNum(stock)), supplier: supplier.trim() || undefined,
      });
      setMsg("تم حفظ الصنف ✅");
      setName(""); setBarcode(""); setBuy(""); setSell(""); setStock(""); setSupplier("");
    } catch {
      setMsg("تعذر الحفظ");
    }
  }

  if (!ready) return <p className="py-10 text-center">جارٍ التحميل…</p>;
  if (!userEmail) return null;

  const lowStock = products.filter((p) => p.stock <= 3);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black">🏬 المخزون ({products.length})</h2>

      {!!lowStock.length && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          ⚠️ أصناف على وشك النفاد ({lowStock.length}): {lowStock.slice(0, 5).map((p) => p.name).join("، ")}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">إضافة / تعديل صنف</h3>
        <BarcodeInput onDetected={(c) => setBarcode(c)} placeholder="امسح باركود الصنف لتعبئته تلقائياً" />
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <Field label="اسم المنتج"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="الباركود"><input value={barcode} onChange={(e) => setBarcode(e.target.value)} className={inputCls} dir="ltr" /></Field>
          <Field label="المورد"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls} /></Field>
          <Field label="سعر الشراء"><input value={buy} onChange={(e) => setBuy(e.target.value)} className={inputCls} inputMode="decimal" dir="ltr" /></Field>
          <Field label="سعر البيع"><input value={sell} onChange={(e) => setSell(e.target.value)} className={inputCls} inputMode="decimal" dir="ltr" /></Field>
          <Field label="المخزون"><input value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} inputMode="numeric" dir="ltr" /></Field>
        </div>
        {!!msg && <p className="mt-2 text-sm font-bold">{msg}</p>}
        <button onClick={() => void save()} className="mt-3 w-full rounded-lg bg-brand-600 py-2.5 font-bold text-white hover:bg-brand-700">
          حفظ الصنف
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 بحث بالاسم أو الباركود أو المورد" className={inputCls} />
        <div className="mt-3 space-y-2">
          {filtered.length === 0 ? <Empty text="لا توجد أصناف مطابقة" /> : filtered.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="text-xs text-gray-500" dir="ltr">{p.barcode ?? ""} • شراء {fmtMoney(p.purchasePrice)} • بيع {fmtMoney(p.salePrice)} • مخزون {p.stock}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setName(p.name); setBarcode(p.barcode ?? ""); setBuy(String(p.purchasePrice)); setSell(String(p.salePrice)); setStock(String(p.stock)); setSupplier(p.supplier ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="rounded-lg border px-3 py-1 text-sm"
                >
                  تعديل
                </button>
                <button onClick={() => { if (confirm(`حذف ${p.name}؟`)) void deleteProduct(p.id); }} className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600">
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
