import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
    try {
        const merchants = await prisma.merchant.findMany();
        console.log('Total Merchants:', merchants.length);
        if (merchants.length > 0) {
            console.log('Sample Merchant Bank Data:', {
                bankName: merchants[0].bankName,
                accountNumber: merchants[0].accountNumber
            });
        }

        const drivers = await prisma.driver.findMany();
        console.log('Total Drivers:', drivers.length);
        if (drivers.length > 0) {
            console.log('Sample Driver Bank Data:', {
                bankName: drivers[0].bankName,
                accountNumber: drivers[0].accountNumber
            });
        }
    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
