# نظام إدارة المبيعات والمشتريات 🛒

تطبيق ويب متكامل **عربي (RTL)** — يعمل **Offline-first** كـ **PWA** قابل للتثبيت على الأندرويد، جاهز للنشر على **Vercel**، بقاعدة بيانات **Supabase** + تخزين محلي **IndexedDB**.

## المميزات
- ✅ تسجيل دخول Email/Password فقط، بدون صفحة تسجيل عامة + رسالة «الحساب غير مفعّل — تواصل مع الدعم»
- ✅ لوحة رئيسية: إيرادات يومية/شهرية + أرباح دقيقة (بيع − شراء) + رسم 7 أيام
- ✅ مشتريات: مورد، منتج، كمية، سعر شراء، خصم، إجمالي بعد الخصم، سعر بيع مقترح — حساب فوري
- ✅ مبيعات: حتى 30 صنفاً، باركود (ماسح خارجي + كاميرا BarcodeDetector)، صافي بسعر الجمهور، طباعة حرارية/عادية
- ✅ مخزون + تقارير + إعدادات (اسم الشركة، ثيم، خط، لغة، تذكيرات دينية كل N دقيقة)
- ✅ نسخ احتياطي: تنزيل محلي + Gmail + سحابة Supabase + استعادة
- ✅ دعم واتساب `01113008004` ويوتيوب في الفوتر والإعدادات

## التشغيل محلياً
```bash
npm install
cp .env.example .env.local  # ثم املأ قيم Supabase
npm run dev
```

> ملاحظة: يعمل التطبيق أيضاً **بدون Supabase** (وضع محلي Offline بالكامل).

## إعداد Supabase (5 دقائق)
1. أنشئ مشروعاً في [supabase.com](https://supabase.com) وانسخ `URL` و `anon key` إلى `.env.local`.
2. من **SQL Editor** نفّذ ملف `supabase/schema.sql`.
3. من **Authentication → Users** أضف المستخدمين (Email/Password)، ثم فعّلهم:
   ```sql
   insert into allowed_users (email, is_active) values ('admin@store.com', true)
   on conflict (email) do update set is_active = true;
   ```
   - أو اضبط `NEXT_PUBLIC_ALLOWED_EMAILS=admin@store.com` في Vercel.
4. (اختياري) أنشئ Bucket باسم `backups` لتفعيل النسخ السحابي.

## النشر على Vercel
1. ارفع المجلد على GitHub.
2. في Vercel: **New Project → Import** وأضف متغيرات البيئة (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ALLOWED_EMAILS`).
3. Deploy — وسيعمل الـ PWA تلقائياً (`/manifest.webmanifest` + `/sw.js`).

## تحويله إلى APK
- من متصفح Chrome على الأندرويد: افتح رابط Vercel ← ⋮ ← **تثبيت التطبيق / Add to Home screen**.
- أو استخدم [PWABuilder.com](https://pwabuilder.com) لتوليد ملف APK/AAB من الرابط.

## الأيقونات
- الأيقونة المصدرية: `public/icons/icon.svg` — ولّد منها `icon-192.png` و `icon-512.png` (مثلاً عبر [squoosh.app](https://squoosh.app)) قبل النشر النهائي، أو أبقهما SVG.

## البنية
```
app/ (page, login, sales, purchases, inventory, reports, settings)
components/ (Shell, BarcodeInput, InvoicePrint, DhikrToast, ui)
lib/ (store, db, supabase, sync, backup, utils, i18n, types)
public/ (manifest, sw.js, icons)
supabase/schema.sql
```
