import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getId() {
    const user = await prisma.user.findUnique({ where: { phone: '+967799999999' } });
    console.log('Legacy User ID:', user?.id);
}

getId().finally(() => prisma.$disconnect());
