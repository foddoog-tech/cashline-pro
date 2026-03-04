# 🚀 دليل البدء السريع - Backend

## ⚡ الإعداد السريع (5 دقائق)

### 1️⃣ تثبيت المتطلبات

```bash
cd backend
npm install
```

### 2️⃣ إعداد قاعدة البيانات Supabase

1. **افتح**: https://supabase.com/dashboard
2. **أنشئ مشروع جديد** أو افتح مشروعك
3. **اذهب إلى**: Settings → Database → Connection String
4. **انسخ** الرابط (URI format)

### 3️⃣ تحديث ملف .env

```bash
# افتح ملف .env وحدث هذا السطر:
DATABASE_URL="الرابط_الذي_نسخته_من_Supabase"
```

### 4️⃣ اختبار الاتصال

```bash
npm run db:test
```

**يجب أن ترى**: ✅ نجح الاتصال بقاعدة البيانات!

### 5️⃣ إنشاء الجداول

**الطريقة الأسهل** (Supabase SQL Editor):

1. في Supabase Dashboard → **SQL Editor** → **New Query**
2. افتح ملف `create-tables.sql`
3. انسخ كل المحتوى والصقه
4. اضغط **Run**

**أو استخدم Prisma**:

```bash
npm run db:push
```

### 6️⃣ إنشاء مستخدم Admin

```bash
npm run db:create-admin
```

**بيانات تسجيل الدخول**:
- الهاتف: `+967777777777`
- كلمة المرور: `Admin@123`

### 7️⃣ تشغيل Backend

```bash
npm run dev
```

**اختبر**: http://localhost:3000/health

---

## 🎯 أوامر مفيدة

| الأمر | الوصف |
|-------|-------|
| `npm run dev` | تشغيل في وضع التطوير |
| `npm run db:test` | اختبار الاتصال بقاعدة البيانات |
| `npm run db:studio` | فتح Prisma Studio (واجهة رسومية) |
| `npm run db:create-admin` | إنشاء مستخدم Admin |
| `npm run db:generate` | توليد Prisma Client |
| `npm run db:push` | دفع Schema إلى قاعدة البيانات |

---

## 🆘 حل المشاكل

### ❌ "Can't reach database server"

**الحل**:
1. تحقق من DATABASE_URL في `.env`
2. تأكد من اتصالك بالإنترنت
3. راجع `SETUP_DATABASE_STEP_BY_STEP.md`

### ❌ "Port 3000 already in use"

```bash
# في .env
PORT=3001
```

### ❌ "Table does not exist"

```bash
# شغل create-tables.sql في Supabase
# أو
npm run db:push
```

---

## 📚 المزيد من المساعدة

- **دليل شامل**: `SETUP_DATABASE_STEP_BY_STEP.md`
- **حل المشاكل**: `DATABASE_CONNECTION_GUIDE.md`
- **التوثيق الكامل**: `README.md`
- **الملخص**: `DATABASE_SOLUTION_SUMMARY.md`

---

## ✅ قائمة التحقق

- [ ] ثبت المتطلبات (`npm install`)
- [ ] حدثت DATABASE_URL في `.env`
- [ ] اختبرت الاتصال (`npm run db:test`)
- [ ] أنشأت الجداول (SQL Editor أو `npm run db:push`)
- [ ] أنشأت مستخدم Admin (`npm run db:create-admin`)
- [ ] شغلت Backend (`npm run dev`)
- [ ] اختبرت API (`http://localhost:3000/health`)

---

**🎉 مبروك! Backend جاهز للعمل!**
