
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const migrations = await prisma.$queryRawUnsafe('SELECT migration_name FROM _prisma_migrations');
        console.log('Applied Migrations:', migrations);
    } catch (e) {
        const error = e as Error;
        console.error('Error checking migrations:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
