import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    const driverId = '261df07b-828c-41eb-aa8c-262a30c96c52';
    const wallet = await prisma.wallet.findUnique({ where: { userId: driverId } });
    console.log('Driver Balance:', wallet?.balance.toString());
}

check().finally(() => prisma.$disconnect());
