import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../src/services/encryption.service';

const prisma = new PrismaClient();
const encryption = new EncryptionService();

async function verifyPrismaClient() {
    console.log('--- Verifying Prisma Client Updates ---');

    try {
        // 1. Check if bankAccount exists on prisma
        const bankAccountCount = await (prisma as any).bankAccount.count();
        console.log('✅ bankAccount model exists in Prisma Client. Count:', bankAccountCount);

        // 2. Check if wallet exists
        const walletCount = await (prisma as any).wallet.count();
        console.log('✅ wallet model exists in Prisma Client. Count:', walletCount);

        // 3. Test decryption on real data (using the first bank account if any)
        const sample = await (prisma as any).bankAccount.findFirst();
        if (sample) {
            const decrypted = encryption.decrypt(sample.accountNumberEncrypted);
            console.log('✅ Decryption test passed. Decrypted number:', decrypted);
        } else {
            console.log('ℹ️ No bank accounts found for decryption test.');
        }

    } catch (error: any) {
        console.error('❌ Prisma Client Verification Failed:', error.message);
        if (error.message.includes('bankAccount')) {
            console.log('Suggestion: Run "npx prisma generate" and ensure the schema is updated.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

verifyPrismaClient();
