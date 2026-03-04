# 🚀 CashLine Backend API

Backend API لمنصة كاش لاين - نظام توصيل متكامل

## 📋 المحتويات

- [المتطلبات](#المتطلبات)
- [التثبيت](#التثبيت)
- [إعداد قاعدة البيانات](#إعداد-قاعدة-البيانات)
- [التشغيل](#التشغيل)
- [API Endpoints](#api-endpoints)
- [البنية](#البنية)
- [المساهمة](#المساهمة)

---

## 📦 المتطلبات

- **Node.js**: 18.0.0 أو أحدث
- **npm**: 9.0.0 أو أحدث
- **PostgreSQL**: 14+ (أو حساب Supabase)
- **Redis**: 6+ (اختياري - للتخزين المؤقت)

---

## 🔧 التثبيت

### 1. تثبيت الحزم

```bash
cd backend
npm install
```

### 2. إعداد ملف البيئة

```bash
# انسخ ملف المثال
cp .env.example .env

# ثم عدل ملف .env بمحرر النصوص المفضل لديك
```

**المتغيرات الأساسية المطلوبة**:
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
```

---

## 🗄️ إعداد قاعدة البيانات

### الطريقة 1: استخدام Supabase (موصى بها) ⭐

**اتبع الدليل الشامل**: [`SETUP_DATABASE_STEP_BY_STEP.md`](./SETUP_DATABASE_STEP_BY_STEP.md)

**ملخص سريع**:

1. أنشئ حساب على [Supabase](https://supabase.com)
2. أنشئ مشروع جديد
3. احصل على Connection String من Settings → Database
4. ضعه في `.env`:
   ```bash
   DATABASE_URL="postgresql://postgres.xxxxx:password@...supabase.com:6543/postgres"
   ```
5. شغل SQL Script في Supabase SQL Editor:
   ```bash
   # افتح ملف create-tables.sql وانسخ محتواه إلى SQL Editor
   ```

### الطريقة 2: استخدام PostgreSQL محلي

```bash
# 1. ثبت PostgreSQL
# 2. أنشئ قاعدة بيانات
createdb cashline

# 3. حدث DATABASE_URL في .env
DATABASE_URL="postgresql://postgres:password@localhost:5432/cashline"

# 4. شغل Migrations
npx prisma migrate dev --name init
```

### التحقق من الاتصال

```bash
# اختبار بسيط للاتصال
node test-db-simple.js

# يجب أن ترى: ✅ نجح الاتصال بقاعدة البيانات!
```

### توليد Prisma Client

```bash
npm run db:generate
```

---

## 🚀 التشغيل

### وضع التطوير

```bash
npm run dev
```

Server سيعمل على: `http://localhost:3000`

### وضع الإنتاج

```bash
# بناء المشروع
npm run build

# تشغيل
npm start
```

---

## 📡 API Endpoints

### Health Check

```http
GET /health
```

**Response**:
```json
{
  "status": "success",
  "message": "Server is running",
  "timestamp": "2026-02-10T00:00:00.000Z",
  "version": "1.0.0"
}
```

### Authentication

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

### Users

```http
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
DELETE /api/v1/users/account
```

### Products

```http
GET    /api/v1/products
GET    /api/v1/products/:id
POST   /api/v1/products
PUT    /api/v1/products/:id
DELETE /api/v1/products/:id
```

### Orders

```http
GET    /api/v1/orders
GET    /api/v1/orders/:id
POST   /api/v1/orders
PUT    /api/v1/orders/:id/status
DELETE /api/v1/orders/:id
```

### Merchants

```http
GET    /api/v1/merchants
GET    /api/v1/merchants/:id
POST   /api/v1/merchants/register
PUT    /api/v1/merchants/:id
```

### Drivers

```http
GET    /api/v1/drivers
GET    /api/v1/drivers/:id
POST   /api/v1/drivers/register
PUT    /api/v1/drivers/:id/location
```

### Admin

```http
GET    /api/v1/admin/dashboard
GET    /api/v1/admin/users
PUT    /api/v1/admin/users/:id/approve
GET    /api/v1/admin/orders
GET    /api/v1/admin/analytics
```

**للتوثيق الكامل**: قريباً سيتم إضافة Swagger/OpenAPI

---

## 🏗️ البنية

```
backend/
├── prisma/
│   └── schema.prisma          # Prisma Schema
├── src/
│   ├── controllers/           # Route Controllers
│   ├── middleware/            # Express Middleware
│   ├── routes/                # API Routes
│   ├── services/              # Business Logic
│   ├── utils/                 # Helper Functions
│   └── app.ts                 # Main Application
├── .env                       # Environment Variables
├── .env.example               # Example Environment
├── package.json
├── tsconfig.json
├── create-tables.sql          # SQL Script للجداول
├── test-db-simple.js          # اختبار الاتصال
└── SETUP_DATABASE_STEP_BY_STEP.md  # دليل الإعداد
```

---

## 🧪 الاختبار

```bash
# تشغيل جميع الاختبارات
npm test

# تشغيل الاختبارات في وضع المراقبة
npm run test:watch

# اختبار الاتصال بقاعدة البيانات
node test-db-simple.js
```

---

## 🛠️ أدوات مفيدة

### Prisma Studio (عرض البيانات)

```bash
npm run db:studio
```

سيفتح واجهة رسومية على: `http://localhost:5555`

### Database Migrations

```bash
# إنشاء migration جديد
npm run db:migrate

# إعادة تعيين قاعدة البيانات
npx prisma migrate reset

# دفع التغييرات مباشرة (للتطوير)
npx prisma db push
```

### Code Quality

```bash
# فحص الأخطاء
npm run lint

# إصلاح الأخطاء تلقائياً
npm run lint:fix
```

---

## 🔒 الأمان

- ✅ Helmet.js للحماية من هجمات XSS
- ✅ CORS مفعل
- ✅ Rate Limiting (100 طلب/15 دقيقة)
- ✅ JWT Authentication
- ✅ bcrypt لتشفير كلمات المرور
- ✅ Input Validation مع express-validator

---

## 📊 قاعدة البيانات

### الجداول الرئيسية

- **users**: المستخدمون (زبائن، تجار، مناديب، مدراء)
- **customers**: بيانات الزبائن
- **merchants**: بيانات التجار والأسر المنتجة
- **drivers**: بيانات المناديب
- **products**: المنتجات
- **orders**: الطلبات
- **order_items**: عناصر الطلبات
- **payments**: المدفوعات
- **ratings**: التقييمات
- **notifications**: الإشعارات
- **withdrawals**: طلبات السحب
- **admins**: المدراء

---

## 🌍 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | البيئة (development/production) | ✅ |
| `PORT` | منفذ السيرفر | ✅ |
| `DATABASE_URL` | رابط قاعدة البيانات | ✅ |
| `JWT_SECRET` | مفتاح JWT | ✅ |
| `JWT_ACCESS_EXPIRATION` | مدة صلاحية Access Token | ✅ |
| `REDIS_URL` | رابط Redis | ❌ |
| `FIREBASE_PROJECT_ID` | معرف مشروع Firebase | ❌ |
| `GOOGLE_MAPS_API_KEY` | مفتاح Google Maps | ❌ |
| `SMTP_HOST` | خادم البريد | ❌ |

**راجع `.env.example` للقائمة الكاملة**

---

## 🐛 حل المشاكل

### مشكلة: "Can't reach database server"

**الحل**: راجع [`DATABASE_CONNECTION_GUIDE.md`](./DATABASE_CONNECTION_GUIDE.md)

### مشكلة: "Port 3000 already in use"

```bash
# غير PORT في .env
PORT=3001
```

### مشكلة: "Module not found"

```bash
# أعد تثبيت الحزم
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | تشغيل في وضع التطوير |
| `npm run build` | بناء للإنتاج |
| `npm start` | تشغيل الإنتاج |
| `npm run db:generate` | توليد Prisma Client |
| `npm run db:migrate` | تشغيل Migrations |
| `npm run db:studio` | فتح Prisma Studio |
| `npm test` | تشغيل الاختبارات |
| `npm run lint` | فحص الكود |

---

## 🤝 المساهمة

نرحب بمساهماتك! يرجى:

1. Fork المشروع
2. إنشاء branch جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push إلى Branch (`git push origin feature/amazing-feature`)
5. فتح Pull Request

---

## 📄 الترخيص

MIT License - راجع [LICENSE](../LICENSE) للتفاصيل

---

## 📞 الدعم

- **Email**: support@cashline.app
- **Documentation**: [Wiki](https://github.com/cashline/wiki)
- **Issues**: [GitHub Issues](https://github.com/cashline/issues)

---

## 🎯 الخطوات التالية

- [ ] إكمال جميع API Endpoints
- [ ] إضافة Swagger Documentation
- [ ] إضافة Unit Tests
- [ ] إعداد CI/CD
- [ ] إضافة Docker Support
- [ ] تحسين الأداء والتخزين المؤقت

---

**صنع بـ ❤️ من فريق كاش لاين**
