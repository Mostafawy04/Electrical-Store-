"use client";
import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { DEFAULT_STORE_PHONES, calcInvoiceTotals, displayInvoiceNo } from "@/lib/types";
import { fmtMoney, fmtDate, toNum } from "@/lib/utils";
import { getRandomDhikr } from "@/lib/i18n";

interface Props {
  sale: Sale;
  companyName: string;
  storePhones?: string;
}

/**
 * الفاتورة الكلاسيكية الاحترافية (مطابقة للفواتير الورقية الرسمية):
 * — رأس: اسم العميل / رقم الفاتورة / التاريخ
 * — جدول الأصناف (يمين→يسار): م / الصنف / الكمية / السعر / الإجمالي
 * — نهاية الجدول: إجمالي كمية الأصناف
 * — الإجماليات: الحساب السابق / اجمالي الفاتورة / الاجمالي العام / المدفوع / الحساب الحالي
 * — أسفلها اسم المؤسسة وأرقام التواصل — نظيف وجاهز للطباعة والمشاركة
 */
export function InvoicePrint({ sale, companyName, storePhones }: Props) {
  const items = sale?.items ?? [];
  const phones = (storePhones ?? "").trim() || DEFAULT_STORE_PHONES;
  const name = (companyName ?? "").trim() || "مؤسسة الجبالي للأدوات الكهربائية";
  const customer = (sale?.customerName ?? "").trim() || "عميل نقدي";

  const footerDhikr = useMemo(() => {
    try {
      return getRandomDhikr().text;
    } catch {
      return "صلي على النبي ﷺ";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.id]);

  const t = calcInvoiceTotals({
    items,
    subtotal: sale?.subtotal,
    discount: sale?.discount,
    netTotal: sale?.netTotal,
    previousBalance: sale?.previousBalance,
    paid: sale?.paid,
  });

  const discountVal = Math.max(0, toNum(sale?.discount));

  const cell = "border border-neutral-400 px-2 py-1.5";

  return (
    <div id="print-area" className="print-doc" dir="rtl">
      <style>{`
        @keyframes inv-row-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .inv-row-anim { animation: inv-row-in 0.3s ease both; }
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          .inv-classic {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          .inv-row-anim { animation: none !important; }
          @page { size: auto; margin: 5mm; }
        }
      `}</style>

      <div className="inv-classic mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border-2 border-neutral-800 bg-white text-neutral-900 shadow-[0_16px_40px_-14px_rgba(15,23,42,0.4)]">
        {/* ===== رأس الفاتورة: اسم المؤسسة ===== */}
        <div className="bg-gradient-to-b from-slate-800 to-slate-900 px-4 pb-3 pt-4 text-center text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.18),inset_0_-3px_8px_rgba(0,0,0,0.35)]">
          <p className="mb-1 inline-block rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            🧾 فاتورة بيع رسمية
          </p>
          <h2 className="text-2xl font-black leading-tight drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]">{name}</h2>
          <p className="mt-0.5 text-xs font-semibold text-slate-300">للأدوات الكهربائية — بيع بالتجزئة والجملة</p>
          <p className="mx-auto mt-2 inline-block rounded-full bg-white px-4 py-1 text-sm font-black text-slate-900 shadow-[0_3px_0_rgba(0,0,0,0.3)]" dir="ltr">
            📞 {phones}
          </p>
        </div>

        <div className="border-t-4 border-double border-neutral-800" />

        {/* ===== بيانات الفاتورة: العميل / الرقم / التاريخ ===== */}
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td className={`${cell} w-[44%] bg-teal-50`}>
                <span className="text-[11px] text-teal-700">اسم العميل: </span>
                <span className="font-black">{customer}</span>
              </td>
              <td className={`${cell} w-[28%] bg-amber-50 text-center`}>
                <span className="text-[11px] text-amber-700">رقم الفاتورة: </span>
                <span className="font-black text-amber-800" dir="ltr">#{displayInvoiceNo(sale)}</span>
              </td>
              <td className={`${cell} w-[28%] bg-sky-50 text-center`}>
                <span className="text-[11px] text-sky-700">التاريخ: </span>
                <span className="font-bold">{fmtDate(sale?.date)}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ===== جدول الأصناف (Excel Table Style) ===== */}
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }} aria-label="أصناف الفاتورة">
          <colgroup>
            <col style={{ width: "40px" }} />
            <col />
            <col style={{ width: "70px" }} />
            <col style={{ width: "96px" }} />
            <col style={{ width: "104px" }} />
          </colgroup>
          <thead>
            <tr className="bg-gradient-to-b from-teal-700 to-teal-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
              <th className={`${cell} text-center text-xs font-black`}>م</th>
              <th className={`${cell} text-right text-xs font-black`}>الصنف</th>
              <th className={`${cell} text-center text-xs font-black`}>الكمية</th>
              <th className={`${cell} text-center text-xs font-black`}>السعر</th>
              <th className={`${cell} text-center text-xs font-black`}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className={`${cell} py-4 text-center text-xs text-neutral-400`}>
                  لا توجد أصناف في هذه الفاتورة
                </td>
              </tr>
            )}
            {items.map((it, i) => (
              <tr
                key={it?.id ?? i}
                className={`inv-row-anim ${i % 2 === 1 ? "bg-neutral-100" : "bg-white"} hover:bg-amber-50`}
                style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}
              >
                <td className={`${cell} text-center font-bold text-teal-700`}>{i + 1}</td>
                <td className={`${cell} text-right font-bold`}>{it?.name || "صنف"}</td>
                <td className={`${cell} text-center`}>
                  <span className="inline-block min-w-[36px] rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-black text-sky-800" dir="ltr">
                    ×{it?.qty ?? 0}
                  </span>
                </td>
                <td className={`${cell} text-center font-semibold`} dir="ltr">{fmtMoney(it?.salePrice)}</td>
                <td className={`${cell} bg-emerald-50/70 text-center font-black text-emerald-800`} dir="ltr">
                  {fmtMoney(it?.total)}
                </td>
              </tr>
            ))}
            {/* نهاية الجدول: إجمالي كمية الأصناف */}
            <tr className="bg-gradient-to-b from-amber-100 to-amber-50 font-black">
              <td colSpan={2} className={`${cell} text-right text-xs`}>
                إجمالي كمية الأصناف <span className="text-neutral-500">({t.itemCount} أصناف)</span>
              </td>
              <td className={`${cell} text-center`} dir="ltr">{t.totalQty}</td>
              <td className={`${cell} text-center text-[11px] text-neutral-500`}>إجمالي الفاتورة</td>
              <td className={`${cell} text-center`} dir="ltr">{fmtMoney(t.invoiceTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* ===== الإجماليات (كالصورة الرسمية) ===== */}
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }} aria-label="إجماليات الفاتورة">
          <tbody>
            {discountVal > 0 && (
              <tr>
                <td className={`${cell} text-right font-bold`}>الخصم على الفاتورة</td>
                <td className={`${cell} w-[190px] text-center font-black text-red-600`} dir="ltr">
                  − {fmtMoney(discountVal)}
                </td>
              </tr>
            )}
            <tr>
              <td className={`${cell} text-right font-bold`}>الحساب السابق (عليكم)</td>
              <td className={`${cell} w-[190px] text-center font-black`} dir="ltr">{fmtMoney(t.prevBalance)}</td>
            </tr>
            <tr>
              <td className={`${cell} text-right font-bold`}>اجمالي الفاتورة</td>
              <td className={`${cell} text-center font-black text-teal-800`} dir="ltr">{fmtMoney(t.invoiceTotal)}</td>
            </tr>
            <tr className="bg-teal-50">
              <td className={`${cell} text-right font-black text-teal-900`}>الاجمالي العام</td>
              <td className={`${cell} text-center text-base font-black text-teal-900`} dir="ltr">{fmtMoney(t.grandTotal)}</td>
            </tr>
            <tr>
              <td className={`${cell} text-right font-bold`}>المدفوع</td>
              <td className={`${cell} text-center font-black text-emerald-700`} dir="ltr">{fmtMoney(t.paid)}</td>
            </tr>
            <tr className="bg-slate-900 text-white">
              <td className="border border-slate-900 px-2 py-2 text-right text-base font-black">
                الحساب الحالي (عليكم)
              </td>
              <td className="border border-slate-900 px-2 py-2 text-center text-lg font-black" dir="ltr">
                {fmtMoney(t.currentBalance)}
              </td>
            </tr>
          </tbody>
        </table>

        {!!sale?.notes?.trim() && (
          <p className="border-t border-neutral-300 px-3 py-1.5 text-xs text-neutral-600">
            📝 ملاحظات: {sale.notes.trim()}
          </p>
        )}

        {/* ===== أسفل الفاتورة: بيانات المؤسسة والتواصل ===== */}
        <div className="border-t-4 border-double border-neutral-800 bg-gradient-to-b from-white to-slate-50 px-4 pb-4 pt-2 text-center">
          <p className="text-sm font-black text-slate-900">{name}</p>
          <p className="mt-0.5 text-sm font-bold text-teal-800" dir="ltr">
            📞 {phones}
          </p>
          <p className="mt-1.5 text-xs font-semibold text-neutral-500">شكراً لتعاملكم معنا 🌹</p>
          <p className="mt-0.5 inline-block rounded-full bg-teal-50 px-3 py-0.5 text-[11px] font-bold text-teal-700">
            🤲 {footerDhikr}
          </p>
        </div>
      </div>
    </div>
  );
}
