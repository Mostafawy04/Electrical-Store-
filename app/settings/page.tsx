"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Field, inputCls } from "@/components/ui";
import { buildBackup, downloadBackup, backupViaEmail, restoreBackup, backupToCloud } from "@/lib/backup";
import { toNum } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { ready, userEmail, userId, settings, saveSettings, products, purchases, sales } = useApp();
  const [company, setCompany] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ready && !userEmail) router.replace("/login");
  }, [ready, userEmail, router]);

  useEffect(() => {
    setCompany(settings.companyName);
  }, [settings.companyName]);

  // حفظ تلقائي لاسم الشركة أثناء الكتابة (debounce)
  function onCompanyChange(v: string) {
    setCompany(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveSettings({ companyName: v }).then(() => setMsg("تم الحفظ تلقائياً ✅"));
    }, 600);
  }

  async function localBackup() {
    setBusy(true); setMsg("");
    try {
      const payload = await buildBackup(userEmail ?? undefined);
      downloadBackup(payload);
      setMsg("تم تنزيل النسخة الاحتياطية على جهازك ✅");
    } catch {
      setMsg("تعذر إنشاء النسخة");
    } finally { setBusy(false); }
  }

  async function emailBackup() {
    setBusy(true); setMsg("");
    try {
      const payload = await buildBackup(userEmail ?? undefined);
      await backupViaEmail(payload, userEmail ?? undefined);
      setMsg("تم فتح Gmail لإرسال النسخة — والصق البيانات من الحافظة ✅");
    } catch {
      setMsg("تعذر فتح الإيميل");
    } finally { setBusy(false); }
  }

  async function cloudBackup() {
    setBusy(true); setMsg("");
    try {
      const payload = await buildBackup(userEmail ?? undefined);
      const r = await backupToCloud(payload, userId ?? "local");
      setMsg(r.ok ? "تم رفع النسخة سحابياً ✅" : `تعذر الرفع: ${r.error}`);
    } catch {
      setMsg("تعذر الرفع");
    } finally { setBusy(false); }
  }

  async function onRestoreFile(f: File | undefined) {
    if (!f) return;
    setMsg("");
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      const r = await restoreBackup(json);
      setMsg(r.ok ? "تمت استعادة النسخة — حدّث الصفحة ✅" : `ملف غير صالح: ${r.error}`);
    } catch {
      setMsg("تعذر قراءة الملف");
    }
  }

  if (!ready) return <p className="py-10 text-center">جارٍ التحميل…</p>;
  if (!userEmail) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black">⚙️ الإعدادات</h2>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">🏢 اسم المؤسسة / الشركة</h3>
        <Field label="يظهر في الواجهة والفواتير والتقارير">
          <input value={company} onChange={(e) => onCompanyChange(e.target.value)} className={inputCls} placeholder="اسم شركتك" />
        </Field>
        <p className="mt-2 text-xs text-gray-500">الحفظ تلقائي أثناء الكتابة (Auto-save)</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">🎨 المظهر والخط واللغة</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="الوضع">
            <div className="flex gap-2">
              <button onClick={() => void saveSettings({ darkMode: false })} className={`flex-1 rounded-lg border py-2 ${!settings.darkMode ? "border-green-600 bg-green-50 font-bold dark:bg-green-950" : ""}`}>☀️ فاتح</button>
              <button onClick={() => void saveSettings({ darkMode: true })} className={`flex-1 rounded-lg border py-2 ${settings.darkMode ? "border-green-600 bg-green-50 font-bold dark:bg-green-950" : ""}`}>🌙 ليلي</button>
            </div>
          </Field>
          <Field label="حجم الخط">
            <select value={settings.fontSize} onChange={(e) => void saveSettings({ fontSize: e.target.value as never })} className={inputCls}>
              <option value="small">صغير</option>
              <option value="medium">متوسط</option>
              <option value="large">كبير</option>
            </select>
          </Field>
          <Field label="نوع الخط">
            <select value={settings.fontFamily} onChange={(e) => void saveSettings({ fontFamily: e.target.value as never })} className={inputCls}>
              <option value="cairo">Cairo</option>
              <option value="tajawal">Tajawal</option>
              <option value="system">خط النظام</option>
            </select>
          </Field>
          <Field label="اللغة">
            <select value={settings.language} onChange={(e) => void saveSettings({ language: e.target.value as never })} className={inputCls}>
              <option value="ar">العربية (أساسية)</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">🤲 التذكيرات الدينية</h3>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">تفعيل التذكيرات المتنوعة (أذكار، استغفار، أدعية، حكم…)</span>
          <button
            onClick={() => void saveSettings({ dhikrEnabled: !settings.dhikrEnabled })}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${settings.dhikrEnabled ? "bg-green-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}
          >
            {settings.dhikrEnabled ? "مفعّلة" : "متوقفة"}
          </button>
        </div>
        <Field label="كل كم دقيقة؟ (1 - 180)">
          <input
            type="number" min={1} max={180}
            value={settings.dhikrIntervalMin}
            onChange={(e) => void saveSettings({ dhikrIntervalMin: Math.min(180, Math.max(1, toNum(e.target.value, 30))) })}
            className={inputCls} dir="ltr"
          />
        </Field>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">💾 النسخ الاحتياطي</h3>
        <p className="mb-3 text-sm text-gray-500">
          المنتجات: {products.length} • المشتريات: {purchases.length} • المبيعات: {sales.length}
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <button onClick={() => void localBackup()} disabled={busy} className="rounded-lg bg-green-600 py-2.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
            ⬇️ تنزيل نسخة محلية
          </button>
          <button onClick={() => void emailBackup()} disabled={busy} className="rounded-lg bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            📧 نسخة عبر إيميل جوجل
          </button>
          <button onClick={() => void cloudBackup()} disabled={busy} className="rounded-lg border py-2.5 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
            ☁️ نسخة سحابية
          </button>
        </div>
        <div className="mt-3">
          <Field label="استعادة من ملف">
            <input type="file" accept="application/json" onChange={(e) => void onRestoreFile(e.target.files?.[0])} className={inputCls} />
          </Field>
        </div>
        {!!msg && <p className="mt-2 text-sm font-bold">{msg}</p>}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">📞 الدعم الفني</h3>
        <div className="flex flex-wrap gap-2">
          <a href="https://wa.me/201113008004" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white">
            💬 واتساب: 01113008004
          </a>
          <a href="tel:+201113008004" className="rounded-lg border px-4 py-2 font-bold">
            📞 اتصال مباشر
          </a>
          <a href="https://youtube.com/@mostafawy04?si=Qlc05WchkaOHN3Dz" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">
            ▶️ قناة اليوتيوب
          </a>
        </div>
      </div>
    </div>
  );
}
