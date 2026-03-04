const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getInfrastructureReport() {
    console.log('🔍 CashLine Database Infrastructure Report');
    console.log('='.repeat(80));
    console.log('Generated:', new Date().toISOString());
    console.log('='.repeat(80));

    try {
        // 1. PostgreSQL Version (Condition D)
        console.log('\n📌 CONDITION D: PostgreSQL Version');
        console.log('-'.repeat(80));
        const versionResult = await prisma.$queryRaw`SELECT version();`;
        const version = versionResult[0].version;
        console.log(version);

        // Extract major version
        const versionMatch = version.match(/PostgreSQL (\d+)\.(\d+)/);
        if (versionMatch) {
            const majorVersion = parseInt(versionMatch[1]);
            const minorVersion = parseInt(versionMatch[2]);
            console.log(`\n✅ Major Version: ${majorVersion}.${minorVersion}`);
            if (majorVersion >= 12) {
                console.log('✅ PASS: Version ≥ 12.0 (CONCURRENTLY supported)');
            } else {
                console.log('❌ FAIL: Version < 12.0 (CONCURRENTLY NOT supported)');
            }
        }

        // 2. Table Sizes (Condition A)
        console.log('\n\n📊 CONDITION A: Database Sizing Report');
        console.log('-'.repeat(80));
        const sizeResult = await prisma.$queryRaw`
            SELECT 
                tablename,
                pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
                pg_total_relation_size(tablename::regclass) as size_bytes
            FROM pg_tables 
            WHERE schemaname='public' 
            AND tablename IN ('orders', 'order_items', 'products', 'users', 'merchants', 'drivers', 'customers')
            ORDER BY size_bytes DESC;
        `;

        console.log('Table Name'.padEnd(20), 'Size (Pretty)'.padEnd(15), 'Size (Bytes)'.padEnd(15), 'Risk Level');
        console.log('-'.repeat(80));

        sizeResult.forEach(row => {
            const sizeGB = row.size_bytes / (1024 * 1024 * 1024);
            let riskLevel = '✅ LOW';
            if (sizeGB > 1) {
                riskLevel = '🚨 HIGH (>1GB - Online Schema Change Required)';
            } else if (sizeGB > 0.5) {
                riskLevel = '⚠️ MEDIUM (>500MB - Monitor Locks)';
            }

            console.log(
                row.tablename.padEnd(20),
                row.size.padEnd(15),
                row.size_bytes.toString().padEnd(15),
                riskLevel
            );
        });

        // 3. Total Database Size
        console.log('\n\n📦 Total Database Size');
        console.log('-'.repeat(80));
        const dbSizeResult = await prisma.$queryRaw`
            SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;
        `;
        console.log('Total:', dbSizeResult[0].db_size);

        // 4. Connection Info
        console.log('\n\n🔗 Connection Info');
        console.log('-'.repeat(80));
        const connResult = await prisma.$queryRaw`
            SELECT 
                current_database() as database,
                current_user as user,
                inet_server_addr() as server_ip,
                inet_server_port() as server_port;
        `;
        console.log('Database:', connResult[0].database);
        console.log('User:', connResult[0].user);
        console.log('Server:', connResult[0].server_ip, ':', connResult[0].server_port);

        console.log('\n' + '='.repeat(80));
        console.log('✅ Report Complete');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n❌ Error generating report:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

getInfrastructureReport();
