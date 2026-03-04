import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function runGatesCheck() {
    let output = '';
    const log = (msg: string) => {
        console.log(msg);
        output += msg + '\n';
    };

    log('=== Pre-Execution Gates Report ===');
    log(`Date: ${new Date().toISOString().replace('T', ' ').substring(0, 16)}`);
    log('Executed by: Antigravity AI (Backend Lead)\n');

    try {
        // [2] PostgreSQL Version
        const versionResult: any = await prisma.$queryRaw`SELECT version();`;
        const version = versionResult[0].version;
        log('[2] PostgreSQL Version:');
        log(`- Result: ${version}`);

        const versionMatch = version.match(/PostgreSQL (\d+)\./);
        const majorVersion = versionMatch ? parseInt(versionMatch[1]) : 0;

        if (majorVersion >= 12) {
            log('- Status: PASS (≥ 12.0)');
        } else {
            log('- Status: FAIL (< 12.0)');
        }

        log('\n[1] Table Sizing:');
        const tables = ['orders', 'order_items', 'products', 'users', 'merchants', 'drivers'];

        for (const table of tables) {
            try {
                const sizeResult: any = await prisma.$queryRawUnsafe(`
          SELECT 
            pg_size_pretty(pg_total_relation_size('public."${table}"')) as size,
            pg_total_relation_size('public."${table}"') as size_bytes
        `);
                const size = sizeResult[0].size;
                const bytes = Number(sizeResult[0].size_bytes);

                let status = 'SAFE';
                if (bytes > 1024 * 1024 * 1024) status = 'OVER 1GB';
                else if (bytes > 500 * 1024 * 1024) status = 'LARGE (500MB-1GB)';

                log(`- ${table}: ${size} (${status}${status === 'SAFE' ? ' - Under 1GB' : ''})`);
            } catch (e: any) {
                log(`- ${table}: NOT FOUND or ERROR`);
            }
        }

        log('\n[3] Backup:');
        log('- Status: PENDING (pg_dump not found in PATH)');
        log('- Note: Please run the backup command manually or ensure pg_dump is in PATH.');

        log('\n=== GO/NO-GO Decision ===');
        log('Status: WAITING FOR BACKUP & USER REVIEW');

        fs.writeFileSync('gates-report.txt', output);

    } catch (error) {
        console.error('❌ Error executing gates check:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runGatesCheck();
