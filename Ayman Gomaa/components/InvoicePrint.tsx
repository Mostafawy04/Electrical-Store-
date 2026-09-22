"use client";
import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { DEFAULT_STORE_PHONES } from "@/lib/types";
import { fmtMoney, fmtDate, toNum } from "@/lib/utils";
import { shortInvoiceNo } from "@/lib/invoiceShare";
import { getRandomDhikr } from "@/lib/i18n";

const NAVY = "#0f2748";
const NAVY_LIGHT = "#1e4a8a";
const GOLD_BG = "#fef3c7";
const GOLD_BORDER = "#d97706";

interface Props {
  sale: Sale;
  companyName: string;
  storePhones?: string;
}

/**
 * فاتورة احترافية ملونة (A4 / موبايل / حرارية):
 * - هيدر كحلي متدرج باسم المحل وأرقام التواصل
 * - جدول أصناف: اسم الصنف / الكمية / السعر الفردي / إجمالي الصنف
 * - إجماليات بارزة بخط عريض
 * - جاهزة للطباعة (ألوان ثابتة) والمشاركة واتساب
 */
export function InvoicePrint({ sale, companyName, storePhones }: Props) {
  const items = sale?.items ?? [];
  const phones = (storePhones ?? "").trim() || DEFAULT_STORE_PHONES;
  const name = (companyName ?? "").trim() || "مؤسسة الجبالي للأدوات الكهربائية";

  const footerDhikr = useMemo(() => {
    try {
      return getRandomDhikr().text;
    } catch {
      return "صلي على النبي ﷺ";
    }
  }, [sale?.id]);

  const totalQty = useMemo(
    () => items.reduce((a, it) => a + Math.max(0, Math.floor(toNum(it?.qty, 0))), 0),
    [items]
  );

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
          .inv-card {
            box-shadow: none !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          @page { size: auto; margin: 5mm; }
        }
      `}</style>

      <div
        className="inv-card mx-auto w-full max-w-[480px] overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-lg"
        style={{ fontFamily: "inherit" }}
      >
        {/* ===== الهيدر ===== */}
        <div
          className="px-5 pb-4 pt-5 text-center text-white"
          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)` }}
        >
          <div
            className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            ⚡
          </div>
          <h2 className="text-xl font-black leading-tight">{name}</h2>
          <p className="mt-0.5 text-xs opacity-80">للأدوات الكهربائية — بيع بالتجزئة والجملة</p>
          <div
            className="mx-auto mt-2.5 flex w-fit items-center gap-2 rounded-full px-4 py-1 text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.15)" }}
            dir="ltr"
          >
            <span>📞</span>
            <span>{phones}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span
              className="rounded-full px-3 py-1 font-black"
              style={{ background: "#fbbf24", color: NAVY }}
            >
              فاتورة #{shortInvoiceNo(sale?.id)}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
              📅 {fmtDate(sale?.date)}
            </span>
          </div>
        </div>

        {/* ===== جدول الأصناف ===== */}
        <div className="px-4 pt-4">
          <table className="w-full overflow-hidden rounded-xl text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: NAVY, color: "#fff" }}>
                <th className="px-2 py-2.5 text-center text-xs font-black" style={{ width: "34px" }}>م</th>
                <th className="px-2 py-2.5 text-right text-xs font-black">اسم الصنف</th>
                <th className="px-2 py-2.5 text-center text-xs font-black" style={{ width: "52px" }}>الكمية</th>
                <th className="px-2 py-2.5 text-center text-xs font-black" style={{ width: "86px" }}>السعر الفردي</th>
                <th className="px-2 py-2.5 text-center text-xs font-black" style={{ width: "92px" }}>إجمالي الصنف</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-xs text-slate-400">
                    لا توجد أصناف في هذه الفاتورة
                  </td>
                </tr>
              )}
              {items.map((it, i) => (
                <tr
                  key={it?.id ?? i}
                  style={{
                    background: i % 2 === 0 ? "#ffffff" : "#f1f5f9",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <td className="px-2 py-2 text-center text-xs font-bold text-slate-500">{i + 1}</td>
                  <td className="px-2 py-2 text-right text-[13px] font-bold text-slate-800">{it?.name || "صنف"}</td>
                  <td className="px-2 py-2 text-center text-[13px] font-black" style={{ color: NAVY }}>
                    {toNum(it?.qty, 0)}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-slate-600">{fmtMoney(it?.salePrice)}</td>
                  <td className="px-2 py-2 text-center text-[13px] font-black" style={{ color: NAVY }}>
                    {fmtMoney(it?.total ?? toNum(it?.qty, 0) * toNum(it?.salePrice, 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[11px] text-slate-500">
            عدد الأصناف: <b>{items.length}</b> • إجمالي الكميات: <b>{totalQty}</b>
          </p>
        </div>

        {/* ===== الإجماليات ===== */}
        <div className="px-4 pt-3">
          <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">الإجمالي الفرعي:</span>
              <span className="font-black text-slate-800">{fmtMoney(sale?.subtotal)}</span>
            </div>
            {toNum(sale?.discount, 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">الخصم:</span>
                <span className="font-black text-red-600">− {fmtMoney(sale?.discount)}</span>
              </div>
            )}
            <div
              className="flex items-center justify-between rounded-lg border px-3 py-2.5"
              style={{ background: GOLD_BG, borderColor: GOLD_BORDER }}
            >
              <span className="text-base font-black" style={{ color: NAVY }}>
                الإجمالي الكلي:
              </span>
              <span className="text-xl font-black" style={{ color: NAVY }}>
                {fmtMoney(sale?.netTotal)}
              </span>
            </div>
          </div>

          {!!sale?.notes?.trim() && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              📝 ملاحظات: {sale.notes.trim()}
            </p>
          )}
        </div>

        {/* ===== الفوتر ===== */}
        <div className="mt-4 px-5 pb-5 pt-3 text-center" style={{ background: "#f8fafc", borderTop: "2px dashed #cbd5e1" }}>
          <p className="text-sm font-black" style={{ color: NAVY }}>
            شكراً لتعاملكم معنا 🌹
          </p>
          <p className="mt-1 text-xs font-bold text-emerald-700">{footerDhikr}</p>
          <p className="mt-2 text-xs text-slate-500" dir="ltr">
            📞 {phones}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{name}</p>
        </div>
      </div>
    </div>
  );
}
