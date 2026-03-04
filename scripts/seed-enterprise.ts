import { PrismaClient, UserRole } from '@prisma/client';
import { EncryptionService } from '../src/services/encryption.service';
import { WalletService } from '../src/services/wallet.service';
import { migrateBankAccounts } from './migrate-bank-accounts';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const encryption = new EncryptionService();
const walletService = new WalletService();

async function seed() {
    console.log('🌱 Seeding Enterprise Data...');

    // Use a unique suffix to avoid "phone already exists" if re-run
    const suffix = Date.now().toString().slice(-4);

    // 1. إنشاء مستخدمين (Users)
    const merchantUser = await prisma.user.create({
        data: {
            phone: `+967700000${suffix}1`,
            passwordHash: '$2b$10$SampleHashForTesting1234567890',
            role: UserRole.MERCHANT,
            fullName: 'Test Merchant',
            email: `merchant${suffix}@test.com`,
            isActive: true
        }
    });

    const driverUser = await prisma.user.create({
        data: {
            phone: `+967700000${suffix}2`,
            passwordHash: '$2b$10$SampleHashForTesting1234567890',
            role: UserRole.DRIVER,
            fullName: 'Test Driver',
            isActive: true
        }
    });

    console.log('✅ Created Users:', { merchant: merchantUser.id, driver: driverUser.id });

    // 2. إنشاء تاجر مع بيانات بنكية (لاختبار Migration)
    await prisma.merchant.create({
        data: {
            userId: merchantUser.id,
            type: 'MERCHANT',
            storeName: 'Test Store',
            address: 'Sanaa, Yemen',
            lat: 15.3694,
            lng: 44.1910,
            idImageUrl: 'sample_merchant_id.jpg',
            bankName: 'Yemen Bank',
            accountNumber: '1234567890123456',
            accountName: 'Test Merchant Account',
            isApproved: true
        }
    });

    // 3. إنشاء سائق مع بيانات بنكية
    await prisma.driver.create({
        data: {
            userId: driverUser.id,
            vehicleType: 'CAR',
            vehicleNumber: '12345-A',
            idImageUrl: 'sample_driver_id.jpg',
            bankName: 'KSB Bank',
            accountNumber: '9876543210987654',
            accountName: 'Test Driver Account',
            isApproved: true,
            isAvailable: true
        }
    });

    console.log('✅ Created Merchant & Driver with plain bank data');

    // 4. اختبار Migration Script (فعلياً هذه المرة)
    console.log('🏃 Running Migration Script...');
    await migrateBankAccounts();

    // 5. التحقق من التشفير (Decryption Verification)
    console.log('🔍 Verifying Encryption...');
    const bankAccount = await prisma.bankAccount.findFirst({
        where: { userId: merchantUser.id, accountType: 'MERCHANT' }
    });

    if (bankAccount) {
        const decryptedNumber = encryption.decrypt(bankAccount.accountNumberEncrypted);
        const decryptedName = encryption.decrypt(bankAccount.accountNameEncrypted);

        console.log('Decrypted Number:', decryptedNumber);
        console.log('Decrypted Name:', decryptedName);

        if (decryptedNumber === '1234567890123456') {
            console.log('✅ Encryption/Decryption: PASSED');
        } else {
            console.error('❌ Encryption mismatch!');
            process.exit(1);
        }
    } else {
        console.error('❌ Bank account not found after migration!');
        process.exit(1);
    }

    // 6. إنشاء محافظ واختبار العمليات المالية
    console.log('💰 Testing Wallet Operations...');

    await walletService.createWallet(merchantUser.id);
    await walletService.createWallet(driverUser.id);

    // اختبار Credit
    await walletService.credit(merchantUser.id, 5000, 'Initial deposit', { type: 'SEED', id: 'seed-1' });

    // اختبار Hold
    await walletService.hold(merchantUser.id, 1000, 'Order pending');

    // اختبار Debit
    // Note: Driver wallet balance is 0, so debit should fail if not credited first.
    // We will credit it first to see it working, then try a failing debit.
    await walletService.credit(driverUser.id, 3000, 'Earnings');
    await walletService.debit(driverUser.id, 2000, 'Withdrawal test');

    // التحقق من الأرصدة
    const merchantWallet = await walletService.getBalance(merchantUser.id);
    console.log('Merchant Balance:', merchantWallet);

    const driverWallet = await walletService.getBalance(driverUser.id);
    console.log('Driver Balance:', driverWallet);

    console.log('✅ Seed completed successfully');
}

seed()
    .catch((e) => {
        console.error('❌ Seed Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
