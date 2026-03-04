const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabaseSizes() {
    console.log('🔍 Checking Database Table Sizes...\n');

    try {
        // Query to get table sizes
        const result = await prisma.$queryRaw`
            SELECT 
                table_name,
                pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS total_size,
                pg_size_pretty(pg_relation_size(quote_ident(table_name))) AS data_size,
                pg_total_relation_size(quote_ident(table_name)) AS size_bytes
            FROM information_schema.tables
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
            LIMIT 20;
        `;

        console.log('📊 Table Sizes (Top 20):');
        console.log('─'.repeat(80));
        console.log('Table Name'.padEnd(30), 'Total Size'.padEnd(15), 'Data Size'.padEnd(15), 'Size (Bytes)');
        console.log('─'.repeat(80));

        result.forEach(row => {
            console.log(
                row.table_name.padEnd(30),
                row.total_size.padEnd(15),
                row.data_size.padEnd(15),
                row.size_bytes.toString()
            );
        });

        console.log('─'.repeat(80));

        // Get PostgreSQL version
        const versionResult = await prisma.$queryRaw`SELECT version();`;
        console.log('\n📌 PostgreSQL Version:');
        console.log(versionResult[0].version);

        // Get Prisma version
        const prismaVersion = require('../package.json').dependencies['@prisma/client'];
        console.log('\n📦 Prisma Client Version:', prismaVersion);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabaseSizes();
