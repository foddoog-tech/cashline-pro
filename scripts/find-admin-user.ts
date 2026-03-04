import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function findAdmin() {
    const adminUser = await prisma.user.findFirst({
        where: { role: UserRole.ADMIN }
    });
    console.log('Admin User phone:', adminUser ? adminUser.phone : 'NONE');
}

findAdmin().finally(() => prisma.$disconnect());
