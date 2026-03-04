import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getDriver() {
    const driver = await prisma.user.findFirst({
        where: { fullName: 'Test Driver' },
        select: { id: true }
    });
    console.log('Driver ID:', driver?.id);
}

getDriver().finally(() => prisma.$disconnect());
