-- ============================================
-- Phase 1: Enterprise Schema Extensions
-- Safe for small datasets (< 1GB)
-- Tables affected: All existing tables are small (64KB avg)
-- ============================================

-- ============================================
-- 1. NEW TABLES (Enterprise Features)
-- ============================================

CREATE TABLE IF NOT EXISTS "bank_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_type" TEXT NOT NULL, -- MERCHANT, DRIVER, ADMIN
    "bank_name" TEXT NOT NULL,
    "account_number_encrypted" TEXT NOT NULL,
    "account_name_encrypted" TEXT NOT NULL,
    "iban_encrypted" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "hold_balance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'YER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wallets_user_id_key" ON "wallets"("user_id");

CREATE TABLE IF NOT EXISTS "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL, -- CREDIT, DEBIT, HOLD, RELEASE, REFUND, COMMISSION
    "amount" DECIMAL(12, 2) NOT NULL,
    "balance_before" DECIMAL(12, 2) NOT NULL,
    "balance_after" DECIMAL(12, 2) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    "old_data" JSONB,
    "new_data" JSONB,
    "performed_by" TEXT,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT,
    "address" TEXT NOT NULL,
    "lat" DECIMAL(10, 8),
    "lng" DECIMAL(11, 8),
    "building" TEXT,
    "floor" TEXT,
    "apartment" TEXT,
    "additional_instructions" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "changed_by" TEXT,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- 2. EXTEND EXISTING TABLES (Additive Only)
-- ============================================

-- Users: Soft Delete & Verification
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified" BOOLEAN NOT NULL DEFAULT false;

-- Soft Delete for main entities
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Orders: Address relation (nullable, no FK constraint yet)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_id" TEXT;

-- Withdrawals: Enhanced tracking
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "wallet_transaction_id" TEXT;

-- Payments: Enhanced tracking
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "failure_reason" TEXT;

-- ============================================
-- 3. INDEXES (Performance)
-- ============================================

-- Soft Delete indexes (for filtering active records)
CREATE INDEX IF NOT EXISTS "idx_users_deleted" ON "users"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_customers_deleted" ON "customers"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_merchants_deleted" ON "merchants"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_drivers_deleted" ON "drivers"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_products_deleted" ON "products"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_orders_deleted" ON "orders"("deleted_at");

-- Existing table optimization
CREATE INDEX IF NOT EXISTS "idx_users_phone" ON "users"("phone");
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role");
CREATE INDEX IF NOT EXISTS "idx_merchants_approved" ON "merchants"("is_approved");
CREATE INDEX IF NOT EXISTS "idx_drivers_available" ON "drivers"("is_available");
CREATE INDEX IF NOT EXISTS "idx_drivers_location" ON "drivers"("current_lat", "current_lng");
CREATE INDEX IF NOT EXISTS "idx_products_merchant" ON "products"("merchant_id");
CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products"("category");
CREATE INDEX IF NOT EXISTS "idx_products_status" ON "products"("status");
CREATE INDEX IF NOT EXISTS "idx_orders_customer" ON "orders"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_orders_merchant" ON "orders"("merchant_id");
CREATE INDEX IF NOT EXISTS "idx_orders_driver" ON "orders"("driver_id");
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "idx_orders_created" ON "orders"("created_at");

-- New tables indexes
CREATE INDEX IF NOT EXISTS "idx_bank_accounts_user" ON "bank_accounts"("user_id");
CREATE INDEX IF NOT EXISTS "idx_wallet_transactions_wallet" ON "wallet_transactions"("wallet_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_table_record" ON "audit_logs"("table_name", "record_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_performed" ON "audit_logs"("performed_at");
CREATE INDEX IF NOT EXISTS "idx_addresses_user" ON "addresses"("user_id");
CREATE INDEX IF NOT EXISTS "idx_order_history_order" ON "order_status_history"("order_id");

-- ============================================
-- 4. FOREIGN KEYS (Phase 3 Only - Not included here)
-- Warning: FKs on existing tables are intentionally omitted
-- to avoid locking during migration.
-- ============================================
