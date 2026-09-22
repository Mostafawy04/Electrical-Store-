import type { Sale } from "@/lib/types";
import { fmtMoney, fmtDate } from "@/lib/utils";

/** فاتورة طباعة احترافية: حرارية (80mm) + عادية — تُطبع عبر window.print */
export function InvoicePrint({ sale, companyName }: { sale: Sale; companyName: string }) {
  const items = sale?.items ?? [];
  return (
    <div id="print-area" className="print-doc">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; inset: 0 auto auto 0; width: 100%; margin: 0; padding: 8px; }
          .no-print { display: none !important; }
          @page { size: auto; margin: 5mm; }
        }
      `}</style>
      <div className="mx-auto max-w-[80mm] border border-dashed border-gray-400 p-3 text-center font-mono text-sm sm:max-w-sm">
        <h2 className="text-lg font-black">{companyName}</h2>
        <p className="text-xs">فاتورة بيع #{String(sale.id).slice(-6)}</p>
        <p className="text-xs">{fmtDate(sale.date)}</p>
        <hr className="my-2 border-dashed" />
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-right">الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th className="text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-dotted">
                <td className="py-1 text-right">{it.name}</td>
                <td>{it.qty}</td>
                <td>{it.salePrice}</td>
                <td className="text-left">{it.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between"><span>الإجمالي:</span><span>{fmtMoney(sale.subtotal)}</span></div>
          {!!sale.discount && <div className="flex justify-between"><span>الخصم:</span><span>{fmtMoney(sale.discount)}</span></div>}
          <div className="flex justify-between text-base font-black"><span>الصافي:</span><span>{fmtMoney(sale.netTotal)}</span></div>
        </div>
        <hr className="my-2 border-dashed" />
        <p className="text-xs">شكراً لتعاملكم معنا 🌹</p>
        <p className="text-[11px]">صلي على النبي ﷺ</p>
      </div>
    </div>
  );
}
