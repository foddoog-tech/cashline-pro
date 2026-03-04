import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createWithdrawal() {
    const driverId = '261df07b-828c-41eb-aa8c-262a30c96c52';

    const wallet = await prisma.wallet.findUnique({ where: { userId: driverId } });
    console.log('Driver Wallet Balance before:', wallet?.balance);

    const withdrawal = await prisma.withdrawal.create({
        data: {
            driverId,
            amount: 500,
            status: 'pending',
            // bankName and accountNumber are NOT in Withdrawal model, they are pulled from Driver or BankAccount in the controller
        }
    });

    console.log('Created Withdrawal ID:', withdrawal.id);
}

createWithdrawal().finally(() => prisma.$disconnect());
