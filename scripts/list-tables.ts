import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listAllTables() {
    try {
        const tables: any = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
        console.log('All tables:', tables.map((t: any) => t.table_name));
    } catch (error: any) {
        console.error('Error listing tables:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

listAllTables();
