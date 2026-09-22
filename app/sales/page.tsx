"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import type { Sale, SaleItem } from "@/lib/types";
import { displayInvoiceNo } from "@/lib/types";
import { uid, nowISO, toNum, fmtMoney, fmtDate, calcSaleLineTotal, calcSaleLineProfit } from "@/lib/utils";
import { Field, inputCls, Empty } from "@/components/ui";
import { BarcodeInput } from "@/components/BarcodeInput";
import { InvoicePrint } from "@/components/InvoicePrint";
import { shareInvoice, openWhatsAppShare, copyInvoiceText, downloadInvoiceImage, canNativeShare, canShareFiles } from "@/lib/invoiceShare";
import { prefetchInvoiceImage } from "@/lib/invoiceImage";

interface DraftRow { key: string; productId?: string; name: string; barcode: string; qty: string; salePrice: string; purchasePrice: number }
interface DraftState { rows: DraftRow[]; discount: string; notes: string; customerName: string; prevBalance: string; paid: string; editingId: string | null }

const DRAFT_KEY = "salesapp_sales_draft";

export default function SalesPage() {
  const router = useRouter();
  const { ready, userEmail, products, findProductByBarcode, addSale, updateSale, deleteSale, sales, customers, addOrUpdateCustomer, settings, doSync } = useApp();
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
  // ——— وضع تعديل فاتورة محفوظة ———
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string>("");
  const editingSale = editingId ? sales.find((s) => s.id === editingId) ?? null : null;

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

  // ——— استعادة مسودة الفاتورة: لا تضيع عند تحديث الصفحة/الإغلاق/انقطاع الكهرباء ———
  const draftReady = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<DraftState> | null;
        const savedRows = Array.isArray(d?.rows)
          ? (d.rows as DraftRow[]).filter((r) => r && typeof r.name === "string")
          : [];
        if (savedRows.length > 0) {
          setRows(savedRows.map((r) => ({ ...r, key: r.key || uid("row") })));
          setDiscount(String(d?.discount ?? "0"));
          setNotes(String(d?.notes ?? ""));
          setCustomerName(String(d?.customerName ?? ""));
          setPrevBalance(String(d?.prevBalance ?? "0"));
          setPaid(String(d?.paid ?? ""));
          setEditingId(typeof d?.editingId === "string" ? d.editingId : null);
          setMsg("تمت استعادة مسودة فاتورة غير محفوظة ✅ — أكمل حفظها الآن");
        }
      }
    } catch { /* مسودة تالفة — نتجاهلها */ } finally {
      draftReady.current = true;
    }
  }, []);

  // ——— حفظ المسودة تلقائياً أثناء الكتابة (Local Auto-save) ———
  useEffect(() => {
    if (!draftReady.current) return;
    const timer = setTimeout(() => {
      try {
        if (rows.length === 0) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
        const d: DraftState = { rows, discount, notes, customerName, prevBalance, paid, editingId };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(timer);
  }, [rows, discount, notes, customerName, prevBalance, paid, editingId]);

  // ——— تحضير صورة الفاتورة مبكراً عند فتح المعاينة، حتى تكون المشاركة فورية ———
  useEffect(() => {
    if (!showPrint || !lastSale) return;
    prefetchInvoiceImage(lastSale, settings.companyName, settings.storePhones);
  }, [showPrint, lastSale, settings.companyName, settings.storePhones]);

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

  function resetForm() {
    setRows([]);
    setDiscount("0");
    setNotes("");
    setCustomerName("");
    setPrevBalance("0");
    setPaid("");
    setEditingId(null);
    setEditingDate("");
  }

  function startEdit(s: Sale) {
    if (editingId !== s.id && rows.length > 0) {
      if (!confirm("لديك أصناف غير محفوظة في المسودة — استبدالها ببنود هذه الفاتورة؟")) return;
    }
    setRows(
      (s.items ?? []).slice(0, 30).map((it) => ({
        key: uid("row"),
        productId: it.productId,
        name: it.name,
        barcode: it.barcode ?? "",
        qty: String(it.qty),
        salePrice: String(it.salePrice),
        purchasePrice: it.purchasePrice ?? 0,
      }))
    );
    setDiscount(String(s.discount ?? 0));
    setNotes(s.notes ?? "");
    setCustomerName(s.customerName ?? "");
    setPrevBalance(String(s.previousBalance ?? 0));
    setPaid(s.paid === undefined || s.paid === null ? "" : String(s.paid));
    setEditingId(s.id);
    setEditingDate(s.date);
    setLastSale(null);
    setShowPrint(false);
    setShareMsg("");
    setMsg(`✏️ وضع التعديل — فاتورة #${displayInvoiceNo(s)}: عدّل الكميات أو الأصناف ثم اضغط «حفظ التعديلات»`);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ }
  }

  function cancelEdit() {
    resetForm();
    setMsg("تم إلغاء التعديل — يمكنك إنشاء فاتورة جديدة");
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ }
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
    const old = editingId ? sales.find((s) => s.id === editingId) ?? null : null;
    const sale: Sale = {
      id: old ? old.id : uid("sal"),
      items: computed.items.map((x): SaleItem => ({
        id: uid("sli"), productId: x.productId, name: x.name.trim(),
        barcode: x.barcode || undefined, qty: x.qty, salePrice: x.sp,
        purchasePrice: x.pp, total: x.total, profit: x.profit,
      })),
      subtotal: computed.subtotal,
      discount: computed.disc,
      netTotal: computed.net,
      profitTotal: computed.profit,
      date: old ? old.date : nowISO(),
      notes: notes.trim() || undefined,
      customerName: customerName.trim() || undefined,
      invoiceNo: old?.invoiceNo ?? nextInvoiceNo,
      previousBalance: prev,
      paid: paidVal,
    };
    try {
      if (old) await updateSale(old, sale);
      else await addSale(sale);
      setLastSale(sale);
      setShowPrint(true);
      setShareMsg("");
      resetForm();
      // مسح المسودة بعد الحفظ المؤكد + دفع الفاتورة للسحابة فوراً (لو متصل)
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      void doSync().catch(() => undefined);
      setMsg(
        old
          ? `تم حفظ تعديلات الفاتورة #${sale.invoiceNo} ✅ — المخزون متوازن تلقائياً`
          : `تم حفظ فاتورة البيع رقم ${nextInvoiceNo} ✅ — محفوظة محلياً ومُرسلة للسحابة، يمكنك طباعتها أو مشاركتها واتساب من الأسفل`
      );
    } catch {
      setMsg("⚠️ تعذر الحفظ — لم تُحفظ أي بيانات (لا توجد فاتورة ناقصة) ، حاول مرة أخرى");
    }
  }

  const sorted = useMemo(() => [...sales].sort((a, b) => (b.date > a.date ? 1 : -1)), [sales]);

  // ——— مشاركة الفاتورة (صورة مطابقة للطباعة أولاً ثم النص المنسق) ———
  const imgOpts = useMemo(() => ({ fontFamily: settings.fontFamily }), [settings.fontFamily]);

  async function onShare() {
    if (!lastSale) return;
    setSharing(true);
    setShareMsg("");
    try {
      const res = await shareInvoice(lastSale, settings.companyName, settings.storePhones, imgOpts);
      if (res === "shared_image") setShareMsg("تمت مشاركة صورة الفاتورة بنفس شكل الطباعة ✅");
      else if (res === "shared") setShareMsg("تمت المشاركة ✅");
      else if (res === "copied") setShareMsg("تم نسخ نص الفاتورة — الصقه في واتساب ✅");
      // تجاهل الإلغاء الصامت (AbortError → "failed" بدون رسالة)
    } catch {
      setShareMsg("تعذرت المشاركة — جرّب النسخ أو الواتساب");
    } finally {
      setSharing(false);
    }
  }

  async function onWhatsApp() {
    if (!lastSale) return;
    setSharing(true);
    setShareMsg("");
    try {
      const res = await openWhatsAppShare(
        lastSale, settings.companyName, customerPhone, settings.storePhones, imgOpts
      );
      if (res === "shared_image") setShareMsg("تمت مشاركة صورة الفاتورة — اختر واتساب من القائمة ✅");
      else if (res === "downloaded") setShareMsg("تم نسخ النص وتنزيل صورة الفاتورة — أرفق الصورة في المحادثة ✅");
      else setShareMsg("تعذر فتح واتساب — استخدم زر النسخ");
    } catch {
      setShareMsg("تعذر فتح واتساب");
    } finally {
      setSharing(false);
    }
  }

  /** صورة الفاتورة PNG بنفس شكل الطباعة — مشاركة إن أمكن وإلا تنزيل */
  async function onImage() {
    if (!lastSale) return;
    setSharing(true);
    setShareMsg("");
    try {
      if (canNativeShare() && canShareFiles()) {
        const res = await shareInvoice(lastSale, settings.companyName, settings.storePhones, imgOpts);
        if (res === "shared_image") setShareMsg("تمت مشاركة صورة الفاتورة ✅");
        else if (res === "failed") return; // إلغاء صامت
      }
      const ok = await downloadInvoiceImage(lastSale, settings.companyName, settings.storePhones, imgOpts);
      if (ok) setShareMsg((prev) => prev || "تم تنزيل صورة الفاتورة (بنفس شكل الطباعة) ✅");
      else setShareMsg("تعذر إنشاء صورة الفاتورة — استخدم الطباعة");
    } catch {
      setShareMsg("تعذر إنشاء صورة الفاتورة");
    } finally {
      setSharing(false);
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
      <h2 className="text-xl font-black">
        {editingId ? `✏️ تعديل فاتورة #${editingSale?.invoiceNo ?? displayInvoiceNo(editingSale)}` : "🧾 المبيعات — فاتورة جديدة"}
      </h2>
      {editingId && (
        <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <span>أنت تعدّل الفاتورة #{editingSale?.invoiceNo ?? ""} — رقمها وتاريخها محفوظان، والمخزون سيُسوّى تلقائياً عند الحفظ.</span>
          <button onClick={cancelEdit} className="mr-auto rounded-lg border border-amber-400 px-3 py-1 text-xs font-black hover:bg-amber-100 dark:hover:bg-amber-900">
            ✖ إلغاء التعديل
          </button>
        </div>
      )}

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
          <button onClick={addManual} className="shrink-0 rounded-lg bg-gradient-to-b from-teal-600 to-teal-800 px-5 py-2 text-sm font-black text-white shadow-[0_3px_0_rgba(19,78,74,1)] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none">
            ＋ إضافة
          </button>
        </div>
        <datalist id="all-products">
          {products.map((p) => <option key={p.id} value={p.name}>{`${p.salePrice} ج — مخزون ${p.stock}`}</option>)}
        </datalist>
        {!!msg && <p className="mt-2 text-sm font-bold">{msg}</p>}
      </div>

      <div className="no-print rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-2 font-bold">🧾 الأصناف ({computed.items.length} / 30)</h3>
        {computed.items.length === 0 ? <Empty text="امسح باركود أو أضف صنفاً يدوياً — وستتراص الأصناف هنا في جدول منظم ✨" /> : (
          <div className="overflow-x-auto rounded-xl border-2 border-teal-800/70 shadow-[0_4px_0_rgba(19,78,74,0.9),0_10px_20px_-8px_rgba(15,118,110,0.5)]">
            <table className="w-full min-w-[760px] border-collapse text-sm" aria-label="أصناف الفاتورة الحالية">
              <thead>
                <tr className="bg-gradient-to-b from-teal-700 to-teal-800 text-white">
                  <th className="border border-teal-900/60 px-2 py-2 text-center text-xs font-black" style={{ width: "44px" }}>م</th>
                  <th className="border border-teal-900/60 px-2 py-2 text-right text-xs font-black">🛒 الصنف / المنتج</th>
                  <th className="border border-teal-900/60 px-2 py-2 text-center text-xs font-black" style={{ width: "168px" }}>العدد / الكمية</th>
                  <th className="border border-teal-900/60 px-2 py-2 text-center text-xs font-black" style={{ width: "130px" }}>السعر</th>
                  <th className="border border-teal-900/60 px-2 py-2 text-center text-xs font-black" style={{ width: "120px" }}>الإجمالي</th>
                  <th className="border border-teal-900/60 px-2 py-2 text-center text-xs font-black" style={{ width: "52px" }}>🗑</th>
                </tr>
              </thead>
              <tbody>
                {computed.items.map((r, i) => (
                  <tr key={r.key} className={`${i % 2 === 1 ? "bg-teal-50/70" : "bg-white"} transition-colors hover:bg-amber-50 dark:bg-gray-800`}>
                    <td className="border border-slate-200 px-1 py-1.5 text-center dark:border-gray-700">
                      <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gradient-to-b from-teal-600 to-teal-800 px-1.5 text-[11px] font-black text-white">
                        {i + 1}
                      </span>
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 text-right dark:border-gray-700">
                      <p className="font-bold">{r.name}</p>
                      {!!r.barcode && <p className="text-xs text-gray-500" dir="ltr">{r.barcode}</p>}
                    </td>
                    <td className="border border-slate-200 px-1.5 py-1.5 dark:border-gray-700">
                      <div className="flex items-center justify-center gap-1" dir="ltr">
                        <button
                          type="button"
                          aria-label={`إنقاص كمية ${r.name}`}
                          onClick={() => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, qty: String(Math.max(0, Math.floor(toNum(x.qty)) - 1)) } : x)))}
                          className="h-8 w-8 shrink-0 rounded-lg border border-slate-300 bg-white text-lg font-black leading-none text-teal-800 shadow-sm transition hover:bg-teal-50 active:translate-y-px dark:border-gray-600 dark:bg-gray-700 dark:text-teal-200"
                        >
                          −
                        </button>
                        <input
                          value={rows.find((x) => x.key === r.key)?.qty ?? ""}
                          onChange={(e) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))}
                          className={`${inputCls} w-14 shrink-0 px-1 py-1.5 text-center font-black`} inputMode="numeric" dir="ltr"
                          aria-label={`كمية ${r.name}`}
                        />
                        <button
                          type="button"
                          aria-label={`زيادة كمية ${r.name}`}
                          onClick={() => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, qty: String(Math.floor(toNum(x.qty)) + 1) } : x)))}
                          className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-b from-teal-600 to-teal-800 text-lg font-black leading-none text-white shadow-[0_2px_0_rgba(19,78,74,1)] transition hover:brightness-110 active:translate-y-px active:shadow-none"
                        >
                          ＋
                        </button>
                      </div>
                    </td>
                    <td className="border border-slate-200 px-1.5 py-1.5 dark:border-gray-700">
                      <input
                        value={rows.find((x) => x.key === r.key)?.salePrice ?? ""}
                        onChange={(e) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, salePrice: e.target.value } : x)))}
                        className={`${inputCls} w-full py-1.5 text-center`} inputMode="decimal" dir="ltr"
                        aria-label={`سعر ${r.name}`}
                      />
                    </td>
                    <td className="border border-slate-200 bg-emerald-50/60 px-2 py-1.5 text-center font-black text-emerald-800 dark:border-gray-700 dark:bg-gray-800 dark:text-emerald-300">
                      {fmtMoney(r.total)}
                    </td>
                    <td className="border border-slate-200 px-1 py-1.5 text-center dark:border-gray-700">
                      <button onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50" aria-label={`حذف ${r.name}`}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <Field label={editingId ? "رقم الفاتورة (محفوظ كما هو)" : "رقم الفاتورة (تلقائي)"}>
            <input value={editingSale?.invoiceNo ?? nextInvoiceNo} readOnly className={`${inputCls} bg-gray-50 font-black dark:bg-gray-800`} dir="ltr" />
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
                void addOrUpdateCustomer({ name: nm, balance: liveTotals.current })
                  .then(() => setMsg(`تم تحديث حساب ${nm} ✅`))
                  .catch(() => setMsg("⚠️ تعذر حفظ حساب العميل — حاول مجدداً"));
              }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              💾 حفظ/تحديث حساب العميل
            </button>
          </div>
        </div>

        <button
          onClick={() => void save()}
          className="mt-3 w-full rounded-xl bg-gradient-to-b from-teal-600 to-teal-800 py-3 text-base font-black text-white shadow-[0_4px_0_rgba(19,78,74,1)] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none"
        >
          {editingId ? "💾 حفظ التعديلات" : "🧾 حفظ الفاتورة"}
        </button>
        {editingId && (
          <button
            onClick={cancelEdit}
            className="mt-2 w-full rounded-xl border-2 border-slate-300 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            ✖ إلغاء التعديل والعودة لفاتورة جديدة
          </button>
        )}
      </div>

      {!!lastSale && (
        <div id="invoice-preview" className="scroll-mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
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
              title={canNativeShare() ? "مشاركة صورة الفاتورة (بنفس شكل الطباعة) عبر تطبيقات الجهاز" : "نسخ نص الفاتورة للمشاركة"}
            >
              {sharing ? "جارٍ…" : "📤 مشاركة"}
            </button>
            <button
              onClick={() => void onWhatsApp()}
              disabled={sharing}
              className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50"
              title="إرسال الفاتورة صورة + نص على واتساب بنفس شكل الطباعة"
            >
              💬 واتساب
            </button>
            <button
              onClick={() => void onImage()}
              disabled={sharing}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50"
              title="حفظ صورة الفاتورة PNG بنفس شكل الطباعة"
            >
              🖼 صورة الفاتورة
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
        <h3 className="mb-3 font-bold">🧾 سجل الفواتير المحفوظة ({sorted.length})</h3>
        {sorted.length === 0 ? <Empty text="لا توجد مبيعات بعد" /> : (
          <div className="space-y-2">
            {sorted.slice(0, 20).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                <div>
                  <p className="font-bold">
                    {s.invoiceNo ? `#${s.invoiceNo} • ` : ""}{s.customerName ? `${s.customerName} • ` : ""}{fmtMoney(s.netTotal)}
                  </p>
                  <p className="text-xs text-gray-500">{fmtDate(s.date)} • {(s.items ?? []).length} أصناف</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setLastSale(s);
                      setShowPrint(true);
                      setShareMsg("");
                      setTimeout(() => {
                        try { document.getElementById("invoice-preview")?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* ignore */ }
                      }, 60);
                    }}
                    className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700 transition hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300"
                  >
                    👁 عرض
                  </button>
                  <button
                    onClick={() => startEdit(s)}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm(`حذف الفاتورة #${displayInvoiceNo(s)}؟ سيُرجَع مخزون أصنافها تلقائياً.`)) return;
                      if (editingId === s.id) resetForm();
                      if (lastSale?.id === s.id) { setLastSale(null); setShowPrint(false); }
                      void deleteSale(s.id)
                        .then(() => setMsg("تم حذف الفاتورة وإرجاع أصنافها للمخزون ✅"))
                        .catch(() => setMsg("⚠️ تعذر حذف الفاتورة — حاول مجدداً"));
                    }}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  >
                    🗑 حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
