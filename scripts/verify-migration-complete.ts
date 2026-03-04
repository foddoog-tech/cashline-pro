import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    console.log('--- Phase 4: Pre-Flight Migration Verification ---');

    // 1. Check Merchants
    const merchants = await prisma.merchant.findMany({
        select: {
            userId: true,
            bankName: true,
            accountNumber: true
        }
    });

    const merchantBankAccounts = await prisma.bankAccount.findMany({
        where: { accountType: 'MERCHANT' }
    });

    const migratedMerchants = merchants.filter(m =>
        merchantBankAccounts.some(ba => ba.userId === m.userId)
    );

    console.log(`Merchants: ${migratedMerchants.length}/${merchants.length} migrated.`);

    // 2. Check Drivers
    const drivers = await prisma.driver.findMany({
        select: {
            userId: true,
            bankName: true,
            accountNumber: true
        }
    });

    const driverBankAccounts = await prisma.bankAccount.findMany({
        where: { accountType: 'DRIVER' }
    });

    const migratedDrivers = drivers.filter(d =>
        driverBankAccounts.some(ba => ba.userId === d.userId)
    );

    console.log(`Drivers: ${migratedDrivers.length}/${drivers.length} migrated.`);

    // 3. Check for specific anomalies
    const pendingMerchants = merchants.filter(m =>
        !merchantBankAccounts.some(ba => ba.userId === m.userId) && m.accountNumber
    );

    if (pendingMerchants.length > 0) {
        console.warn('⚠️ Warning: Some merchants still have legacy data but no bank_account record:');
        pendingMerchants.forEach(p => console.log(` - ID: ${p.userId}`));
    }

    const pendingDrivers = drivers.filter(d =>
        !driverBankAccounts.some(ba => ba.userId === d.userId) && d.accountNumber
    );

    if (pendingDrivers.length > 0) {
        console.warn('⚠️ Warning: Some drivers still have legacy data but no bank_account record:');
        pendingDrivers.forEach(p => console.log(` - ID: ${p.userId}`));
    }

    if (pendingMerchants.length === 0 && pendingDrivers.length === 0) {
        console.log('✅ All merchants and drivers successfully migrated (100%).');
    } else {
        console.error('❌ MIGRATION INCOMPLETE! Do not proceed to deletion.');
    }

    // 4. SQL-like count comparison
    const legacyCount = merchants.length + drivers.length;
    const encryptedCount = merchantBankAccounts.length + driverBankAccounts.length;
    console.log(`Total legacy records: ${legacyCount}`);
    console.log(`Total encrypted records: ${encryptedCount}`);

    if (encryptedCount >= legacyCount) {
        console.log('✅ Count match/surplus verified.');
    } else {
        console.warn('⚠️ Count mismatch! Some users might be missing encrypted bank accounts.');
    }

}

verify().finally(() => prisma.$disconnect());
