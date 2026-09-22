"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import type { Purchase, PurchaseItem } from "@/lib/types";
import { uid, nowISO, toNum, fmtMoney, fmtDate, calcPurchaseLineTotal } from "@/lib/utils";
import { Field, inputCls, Empty } from "@/components/ui";

interface DraftLine { name: string; qty: string; price: string; discount: string; salePrice: string; barcode: string }

const blankLine = (): DraftLine => ({ name: "", qty: "1", price: "", discount: "0", salePrice: "", barcode: "" });

export default function PurchasesPage() {
  const router = useRouter();
  const { ready, userEmail, purchases, addPurchase, updatePurchase, deletePurchase, products } = useApp();
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (ready && !userEmail) router.replace("/login");
  }, [ready, userEmail, router]);

  const suppliers = useMemo(() => {
    const s = new Set<string>();
    purchases.forEach((p) => { if (p.supplier) s.add(p.supplier); });
    products.forEach((p) => { if (p.supplier) s.add(p.supplier); });
    return [...s];
  }, [purchases, products]);

  const computed = useMemo(() => {
    const rows = lines.map((l) => {
      const qty = toNum(l.qty);
      const price = toNum(l.price);
      const disc = toNum(l.discount);
      return { ...l, qty, price, disc, total: calcPurchaseLineTotal(qty, price, disc) };
    });
    const subtotal = rows.reduce((a, r) => a + r.qty * r.price, 0);
    const discTotal = rows.reduce((a, r) => a + Math.min(r.disc, r.qty * r.price), 0);
    return { rows, subtotal, discTotal, grand: Math.max(0, subtotal - discTotal) };
  }, [lines]);

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    // تعبئة تلقائية لسعر البيع المقترح عند إدخال سعر الشراء
    if (patch.price !== undefined) {
      const pr = toNum(patch.price);
      setLines((prev) => prev.map((l, idx) => {
        if (idx !== i) return l;
        if (l.salePrice.trim() === "" && pr > 0) return { ...l, salePrice: String(Math.round(pr * 1.2 * 100) / 100) };
        return l;
      }));
    }
  }

  function editExisting(p: Purchase) {
    setEditingId(p.id);
    setSupplier(p.supplier);
    setNotes(p.notes ?? "");
    setLines(p.items.map((it) => ({
      name: it.productName, qty: String(it.qty), price: String(it.purchasePrice),
      discount: String(it.discount), salePrice: String(it.salePrice), barcode: it.barcode ?? "",
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditingId(null); setSupplier(""); setNotes(""); setLines([blankLine()]); setMsg("");
  }

  async function save() {
    setMsg("");
    if (!supplier.trim()) { setMsg("أدخل اسم المورد أو الشركة"); return; }
    const valid = computed.rows.filter((r) => r.name.trim() && r.qty > 0 && r.price >= 0);
    if (valid.length === 0) { setMsg("أضف صنفاً واحداً على الأقل بكمية وسعر صحيحين"); return; }
    const items: PurchaseItem[] = valid.map((r) => ({
      id: uid("pli"),
      productName: r.name.trim(),
      barcode: r.barcode.trim() || undefined,
      qty: r.qty,
      purchasePrice: r.price,
      discount: Math.min(r.disc, r.qty * r.price),
      salePrice: toNum(r.salePrice || r.price),
      total: r.total,
    }));
    const payload: Purchase = {
      id: editingId ?? uid("pur"),
      supplier: supplier.trim(),
      items,
      subtotal: computed.subtotal,
      discountTotal: computed.discTotal,
      grandTotal: computed.grand,
      date: nowISO(),
      notes: notes.trim() || undefined,
    };
    try {
      if (editingId) await updatePurchase(payload);
      else await addPurchase(payload);
      setMsg(editingId ? "تم تعديل الفاتورة بنجاح ✅" : "تم حفظ فاتورة المشتريات ✅");
      setTimeout(reset, 800);
    } catch {
      setMsg("تعذر الحفظ — حاول مجدداً");
    }
  }

  const sorted = useMemo(
    () => [...purchases].sort((a, b) => (b.date > a.date ? 1 : -1)),
    [purchases]
  );

  if (!ready) return <p className="py-10 text-center">جارٍ التحميل…</p>;
  if (!userEmail) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black">📦 المشتريات</h2>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">{editingId ? "تعديل فاتورة مشتريات" : "فاتورة مشتريات جديدة"}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="اسم المورد / الشركة">
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} list="suppliers" className={inputCls} placeholder="مثال: شركة النور" />
            <datalist id="suppliers">
              {suppliers.map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>
          <Field label="ملاحظات">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="اختياري" />
          </Field>
        </div>

        <div className="mt-4 space-y-3">
          {lines.map((l, i) => {
            const c = computed.rows[i];
            return (
              <div key={i} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                <div className="grid gap-2 md:grid-cols-6">
                  <Field label="المنتج">
                    <input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} className={inputCls} placeholder="اسم المنتج" list="products-list" />
                  </Field>
                  <Field label="الكمية">
                    <input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className={inputCls} inputMode="decimal" dir="ltr" />
                  </Field>
                  <Field label="سعر الشراء">
                    <input value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} className={inputCls} inputMode="decimal" dir="ltr" />
                  </Field>
                  <Field label="الخصم">
                    <input value={l.discount} onChange={(e) => setLine(i, { discount: e.target.value })} className={inputCls} inputMode="decimal" dir="ltr" />
                  </Field>
                  <Field label="سعر البيع للجمهور">
                    <input value={l.salePrice} onChange={(e) => setLine(i, { salePrice: e.target.value })} className={inputCls} inputMode="decimal" dir="ltr" />
                  </Field>
                  <Field label="باركود (اختياري)">
                    <input value={l.barcode} onChange={(e) => setLine(i, { barcode: e.target.value })} className={inputCls} dir="ltr" />
                  </Field>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-green-700 dark:text-green-300">الإجمالي بعد الخصم: {fmtMoney(c?.total ?? 0)}</span>
                  <button
                    onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((_, x) => x !== i) : [blankLine()]))}
                    className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    🗑 حذف السطر
                  </button>
                </div>
              </div>
            );
          })}
          <datalist id="products-list">
            {products.map((p) => <option key={p.id} value={p.name} />)}
          </datalist>
        </div>

        <button onClick={() => setLines((p) => [...p, blankLine()])} className="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
          ➕ إضافة صنف
        </button>

        <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm dark:bg-green-950">
          <div className="flex justify-between"><span>المجموع قبل الخصم:</span><b>{fmtMoney(computed.subtotal)}</b></div>
          <div className="flex justify-between"><span>إجمالي الخصم:</span><b>{fmtMoney(computed.discTotal)}</b></div>
          <div className="flex justify-between text-lg"><span>الإجمالي بعد الخصم:</span><b>{fmtMoney(computed.grand)}</b></div>
        </div>

        {!!msg && <p className="mt-2 text-sm font-bold">{msg}</p>}
        <div className="mt-3 flex gap-2">
          <button onClick={() => void save()} className="flex-1 rounded-lg bg-green-600 py-2.5 font-bold text-white hover:bg-green-700">
            {editingId ? "حفظ التعديل" : "حفظ الفاتورة"}
          </button>
          {!!editingId && <button onClick={reset} className="rounded-lg border px-4 py-2.5">إلغاء</button>}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">سجل فواتير المشتريات ({sorted.length})</h3>
        {sorted.length === 0 ? <Empty text="لا توجد فواتير بعد" /> : (
          <div className="space-y-2">
            {sorted.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <div>
                  <p className="font-bold">{p.supplier} — {fmtMoney(p.grandTotal)}</p>
                  <p className="text-xs text-gray-500">{fmtDate(p.date)} • {(p.items ?? []).length} أصناف</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editExisting(p)} className="rounded-lg border px-3 py-1 text-sm">تعديل</button>
                  <button onClick={() => { if (confirm("حذف هذه الفاتورة؟")) void deletePurchase(p.id); }} className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600">حذف</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
