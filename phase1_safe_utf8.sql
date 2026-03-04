-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'MERCHANT', 'FAMILY_PRODUCER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'KCB_BANK', 'JEEB_WALLET');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('CREDIT', 'DEBIT', 'HOLD', 'RELEASE', 'REFUND', 'COMMISSION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "user_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "building" TEXT,
    "floor" TEXT,
    "apartment" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "description" TEXT,
    "id_image_url" TEXT NOT NULL,
    "license_number" TEXT,
    "license_image_url" TEXT,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "commission_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "user_id" TEXT NOT NULL,
    "vehicle_type" TEXT NOT NULL,
    "vehicle_number" TEXT,
    "vehicle_image_url" TEXT,
    "id_image_url" TEXT NOT NULL,
    "license_image_url" TEXT,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_available" BOOLEAN NOT NULL DEFAULT false,
    "current_lat" DOUBLE PRECISION,
    "current_lng" DOUBLE PRECISION,
    "last_location_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "image_url" TEXT,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '┘é╪╖╪╣╪ر',
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'PENDING',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "address_id" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "platform_fee" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "delivery_address" TEXT NOT NULL,
    "delivery_lat" DOUBLE PRECISION NOT NULL,
    "delivery_lng" DOUBLE PRECISION NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "prepared_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "platform_fee" DECIMAL(10,2) NOT NULL,
    "driver_fee" DECIMAL(10,2) NOT NULL,
    "merchant_net" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "transaction_id" TEXT,
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "processed_by" TEXT,
    "notes" TEXT,
    "rejection_reason" TEXT,
    "wallet_transaction_id" TEXT,
    "bank_account_id" TEXT,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "user_id" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "account_number_encrypted" TEXT NOT NULL,
    "account_name_encrypted" TEXT NOT NULL,
    "iban_encrypted" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hold_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'YER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "transaction_type" "WalletTxType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_before" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT,
    "address" TEXT NOT NULL,
    "lat" DECIMAL(10,8),
    "lng" DECIMAL(11,8),
    "building" TEXT,
    "floor" TEXT,
    "apartment" TEXT,
    "additional_instructions" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "performed_by" TEXT,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "previous_status" "OrderStatus",
    "new_status" "OrderStatus" NOT NULL,
    "changed_by" TEXT,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");

-- CreateIndex
CREATE INDEX "merchants_deleted_at_idx" ON "merchants"("deleted_at");

-- CreateIndex
CREATE INDEX "merchants_is_approved_idx" ON "merchants"("is_approved");

-- CreateIndex
CREATE INDEX "drivers_deleted_at_idx" ON "drivers"("deleted_at");

-- CreateIndex
CREATE INDEX "drivers_is_available_idx" ON "drivers"("is_available");

-- CreateIndex
CREATE INDEX "drivers_current_lat_current_lng_idx" ON "drivers"("current_lat", "current_lng");

-- CreateIndex
CREATE INDEX "products_deleted_at_idx" ON "products"("deleted_at");

-- CreateIndex
CREATE INDEX "products_merchant_id_idx" ON "products"("merchant_id");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_is_available_deleted_at_idx" ON "products"("is_available", "deleted_at");

-- CreateIndex
CREATE INDEX "orders_deleted_at_idx" ON "orders"("deleted_at");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_merchant_id_idx" ON "orders"("merchant_id");

-- CreateIndex
CREATE INDEX "orders_driver_id_idx" ON "orders"("driver_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE INDEX "withdrawals_driver_id_idx" ON "withdrawals"("driver_id");

-- CreateIndex
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

-- CreateIndex
CREATE INDEX "withdrawals_requested_at_idx" ON "withdrawals"("requested_at");

-- CreateIndex
CREATE INDEX "ratings_from_user_id_idx" ON "ratings"("from_user_id");

-- CreateIndex
CREATE INDEX "ratings_to_user_id_idx" ON "ratings"("to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_order_id_from_user_id_to_user_id_key" ON "ratings"("order_id", "from_user_id", "to_user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "bank_accounts_user_id_idx" ON "bank_accounts"("user_id");

-- CreateIndex
CREATE INDEX "bank_accounts_account_type_idx" ON "bank_accounts"("account_type");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_user_id_is_default_key" ON "bank_accounts"("user_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_type_reference_id_idx" ON "wallet_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE INDEX "addresses_is_default_idx" ON "addresses"("is_default");

-- CreateIndex
CREATE INDEX "addresses_is_active_idx" ON "addresses"("is_active");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_performed_at_idx" ON "audit_logs"("performed_at");

-- CreateIndex
CREATE INDEX "audit_logs_performed_by_idx" ON "audit_logs"("performed_by");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_created_at_idx" ON "order_status_history"("created_at");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

