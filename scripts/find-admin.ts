import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAdmin() {
    const admin = await prisma.admin.findFirst();
    console.log('Admin found:', admin ? admin.email : 'NONE');
}

findAdmin().finally(() => prisma.$disconnect());
