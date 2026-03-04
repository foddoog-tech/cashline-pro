import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getTestData() {
    const merchant = await prisma.user.findFirst({
        where: { fullName: 'Test Merchant' },
        select: { id: true, phone: true }
    });
    console.log('Merchant Info:', merchant);
}

getTestData().finally(() => prisma.$disconnect());
