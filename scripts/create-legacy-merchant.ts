import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createLegacyMerchant() {
    const phone = '+967799999999';
    const passwordHash = await bcrypt.hash('Legacy@123', 10);

    console.log('Creating legacy merchant...');
    const user = await prisma.user.create({
        data: {
            phone,
            passwordHash,
            role: UserRole.MERCHANT,
            fullName: 'Legacy Merchant',
            merchant: {
                create: {
                    type: 'MERCHANT',
                    storeName: 'Old Store',
                    address: 'Old City, Old Street',
                    lat: 15.1,
                    lng: 44.1,
                    idImageUrl: 'legacy_id.jpg',
                    bankName: 'Old Bank',
                    accountNumber: '999888777',
                    accountName: 'Old Owner',
                    isApproved: true
                }
            }
        }
    });

    console.log('Created Legacy Merchant ID:', user.id);
}

createLegacyMerchant().finally(() => prisma.$disconnect());
