"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import type { Sale, SaleItem } from "@/lib/types";
import { uid, nowISO, toNum, fmtMoney, fmtDate, calcSaleLineTotal, calcSaleLineProfit } from "@/lib/utils";
import { Field, inputCls, Empty } from "@/components/ui";
import { BarcodeInput } from "@/components/BarcodeInput";
import { InvoicePrint } from "@/components/InvoicePrint";
import { shareInvoice, openWhatsAppShare, copyInvoiceText, canNativeShare } from "@/lib/invoiceShare";

interface DraftRow { key: string; productId?: string; name: string; barcode: string; qty: string; salePrice: string; purchasePrice: number }

export default function SalesPage() {
  const router = useRouter();
  const { ready, userEmail, products, findProductByBarcode, addSale, deleteSale, sales, customers, addOrUpdateCustomer, settings } = useApp();
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [manualName, setManualName] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [sharing, setSharing] = useState(false);
  // ——— بيانات الفاتورة الكلاسيكية (حسابات العملاء) ———
  const [customerName, setCustomerName] = useState("");
  const [prevBalance, setPrevBalance] = useState("0");
  const [paid, setPaid] = useState("");

  // رقم الفاتورة التالي (متسلسل تلقائياً من أعلى رقم محفوظ)
  const nextInvoiceNo = useMemo(() => {
    let max = 0;
    for (const s of sales) {
      const n = parseInt(String(s.invoiceNo ?? "").replace(/[^\d]/g, ""), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return String(max + 1);
  }, [sales]);

  useEffect(() => {
    if (ready && !userEmail) router.replace("/login");
  }, [ready, userEmail, router]);

  function addRowFromProduct(name: string, salePrice: number, purchasePrice: number, productId?: string, barcode?: string, qty = 1) {
    setRows((prev) => {
      if (prev.length >= 30) return prev;
      const existing = prev.find((r) => (productId && r.productId === productId) || (barcode && r.barcode === barcode && barcode !== "") || (r.name === name && !productId));
      if (existing) {
        return prev.map((r) => (r.key === existing.key ? { ...r, qty: String(toNum(r.qty) + qty) } : r));
      }
      return [...prev, { key: uid("row"), productId, name, barcode: barcode ?? "", qty: String(qty), salePrice: String(salePrice), purchasePrice }];
    });
  }

  function onBarcode(code: string) {
    const p = findProductByBarcode(code);
    if (p) {
      addRowFromProduct(p.name, p.salePrice, p.purchasePrice, p.id, p.barcode ?? code);
      setMsg("");
    } else {
      setMsg(`لا يوجد صنف بالباركود ${code} — أضفه يدوياً أو من المشتريات`);
    }
  }

  function addManual() {
    const name = manualName.trim();
    if (!name) return;
    const match = products.find((p) => p.name === name);
    if (match) addRowFromProduct(match.name, match.salePrice, match.purchasePrice, match.id, match.barcode);
    else addRowFromProduct(name, 0, 0);
    setManualName("");
  }

  const computed = useMemo(() => {
    const items = rows.map((r) => {
      const qty = Math.max(0, Math.floor(toNum(r.qty)));
      const sp = Math.max(0, toNum(r.salePrice));
      const pp = Math.max(0, toNum(r.purchasePrice));
      return { ...r, qty, sp, pp, total: calcSaleLineTotal(qty, sp), profit: calcSaleLineProfit(qty, sp, pp) };
    });
    const subtotal = items.reduce((a, x) => a + x.total, 0);
    const disc = Math.min(Math.max(0, toNum(discount)), subtotal);
    return { items, subtotal, disc, net: Math.max(0, subtotal - disc), profit: items.reduce((a, x) => a + x.profit, 0) };
  }, [rows, discount]);

  // معاينة حية للإجمالي العام والحالي أثناء التحرير
  const liveTotals = useMemo(() => {
    const prev = Math.max(0, toNum(prevBalance));
    const net = Math.max(0, computed.net);
    const grand = prev + net;
    const paidVal = paid.trim() === "" ? grand : Math.min(Math.max(0, toNum(paid)), grand);
    return { prev, net, grand, paidVal, current: Math.max(0, grand - paidVal) };
  }, [prevBalance, paid, computed.net]);

  async function save() {
    setMsg("");
    if (computed.items.length === 0) { setMsg("أضف صنفاً واحداً على الأقل"); return; }
    if (computed.items.length > 30) { setMsg("الحد الأقصى 30 صنفاً في الفاتورة"); return; }
    const bad = computed.items.find((x) => !x.name.trim() || x.qty <= 0);
    if (bad) { setMsg("راجع الأصناف: الاسم والكمية مطلوبان"); return; }
    const prev = Math.max(0, toNum(prevBalance));
    const grand = prev + computed.net;
    const paidVal = paid.trim() === "" ? grand : Math.min(Math.max(0, toNum(paid)), grand);
    const sale: Sale = {
      id: uid("sal"),
      items: computed.items.map((x): SaleItem => ({
        id: uid("sli"), productId: x.productId, name: x.name.trim(),
        barcode: x.barcode || undefined, qty: x.qty, salePrice: x.sp,
        purchasePrice: x.pp, total: x.total, profit: x.profit,
      })),
      subtotal: computed.subtotal,
      discount: computed.disc,
      netTotal: computed.net,
      profitTotal: computed.profit,
      date: nowISO(),
      notes: notes.trim() || undefined,
      customerName: customerName.trim() || undefined,
      invoiceNo: nextInvoiceNo,
      previousBalance: prev,
      paid: paidVal,
    };
    try {
      await addSale(sale);
      setLastSale(sale);
      setShowPrint(true);
      setShareMsg("");
      setRows([]);
      setDiscount("0");
      setNotes("");
      setCustomerName("");
      setPrevBalance("0");
      setPaid("");
      setMsg(`تم حفظ فاتورة البيع رقم ${nextInvoiceNo} ✅ — يمكنك طباعتها أو مشاركتها واتساب من الأسفل`);
    } catch {
      setMsg("تعذر الحفظ — حاول مجدداً");
    }
  }

  const sorted = useMemo(() => [...sales].sort((a, b) => (b.date > a.date ? 1 : -1)), [sales]);

  // ——— مشاركة الفاتورة ———
  async function onShare() {
    if (!lastSale) return;
    setSharing(true);
    setShareMsg("");
    try {
      const res = await shareInvoice(lastSale, settings.companyName, settings.storePhones);
      if (res === "shared") setShareMsg("تمت المشاركة بنجاح ✅");
      else if (res === "copied") setShareMsg("تم نسخ نص الفاتورة — الصقه في واتساب ✅");
      // تجاهل الإلغاء الصامت (AbortError → "failed" بدون رسالة)
    } catch {
      setShareMsg("تعذرت المشاركة — جرّب النسخ أو الواتساب");
    } finally {
      setSharing(false);
    }
  }

  function onWhatsApp() {
    if (!lastSale) return;
    setShareMsg("");
    try {
      openWhatsAppShare(lastSale, settings.companyName, customerPhone, settings.storePhones);
    } catch {
      setShareMsg("تعذر فتح واتساب");
    }
  }

  async function onCopy() {
    if (!lastSale) return;
    setShareMsg("");
    try {
      const ok = await copyInvoiceText(lastSale, settings.companyName, settings.storePhones);
      setShareMsg(ok ? "تم نسخ الفاتورة ✅" : "تعذر النسخ");
    } catch {
      setShareMsg("تعذر النسخ");
    }
  }

  if (!ready) return <p className="py-10 text-center">جارٍ التحميل…</p>;
  if (!userEmail) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black">🧾 المبيعات — فاتورة جديدة</h2>

      <div className="no-print rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <BarcodeInput onDetected={onBarcode} />
        <div className="mt-2 flex gap-2">
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }}
            list="all-products"
            placeholder="اختيار يدوي: اكتب اسم الصنف ثم Enter"
            className={inputCls}
          />
          <button onClick={addManual} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white dark:bg-gray-700">
            إضافة
          </button>
        </div>
        <datalist id="all-products">
          {products.map((p) => <option key={p.id} value={p.name}>{`${p.salePrice} ج — مخزون ${p.stock}`}</option>)}
        </datalist>
        {!!msg && <p className="mt-2 text-sm font-bold">{msg}</p>}
      </div>

      <div className="no-print rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-2 font-bold">الأصناف ({computed.items.length} / 30)</h3>
        {computed.items.length === 0 ? <Empty text="امسح باركود أو أضف صنفاً يدوياً" /> : (
          <div className="space-y-2">
            {computed.items.map((r) => (
              <div key={r.key} className="grid gap-2 rounded-xl bg-gray-50 p-2 dark:bg-gray-800 md:grid-cols-5">
                <div className="md:col-span-2">
                  <p className="font-bold">{r.name}</p>
                  {!!r.barcode && <p className="text-xs text-gray-500" dir="ltr">{r.barcode}</p>}
                </div>
                <Field label="الكمية">
                  <input
                    value={rows.find((x) => x.key === r.key)?.qty ?? ""}
                    onChange={(e) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))}
                    className={inputCls} inputMode="numeric" dir="ltr"
                  />
                </Field>
                <Field label="سعر الجمهور">
                  <input
                    value={rows.find((x) => x.key === r.key)?.salePrice ?? ""}
                    onChange={(e) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, salePrice: e.target.value } : x)))}
                    className={inputCls} inputMode="decimal" dir="ltr"
                  />
                </Field>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-sm font-bold">{fmtMoney(r.total)}</p>
                  <button onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="text-red-600">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <Field label="خصم الفاتورة">
            <input value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls} inputMode="decimal" dir="ltr" />
          </Field>
          <Field label="ملاحظات">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </Field>
          <div className="rounded-xl bg-brand-50 p-3 text-sm dark:bg-brand-950">
            <div className="flex justify-between"><span>الإجمالي:</span><b>{fmtMoney(computed.subtotal)}</b></div>
            <div className="flex justify-between"><span>الخصم:</span><b>{fmtMoney(computed.disc)}</b></div>
            <div className="flex justify-between text-lg"><span>الصافي (بسعر الجمهور):</span><b>{fmtMoney(computed.net)}</b></div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <Field label={`رقم الفاتورة (تلقائي)`}>
            <input value={nextInvoiceNo} readOnly className={`${inputCls} bg-gray-50 font-black dark:bg-gray-800`} dir="ltr" />
          </Field>
          <Field label="اسم العميل">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputCls}
              placeholder="اسم العميل (اختياري)"
              list="all-customers"
            />
          </Field>
          <Field label="الحساب السابق (عليكم)">
            <input value={prevBalance} onChange={(e) => setPrevBalance(e.target.value)} className={inputCls} inputMode="decimal" dir="ltr" placeholder="0" />
          </Field>
        </div>
        <datalist id="all-customers">
          {customers.map((c) => <option key={c.id} value={c.name}>{c.phone ? `${c.phone} — رصيد ${c.balance}` : `رصيد ${c.balance}`}</option>)}
        </datalist>

        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <Field label="المدفوع (فارغ = سداد كامل)">
            <input value={paid} onChange={(e) => setPaid(e.target.value)} className={inputCls} inputMode="decimal" dir="ltr" placeholder="سداد كامل" />
          </Field>
          <div className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-gray-800">
            <div className="flex justify-between"><span>الاجمالي العام (السابق + الفاتورة):</span><b>{fmtMoney(liveTotals.grand)}</b></div>
            <div className="flex justify-between"><span>المدفوع:</span><b>{fmtMoney(liveTotals.paidVal)}</b></div>
            <div className="flex justify-between font-black"><span>الحساب الحالي (عليكم):</span><b>{fmtMoney(liveTotals.current)}</b></div>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                const nm = customerName.trim();
                if (!nm) { setMsg("أدخل اسم العميل أولاً لحفظه في الحسابات"); return; }
                void addOrUpdateCustomer({ name: nm, balance: liveTotals.current }).then(() => setMsg(`تم تحديث حساب ${nm} ✅`));
              }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              💾 حفظ/تحديث حساب العميل
            </button>
          </div>
        </div>

        <button onClick={() => void save()} className="mt-3 w-full rounded-lg bg-brand-600 py-2.5 font-bold text-white hover:bg-brand-700">
          حفظ الفاتورة
        </button>
      </div>

      {!!lastSale && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="no-print mb-3 flex flex-wrap gap-2">
            <button onClick={() => setShowPrint((v) => !v)} className="rounded-lg border px-4 py-2 text-sm">
              {showPrint ? "إخفاء المعاينة" : "معاينة الفاتورة"}
            </button>
            <button onClick={() => window.print()} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white dark:bg-gray-700">
              🖨️ طباعة
            </button>
            <button
              onClick={() => void onShare()}
              disabled={sharing}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              title={canNativeShare() ? "مشاركة عبر تطبيقات الجهاز" : "نسخ نص الفاتورة للمشاركة"}
            >
              {sharing ? "جارٍ…" : "📤 مشاركة"}
            </button>
            <button
              onClick={onWhatsApp}
              className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-white hover:brightness-95"
              title="إرسال الفاتورة واتساب"
            >
              💬 واتساب
            </button>
            <button onClick={() => void onCopy()} className="rounded-lg border px-4 py-2 text-sm">
              📋 نسخ
            </button>
          </div>
          <div className="no-print mb-3 flex flex-col gap-1 sm:flex-row sm:items-center">
            <label className="text-xs font-semibold text-gray-500">
              رقم واتساب العميل (اختياري — بدون +، مثال 2010xxxxxxxx):
            </label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="2010xxxxxxxx"
              inputMode="tel"
              dir="ltr"
              className={`${inputCls} sm:max-w-[200px]`}
            />
          </div>
          {!!shareMsg && <p className="no-print mb-2 text-sm font-bold text-brand-700 dark:text-brand-300">{shareMsg}</p>}
          {showPrint && <InvoicePrint sale={lastSale} companyName={settings.companyName} storePhones={settings.storePhones} />}
        </div>
      )}

      <div className="no-print rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">سجل المبيعات ({sorted.length})</h3>
        {sorted.length === 0 ? <Empty text="لا توجد مبيعات بعد" /> : (
          <div className="space-y-2">
            {sorted.slice(0, 20).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <div>
                  <p className="font-bold">
                    {s.invoiceNo ? `#${s.invoiceNo} • ` : ""}{s.customerName ? `${s.customerName} • ` : ""}{fmtMoney(s.netTotal)}
                  </p>
                  <p className="text-xs text-gray-500">{fmtDate(s.date)} • {(s.items ?? []).length} أصناف</p>
                </div>
                <button onClick={() => { if (confirm("حذف الفاتورة؟")) void deleteSale(s.id); }} className="text-sm text-red-600">حذف</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
