# ✅ قائمة التحقق - إعداد قاعدة البيانات

## المرحلة 1: الإعداد الأولي

- [ ] فتحت Supabase Dashboard (https://supabase.com/dashboard)
- [ ] أنشأت مشروع جديد أو فتحت مشروعي الحالي
- [ ] نسخت Connection String من Settings → Database
- [ ] حدثت DATABASE_URL في ملف `backend/.env`
- [ ] حفظت ملف `.env`

---

## المرحلة 2: اختبار الاتصال

- [ ] فتحت Terminal في مجلد `backend`
- [ ] شغلت `npm install` (إذا لم يكن مثبتاً)
- [ ] شغلت `npm run db:test`
- [ ] رأيت رسالة: ✅ نجح الاتصال بقاعدة البيانات!

**إذا فشل**: راجع `backend/DATABASE_CONNECTION_GUIDE.md`

---

## المرحلة 3: إنشاء الجداول

اختر طريقة واحدة:

### الطريقة A: Supabase SQL Editor (الأسهل) ⭐

- [ ] فتحت Supabase Dashboard
- [ ] ذهبت إلى SQL Editor → New Query
- [ ] فتحت ملف `backend/create-tables.sql`
- [ ] نسخت كل المحتوى
- [ ] لصقته في SQL Editor
- [ ] ضغطت Run (أو Ctrl+Enter)
- [ ] انتظرت حتى اكتمل التنفيذ (10-20 ثانية)
- [ ] رأيت رسالة نجاح

### الطريقة B: Prisma DB Push

- [ ] شغلت `npm run db:push` في Terminal
- [ ] رأيت رسالة نجاح

---

## المرحلة 4: توليد Prisma Client

- [ ] شغلت `npm run db:generate`
- [ ] رأيت: ✔ Generated Prisma Client

---

## المرحلة 5: إنشاء مستخدم Admin

- [ ] شغلت `npm run db:create-admin`
- [ ] رأيت بيانات تسجيل الدخول:
  - الهاتف: +967777777777
  - كلمة المرور: Admin@123
- [ ] (اختياري) أنشأت مستخدمين تجريبيين

---

## المرحلة 6: تشغيل Backend

- [ ] شغلت `npm run dev`
- [ ] رأيت: 🚀 Server running on port 3000
- [ ] لم أر أي أخطاء

---

## المرحلة 7: اختبار API

- [ ] فتحت المتصفح
- [ ] ذهبت إلى: http://localhost:3000/health
- [ ] رأيت:
  ```json
  {
    "status": "success",
    "message": "Server is running"
  }
  ```

---

## ✅ النتيجة النهائية

إذا أكملت جميع الخطوات بنجاح:

- ✅ قاعدة البيانات متصلة
- ✅ جميع الجداول منشأة (12 جدول)
- ✅ Prisma Client مولد
- ✅ مستخدم Admin جاهز
- ✅ Backend يعمل على port 3000
- ✅ API جاهز للاستخدام

---

## 🎉 مبروك!

**أنت الآن جاهز للبدء في التطوير!**

### الخطوات التالية:

1. **اختبر تسجيل الدخول** باستخدام بيانات Admin
2. **ابدأ تطوير API Endpoints**
3. **اربط تطبيقات Flutter** بالـ Backend
4. **أكمل Admin Dashboard**

---

## 🆘 إذا واجهت مشكلة

راجع هذه الملفات:

1. `backend/QUICK_START.md` - دليل سريع
2. `backend/SETUP_DATABASE_STEP_BY_STEP.md` - دليل مفصل
3. `backend/DATABASE_CONNECTION_GUIDE.md` - حل المشاكل
4. `DATABASE_SOLUTION_REPORT.md` - التقرير الكامل

---

**تاريخ الإكمال**: __________

**الوقت المستغرق**: __________

**الملاحظات**: 
_______________________________________
_______________________________________
_______________________________________
