import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    try {
        // Check if accountNumber exists in metadata
        const merchant: any = await prisma.$queryRaw`SELECT * FROM merchants LIMIT 1`;
        console.log('Merchant Columns:', Object.keys(merchant[0] || {}).join(', '));
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

check().finally(() => prisma.$disconnect());
