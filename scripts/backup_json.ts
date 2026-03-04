
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function backup() {
    console.log('📦 Starting Database Backup (JSON Mode)...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups', timestamp);

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    try {
        // 1. Users
        console.log('Saving Users...');
        const users = await prisma.user.findMany();
        fs.writeFileSync(path.join(backupDir, 'users.json'), JSON.stringify(users, null, 2));

        // 2. Orders
        console.log('Saving Orders...');
        const orders = await prisma.order.findMany();
        fs.writeFileSync(path.join(backupDir, 'orders.json'), JSON.stringify(orders, null, 2));

        // 3. Wallets & Transactions (Critical)
        console.log('Saving Financial Data...');
        const wallets = await prisma.wallet.findMany();
        fs.writeFileSync(path.join(backupDir, 'wallets.json'), JSON.stringify(wallets, null, 2));

        const transactions = await prisma.walletTransaction.findMany();
        fs.writeFileSync(path.join(backupDir, 'transactions.json'), JSON.stringify(transactions, null, 2));

        // 4. Merchants & Drivers
        console.log('Saving Profiles...');
        const merchants = await prisma.merchant.findMany();
        fs.writeFileSync(path.join(backupDir, 'merchants.json'), JSON.stringify(merchants, null, 2));

        const drivers = await prisma.driver.findMany();
        fs.writeFileSync(path.join(backupDir, 'drivers.json'), JSON.stringify(drivers, null, 2));

        console.log(`✅ Backup completed successfully in: ${backupDir}`);

    } catch (error) {
        console.error('❌ Backup failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

backup();
