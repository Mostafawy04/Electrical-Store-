"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Field, inputCls } from "@/components/ui";
import { buildBackup, downloadBackup, backupViaEmail, restoreBackup, backupToCloud } from "@/lib/backup";
import { toNum } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { ready, userEmail, userId, settings, saveSettings, products, purchases, sales, customers, addOrUpdateCustomer, deleteCustomer } = useApp();
  const [company, setCompany] = useState("");
  const [phones, setPhones] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [cusName, setCusName] = useState("");
  const [cusPhone, setCusPhone] = useState("");
  const [cusBalance, setCusBalance] = useState("0");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phonesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ready && !userEmail) router.replace("/login");
  }, [ready, userEmail, router]);

  useEffect(() => {
    setCompany(settings.companyName);
  }, [settings.companyName]);

  useEffect(() => {
    setPhones(settings.storePhones ?? "");
  }, [settings.storePhones]);

  // حفظ تلقائي لاسم الشركة أثناء الكتابة (debounce)
  function onCompanyChange(v: string) {
    setCompany(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveSettings({ companyName: v }).then(() => setMsg("تم الحفظ تلقائياً ✅"));
    }, 600);
  }

  // حفظ تلقائي لأرقام التواصل أثناء الكتابة (debounce)
  function onPhonesChange(v: string) {
    setPhones(v);
    if (phonesTimer.current) clearTimeout(phonesTimer.current);
    phonesTimer.current = setTimeout(() => {
      void saveSettings({ storePhones: v }).then(() => setMsg("تم الحفظ تلقائياً ✅"));
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
          <input value={company} onChange={(e) => onCompanyChange(e.target.value)} className={inputCls} placeholder="مؤسسة الجبالي للأدوات الكهربائية" />
        </Field>
        <div className="mt-3">
          <Field label="أرقام التواصل في الفاتورة (تظهر في الهيدر والفوتر والواتساب)">
            <input
              value={phones}
              onChange={(e) => onPhonesChange(e.target.value)}
              className={inputCls}
              dir="ltr"
              placeholder="01158869448 - 01013454036"
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-gray-500">الحفظ تلقائي أثناء الكتابة (Auto-save)</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">🎨 المظهر والخط واللغة</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="الوضع">
            <div className="flex gap-2">
              <button onClick={() => void saveSettings({ darkMode: false })} className={`flex-1 rounded-lg border py-2 ${!settings.darkMode ? "border-brand-600 bg-brand-50 font-bold dark:bg-brand-950" : ""}`}>☀️ فاتح</button>
              <button onClick={() => void saveSettings({ darkMode: true })} className={`flex-1 rounded-lg border py-2 ${settings.darkMode ? "border-brand-600 bg-brand-50 font-bold dark:bg-brand-950" : ""}`}>🌙 ليلي</button>
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
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${settings.dhikrEnabled ? "bg-brand-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}
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
        <h3 className="mb-1 font-bold">👥 العملاء والحسابات ({customers.length})</h3>
        <p className="mb-3 text-xs text-gray-500">تُحفظ نهائياً في Supabase وتعود بعد تسجيل الدخول — وتظهر أرصدتها في فواتير المبيعات</p>
        <div className="grid gap-2 md:grid-cols-4">
          <Field label="اسم العميل">
            <input value={cusName} onChange={(e) => setCusName(e.target.value)} className={inputCls} placeholder="اسم العميل" />
          </Field>
          <Field label="الهاتف">
            <input value={cusPhone} onChange={(e) => setCusPhone(e.target.value)} className={inputCls} dir="ltr" placeholder="01xxxxxxxxx" />
          </Field>
          <Field label="الرصيد (عليكم)">
            <input value={cusBalance} onChange={(e) => setCusBalance(e.target.value)} className={inputCls} inputMode="decimal" dir="ltr" placeholder="0" />
          </Field>
          <div className="flex items-end">
            <button
              onClick={() => {
                const nm = cusName.trim();
                if (!nm) { setMsg("أدخل اسم العميل أولاً"); return; }
                void addOrUpdateCustomer({ name: nm, phone: cusPhone.trim() || undefined, balance: toNum(cusBalance) })
                  .then(() => { setCusName(""); setCusPhone(""); setCusBalance("0"); setMsg(`تم حفظ حساب ${nm} ✅`); });
              }}
              className="w-full rounded-lg bg-slate-800 py-2.5 font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              إضافة / تحديث
            </button>
          </div>
        </div>
        {customers.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {[...customers].sort((a, b) => a.name.localeCompare(b.name, "ar")).slice(0, 50).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                <div className="min-w-0">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="text-xs text-gray-500" dir="ltr">{c.phone || "—"} • الرصيد: {toNum(c.balance)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => { setCusName(c.name); setCusPhone(c.phone ?? ""); setCusBalance(String(c.balance ?? 0)); }}
                    className="text-xs font-bold text-blue-600"
                  >
                    تعديل
                  </button>
                  <button onClick={() => { if (confirm(`حذف حساب ${c.name}؟`)) void deleteCustomer(c.id); }} className="text-xs text-red-600">
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 font-bold">💾 النسخ الاحتياطي</h3>
        <p className="mb-3 text-sm text-gray-500">
          المنتجات: {products.length} • العملاء: {customers.length} • المشتريات: {purchases.length} • المبيعات: {sales.length}
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <button onClick={() => void localBackup()} disabled={busy} className="rounded-lg bg-brand-600 py-2.5 font-bold text-white hover:bg-brand-700 disabled:opacity-50">
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
          <a href="https://wa.me/201113008004" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-brand-600 px-4 py-2 font-bold text-white">
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
