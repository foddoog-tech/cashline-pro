import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listModels() {
    console.log('--- Prisma Client Models ---');
    const prismaAny = prisma as any;
    for (const key of Object.getOwnPropertyNames(prismaAny)) {
        if (typeof prismaAny[key] === 'object' && prismaAny[key] !== null) {
            // Models are usually objects on the prisma client
            console.log('Found property:', key);
        }
    }
}

listModels().finally(() => prisma.$disconnect());
