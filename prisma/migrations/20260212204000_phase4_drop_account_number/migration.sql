-- prisma/migrations/20260212204000_phase4_drop_account_number/migration.sql
-- ⚠️ فقط account_number، bank_name و account_name يبقيان كـ Backup
ALTER TABLE "merchants" DROP COLUMN IF EXISTS "account_number";
ALTER TABLE "drivers" DROP COLUMN IF EXISTS "account_number";
