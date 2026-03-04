import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTables() {
    try {
        const tables: any = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('wallets', 'bank_accounts', 'audit_logs');
    `;
        console.log('Existing tables:', tables.map((t: any) => t.table_name));
    } catch (error: any) {
        console.error('Error checking tables:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkTables();
