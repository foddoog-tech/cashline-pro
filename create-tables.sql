-- ============================================
-- CashLine Database Schema
-- ============================================
-- قم بتشغيل هذا السكريبت في Supabase SQL Editor
-- إذا واجهت مشكلة في Prisma Migrate

-- ============================================
-- 1. إنشاء ENUMS
-- ============================================

CREATE TYPE "UserRole" AS ENUM (
  'CUSTOMER',
  'MERCHANT',
  'FAMILY_PRODUCER',
  'DRIVER',
  'ADMIN',
  'SUPER_ADMIN'
);

CREATE TYPE "OrderStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED'
);

CREATE TYPE "PaymentMethod" AS ENUM (
  'CASH_ON_DELIVERY',
  'KCB_BANK',
  'JEEB_WALLET'
);

-- ============================================
-- 2. جدول المستخدمين (Users)
-- ============================================

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone" VARCHAR(20) UNIQUE NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" "UserRole" NOT NULL,
  "full_name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(100),
  "avatar_url" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. جدول الزبائن (Customers)
-- ============================================

CREATE TABLE "customers" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "address" TEXT NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "building" VARCHAR(50),
  "floor" VARCHAR(50),
  "apartment" VARCHAR(50)
);

-- ============================================
-- 4. جدول التجار (Merchants)
-- ============================================

CREATE TABLE "merchants" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL,
  "store_name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "id_image_url" TEXT NOT NULL,
  "license_number" VARCHAR(50),
  "address" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "bank_name" VARCHAR(100) NOT NULL,
  "account_number" VARCHAR(50) NOT NULL,
  "account_name" VARCHAR(100) NOT NULL,
  "commission_rate" DECIMAL(5,4) DEFAULT 0.05,
  "is_approved" BOOLEAN DEFAULT false,
  "approved_at" TIMESTAMP,
  "approved_by" UUID
);

-- ============================================
-- 5. جدول المناديب (Drivers)
-- ============================================

CREATE TABLE "drivers" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "vehicle_type" VARCHAR(50) NOT NULL,
  "vehicle_number" VARCHAR(50),
  "id_image_url" TEXT NOT NULL,
  "license_image_url" TEXT,
  "bank_name" VARCHAR(100) NOT NULL,
  "account_number" VARCHAR(50) NOT NULL,
  "account_name" VARCHAR(100) NOT NULL,
  "is_approved" BOOLEAN DEFAULT false,
  "is_available" BOOLEAN DEFAULT false,
  "current_lat" DOUBLE PRECISION,
  "current_lng" DOUBLE PRECISION,
  "last_location_at" TIMESTAMP
);

-- ============================================
-- 6. جدول المنتجات (Products)
-- ============================================

CREATE TABLE "products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchant_id" UUID NOT NULL REFERENCES "merchants"("user_id") ON DELETE CASCADE,
  "name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10,2) NOT NULL,
  "image_url" TEXT,
  "category" VARCHAR(50) NOT NULL,
  "is_available" BOOLEAN DEFAULT true,
  "stock" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. جدول الطلبات (Orders)
-- ============================================

CREATE TABLE "orders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL REFERENCES "customers"("user_id"),
  "merchant_id" UUID NOT NULL REFERENCES "merchants"("user_id"),
  "driver_id" UUID REFERENCES "drivers"("user_id"),
  "status" "OrderStatus" DEFAULT 'PENDING',
  "subtotal" DECIMAL(10,2) NOT NULL,
  "delivery_fee" DECIMAL(10,2) DEFAULT 0,
  "platform_fee" DECIMAL(10,2) NOT NULL,
  "total_amount" DECIMAL(10,2) NOT NULL,
  "payment_method" "PaymentMethod" NOT NULL,
  "is_paid" BOOLEAN DEFAULT false,
  "paid_at" TIMESTAMP,
  "delivery_address" TEXT NOT NULL,
  "delivery_lat" DOUBLE PRECISION NOT NULL,
  "delivery_lng" DOUBLE PRECISION NOT NULL,
  "accepted_at" TIMESTAMP,
  "prepared_at" TIMESTAMP,
  "picked_up_at" TIMESTAMP,
  "delivered_at" TIMESTAMP,
  "cancelled_at" TIMESTAMP,
  "cancel_reason" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. جدول عناصر الطلب (Order Items)
-- ============================================

CREATE TABLE "order_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_id" UUID NOT NULL REFERENCES "products"("id"),
  "quantity" INTEGER NOT NULL,
  "unit_price" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL
);

-- ============================================
-- 9. جدول المدفوعات (Payments)
-- ============================================

CREATE TABLE "payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID UNIQUE NOT NULL REFERENCES "orders"("id"),
  "total_amount" DECIMAL(10,2) NOT NULL,
  "platform_fee" DECIMAL(10,2) NOT NULL,
  "driver_fee" DECIMAL(10,2) NOT NULL,
  "merchant_net" DECIMAL(10,2) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "transaction_id" VARCHAR(100),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. جدول السحوبات (Withdrawals)
-- ============================================

CREATE TABLE "withdrawals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "driver_id" UUID NOT NULL REFERENCES "drivers"("user_id"),
  "amount" DECIMAL(10,2) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "requested_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP,
  "processed_by" UUID,
  "notes" TEXT
);

-- ============================================
-- 11. جدول التقييمات (Ratings)
-- ============================================

CREATE TABLE "ratings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL REFERENCES "orders"("id"),
  "from_user_id" UUID NOT NULL,
  "to_user_id" UUID NOT NULL,
  "role" VARCHAR(50) NOT NULL,
  "rating" INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  "comment" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 12. جدول الإشعارات (Notifications)
-- ============================================

CREATE TABLE "notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "title" VARCHAR(200) NOT NULL,
  "body" TEXT NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "data" JSONB,
  "is_read" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 13. جدول المدراء (Admins)
-- ============================================

CREATE TABLE "admins" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "permissions" JSONB NOT NULL
);

-- ============================================
-- 14. إنشاء Indexes لتحسين الأداء
-- ============================================

CREATE INDEX idx_users_phone ON "users"("phone");
CREATE INDEX idx_users_role ON "users"("role");
CREATE INDEX idx_products_merchant ON "products"("merchant_id");
CREATE INDEX idx_products_category ON "products"("category");
CREATE INDEX idx_orders_customer ON "orders"("customer_id");
CREATE INDEX idx_orders_merchant ON "orders"("merchant_id");
CREATE INDEX idx_orders_driver ON "orders"("driver_id");
CREATE INDEX idx_orders_status ON "orders"("status");
CREATE INDEX idx_notifications_user ON "notifications"("user_id");
CREATE INDEX idx_notifications_read ON "notifications"("is_read");

-- ============================================
-- 15. إنشاء Triggers لتحديث updated_at تلقائياً
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON "products"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON "orders"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 16. إنشاء مستخدم Admin افتراضي (اختياري)
-- ============================================
-- كلمة المرور: Admin@123 (مشفرة بـ bcrypt)

INSERT INTO "users" ("phone", "password_hash", "role", "full_name", "email")
VALUES (
  '+967777777777',
  '$2b$10$YourHashedPasswordHere',
  'SUPER_ADMIN',
  'Super Admin',
  'admin@cashline.app'
);

-- ============================================
-- ✅ تم إنشاء جميع الجداول بنجاح!
-- ============================================

-- للتحقق من الجداول المنشأة:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
