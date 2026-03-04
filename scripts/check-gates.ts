import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGates() {
    console.log('🚧 Starting Pre-Execution Gates Check...\n');

    try {
        // 1. Check PostgreSQL Version
        const versionResult: any = await prisma.$queryRaw`SELECT version();`;
        const version = versionResult[0].version;
        console.log(`✅ PostgreSQL Version: ${version}`);

        // Simple check for version 12+
        if (!version.includes('PostgreSQL 12') && !version.includes('PostgreSQL 13') && !version.includes('PostgreSQL 14') && !version.includes('PostgreSQL 15') && !version.includes('PostgreSQL 16')) {
            console.warn('⚠️  Warning: Version might be older than 12. Please verify manually.');
        } else {
            console.log('✅ Version Requirement Met (>= 12.0)');
        }

        console.log('\n---------------------------------------------------\n');

        // 2. Check Table Sizes
        const tables = ['orders', 'order_items', 'products', 'users', 'merchants', 'drivers'];
        console.log('📊 Database Sizing Report:');

        for (const table of tables) {
            try {
                // Note: Relation name usually matches table name in public schema
                const sizeResult: any = await prisma.$queryRawUnsafe(`SELECT pg_size_pretty(pg_total_relation_size('${table}')) as size, pg_total_relation_size('${table}') as raw_size;`);
                const size = sizeResult[0].size;
                const rawSize = Number(sizeResult[0].raw_size);

                const isSafe = rawSize < 1024 * 1024 * 1024; // 1GB
                const statusIcon = isSafe ? '✅' : '❌';

                console.log(`${statusIcon} Table: ${table.padEnd(15)} | Size: ${size.padEnd(10)} | Safe (<1GB): ${isSafe}`);

                if (!isSafe) {
                    console.error(`!!!! CRITICAL: Table ${table} exceeds 1GB limit. Use pg-online-schema-change !!!!`);
                }
            } catch (e) {
                console.log(`⚠️  Could not check size for table '${table}' (might not exist yet or permission issue).`);
            }
        }

        console.log('\n---------------------------------------------------\n');
        console.log('🏁 Gates Check Complete.');

    } catch (error) {
        console.error('❌ Error executing gates check:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkGates();
