import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../src/services/encryption.service';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const encryption = new EncryptionService();

export async function migrateBankAccounts() {
    console.log('🚀 Starting Bank Account Migration...');

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // 1. معالجة التجار (Merchants)
    const merchants = await prisma.merchant.findMany({
        where: {
            bankName: { not: '' },
            accountNumber: { not: '' }
        },
        include: {
            user: true
        }
    });

    console.log(`📊 Found ${merchants.length} merchants with bank data`);

    for (const merchant of merchants) {
        try {
            const existing = await prisma.bankAccount.findFirst({
                where: { userId: merchant.userId, accountType: 'MERCHANT' }
            });

            if (existing) {
                console.log(`⏭️  Skipping Merchant ${merchant.userId}: Already migrated`);
                skippedCount++;
                continue;
            }

            // ✅ تشفير البيانات قبل الحفظ
            const encryptedNumber = encryption.encrypt(merchant.accountNumber);
            const encryptedName = encryption.encrypt(merchant.accountName || merchant.user.fullName);

            await prisma.bankAccount.create({
                data: {
                    userId: merchant.userId,
                    accountType: 'MERCHANT',
                    bankName: merchant.bankName,
                    accountNumberEncrypted: encryptedNumber,
                    accountNameEncrypted: encryptedName,
                    isDefault: true,
                    isVerified: true
                }
            });

            console.log(`✅ Migrated merchant: ${merchant.userId}`);
            successCount++;
        } catch (error: any) {
            console.error(`❌ Failed to migrate merchant ${merchant.userId}:`, error.message);
            errorCount++;
        }
    }

    // 2. معالجة السائقين (Drivers)
    const drivers = await prisma.driver.findMany({
        where: {
            bankName: { not: '' },
            accountNumber: { not: '' }
        },
        include: {
            user: true
        }
    });

    console.log(`📊 Found ${drivers.length} drivers with bank data`);

    for (const driver of drivers) {
        try {
            const existing = await prisma.bankAccount.findFirst({
                where: { userId: driver.userId, accountType: 'DRIVER' }
            });

            if (existing) {
                console.log(`⏭️  Skipping Driver ${driver.userId}: Already migrated`);
                skippedCount++;
                continue;
            }

            const encryptedNumber = encryption.encrypt(driver.accountNumber);
            const encryptedName = encryption.encrypt(driver.accountName || driver.user.fullName);

            await prisma.bankAccount.create({
                data: {
                    userId: driver.userId,
                    accountType: 'DRIVER',
                    bankName: driver.bankName,
                    accountNumberEncrypted: encryptedNumber,
                    accountNameEncrypted: encryptedName,
                    isDefault: true,
                    isVerified: true
                }
            });

            console.log(`✅ Migrated driver: ${driver.userId}`);
            successCount++;
        } catch (error: any) {
            console.error(`❌ Failed to migrate driver ${driver.userId}:`, error.message);
            errorCount++;
        }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`✅ Success: ${successCount}`);
    console.log(`⏭️  Skipped (already exists): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    const totalNewAccounts = await prisma.bankAccount.count();
    console.log(`\n🔍 Total BankAccounts in DB: ${totalNewAccounts}`);
}

// Only run if called directly
if (require.main === module) {
    migrateBankAccounts()
        .catch((e) => {
            console.error('Fatal error:', e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
