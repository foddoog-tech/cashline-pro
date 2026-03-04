
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const constraints = await prisma.$queryRawUnsafe(`
      SELECT conname, convalidated 
      FROM pg_constraint 
      WHERE contype = 'f'
    `);
        console.log('Foreign Keys Validation Status:');
        console.log('CONSTRAINTS_JSON:' + JSON.stringify(constraints));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
