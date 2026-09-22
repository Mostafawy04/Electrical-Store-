"use client";
import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { DEFAULT_STORE_PHONES, calcInvoiceTotals, displayInvoiceNo } from "@/lib/types";
import { fmtMoney, fmtDate } from "@/lib/utils";
import { getRandomDhikr } from "@/lib/i18n";

interface Props {
  sale: Sale;
  companyName: string;
  storePhones?: string;
}

/**
 * فاتورة كلاسيكية احترافية (مطابقة للفواتير الورقية):
 * - الرأس: اسم العميل / رقم الفاتورة / التاريخ
 * - الجدول (يمين→يسار): م / الصنف / الكمية / السعر / الإجمالي
 * - الإجماليات: كمية الأصناف / السابق / الفاتورة / العام / المدفوع / الحالي
 * - أسفلها بيانات المؤسسة وأرقام التواصل — نظيفة وجاهزة للطباعة والمشاركة
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
  }, [sale?.id]);

  const t = useMemo(
    () =>
      calcInvoiceTotals({
        items: items as Array<{ qty?: unknown }>,
        subtotal: sale?.subtotal,
        discount: sale?.discount,
        netTotal: sale?.netTotal,
        previousBalance: sale?.previousBalance,
        paid: sale?.paid,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sale?.id]
  );

  const cell = "border border-neutral-400 px-2 py-1.5";

  return (
    <div id="print-area" className="print-doc" dir="rtl">
      <style>{`
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
          @page { size: auto; margin: 5mm; }
        }
      `}</style>

      <div className="inv-classic mx-auto w-full max-w-[560px] border-2 border-neutral-800 bg-white text-neutral-900 shadow-lg">
        {/* ===== رأس الفاتورة ===== */}
        <div className="px-4 pb-2 pt-4 text-center">
          <h2 className="text-2xl font-black leading-tight">{name}</h2>
          <p className="mt-0.5 text-xs font-semibold text-neutral-500">للأدوات الكهربائية — بيع بالتجزئة والجملة</p>
          <p className="mt-1.5 text-sm font-black" dir="ltr">
            📞 {phones}
          </p>
        </div>

        <div className="mx-0 border-t-4 border-double border-neutral-800" />

        {/* ===== بيانات الفاتورة: العميل / الرقم / التاريخ ===== */}
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td className={`${cell} w-[44%]`}>
                <span className="text-[11px] text-neutral-500">اسم العميل: </span>
                <span className="font-black">{customer}</span>
              </td>
              <td className={`${cell} w-[28%] text-center`}>
                <span className="text-[11px] text-neutral-500">رقم الفاتورة: </span>
                <span className="font-black">{displayInvoiceNo(sale)}</span>
              </td>
              <td className={`${cell} w-[28%] text-center`}>
                <span className="text-[11px] text-neutral-500">التاريخ: </span>
                <span className="font-bold">{fmtDate(sale?.date)}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ===== جدول الأصناف ===== */}
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="bg-neutral-100">
              <th className={`${cell} text-center text-xs font-black`} style={{ width: "40px" }}>م</th>
              <th className={`${cell} text-right text-xs font-black`}>الصنف</th>
              <th className={`${cell} text-center text-xs font-black`} style={{ width: "64px" }}>الكمية</th>
              <th className={`${cell} text-center text-xs font-black`} style={{ width: "96px" }}>السعر</th>
              <th className={`${cell} text-center text-xs font-black`} style={{ width: "104px" }}>الإجمالي</th>
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
              <tr key={it?.id ?? i} className={i % 2 === 1 ? "bg-neutral-50" : undefined}>
                <td className={`${cell} text-center font-bold text-neutral-500`}>{i + 1}</td>
                <td className={`${cell} text-right font-bold`}>{it?.name || "صنف"}</td>
                <td className={`${cell} text-center font-black`}>{it?.qty ?? 0}</td>
                <td className={`${cell} text-center`}>{fmtMoney(it?.salePrice)}</td>
                <td className={`${cell} text-center font-black`}>{fmtMoney(it?.total)}</td>
              </tr>
            ))}
            <tr className="bg-neutral-100">
              <td colSpan={2} className={`${cell} text-right text-xs font-black`}>
                إجمالي كمية الأصناف
              </td>
              <td className={`${cell} text-center font-black`}>{t.totalQty}</td>
              <td className={`${cell} text-center text-[11px] text-neutral-500`}>عدد الأصناف: {t.itemCount}</td>
              <td className={`${cell} text-center font-black`}>{fmtMoney(t.invoiceTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* ===== الإجماليات ===== */}
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td className={`${cell} text-right font-bold`}>الحساب السابق (عليكم)</td>
              <td className={`${cell} w-[160px] text-center font-black`}>{fmtMoney(t.prevBalance)}</td>
            </tr>
            <tr>
              <td className={`${cell} text-right font-bold`}>اجمالي الفاتورة</td>
              <td className={`${cell} text-center font-black`}>{fmtMoney(t.invoiceTotal)}</td>
            </tr>
            <tr className="bg-neutral-100">
              <td className={`${cell} text-right font-black`}>الاجمالي العام</td>
              <td className={`${cell} text-center font-black`}>{fmtMoney(t.grandTotal)}</td>
            </tr>
            <tr>
              <td className={`${cell} text-right font-bold`}>المدفوع</td>
              <td className={`${cell} text-center font-black`}>{fmtMoney(t.paid)}</td>
            </tr>
            <tr className="bg-neutral-800 text-white">
              <td className="border border-neutral-800 px-2 py-2 text-right text-base font-black">
                الحساب الحالي (عليكم)
              </td>
              <td className="border border-neutral-800 px-2 py-2 text-center text-lg font-black">
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

        {/* ===== أسفل الفاتورة ===== */}
        <div className="border-t-4 border-double border-neutral-800 px-4 pb-4 pt-2 text-center">
          <p className="text-sm font-black">{name}</p>
          <p className="mt-0.5 text-sm font-bold" dir="ltr">
            📞 {phones}
          </p>
          <p className="mt-1.5 text-xs font-semibold text-neutral-500">شكراً لتعاملكم معنا 🌹</p>
          <p className="mt-0.5 text-[11px] font-bold text-emerald-700">{footerDhikr}</p>
        </div>
      </div>
    </div>
  );
}
