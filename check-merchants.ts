
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const merchants = await prisma.merchant.findMany({
            include: {
                user: true
            }
        });

        console.log('Merchants found:', merchants.length);
        if (merchants.length > 0) {
            console.log('First merchant:', JSON.stringify(merchants[0], null, 2));
        } else {
            console.log("No merchants found.");
        }

        const m001 = await prisma.merchant.findUnique({
            where: { userId: 'M001' }
        });
        console.log('Is M001 present?', !!m001);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
