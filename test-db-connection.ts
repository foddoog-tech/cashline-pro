import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
    try {
        console.log('🔄 Testing database connection...');
        console.log('📍 Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

        // Test connection
        await prisma.$connect();
        console.log('✅ Successfully connected to database!');

        // Test query
        const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
        console.log('⏰ Database time:', result);

        // Check if tables exist
        const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
        console.log('📊 Existing tables:', tables);

    } catch (error) {
        console.error('❌ Database connection failed:');
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
