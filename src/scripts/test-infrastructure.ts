import 'dotenv/config';
import prisma from '../lib/prisma';
import { EncryptionService } from '../services/encryption.service';
import { WalletService } from '../services/wallet.service';
import { AuditService } from '../services/audit.service';

async function main() {
    console.log('🚀 Starting Infrastructure Test...');

    // 1. Test Encryption
    console.log('\n🔐 Testing Encryption Service...');
    const encryptionService = new EncryptionService();
    const originalText = 'SuperSecret123';
    const encrypted = encryptionService.encrypt(originalText);
    const decrypted = encryptionService.decrypt(encrypted);

    if (originalText === decrypted) {
        console.log('✅ Encryption Test Passed');
    } else {
        console.error('❌ Encryption Test Failed');
        console.log({ originalText, decrypted });
    }

    // 2. Test Soft Delete
    console.log('\n🗑️ Testing Soft Delete Middleware...');
    // Create temporary user
    const tempUser = await prisma.user.create({
        data: {
            phone: `test_${Date.now()}`,
            passwordHash: 'hash',
            role: 'CUSTOMER',
            fullName: 'Test User'
        }
    });
    console.log(`Created user: ${tempUser.id}`);

    // Delete user
    await prisma.user.delete({
        where: { id: tempUser.id }
    });
    console.log('Deleted user (should be soft deleted)');

    // Verify soft delete
    // Raw query to check deletedAt because middleware filters it out
    // But middleware filters 'findUnique' too.
    // To verify, we can use prisma.$queryRaw or just check if findUnique returns null.
    const findResult = await prisma.user.findUnique({
        where: { id: tempUser.id }
    });

    if (findResult === null) {
        console.log('✅ Soft Delete Logic (Middleware Hiding): Passed');
    } else {
        console.error('❌ Soft Delete Logic (Middleware Hiding): Failed. User still visible.');
    }

    // Verify raw deletedAt not null
    const rawUser: any[] = await prisma.$queryRaw`SELECT deleted_at FROM users WHERE id = ${tempUser.id}`;
    if (rawUser[0]?.deleted_at) {
        console.log('✅ Soft Delete Database Check: Passed (deleted_at is set)');
    } else {
        console.error('❌ Soft Delete Database Check: Failed (deleted_at is null)');
    }

    // 3. Test Wallet Service
    console.log('\n💰 Testing Wallet Service...');
    // Create wallet for our test user (even if deleted, we can link logic, or create new user)
    // Let's create another user for wallet test to be clean
    const walletUser = await prisma.user.create({
        data: {
            phone: `wallet_${Date.now()}`,
            passwordHash: 'hash',
            role: 'DRIVER',
            fullName: 'Wallet User'
        }
    });

    await WalletService.createWallet(walletUser.id);
    await WalletService.credit(walletUser.id, 100, {
        description: 'Test Credit',
        referenceType: 'TEST',
        referenceId: '123'
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: walletUser.id } });
    if (wallet && Number(wallet.balance) === 100) {
        console.log('✅ Wallet Service Test Passed');
    } else {
        console.error('❌ Wallet Service Test Failed');
        console.log({ wallet });
    }

    // 4. Test Audit Service
    console.log('\n📝 Testing Audit Service...');
    const log = await AuditService.log({
        tableName: 'users',
        recordId: walletUser.id,
        action: 'INSERT',
        oldData: null,
        newData: { ...walletUser },
        performedBy: 'system',
        ipAddress: '127.0.0.1'
    });

    if (log && log.id) {
        console.log('✅ Audit Service Test Passed');
    } else {
        console.error('❌ Audit Service Test Failed');
    }

    console.log('\n🎉 All Infrastructure Tests Completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
