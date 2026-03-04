
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createSystemMerchant() {
    try {
        const systemEmail = 'admin-store@cashline.com';
        const systemPhone = '+967700000000'; // System phone number

        // Check if user exists
        let user = await prisma.user.findUnique({
            where: { phone: systemPhone }
        });

        if (!user) {
            console.log('Creating System Merchant User...');
            const hashedPassword = await bcrypt.hash('System123!', 10);
            user = await prisma.user.create({
                data: {
                    phone: systemPhone,
                    email: systemEmail,
                    passwordHash: hashedPassword,
                    fullName: 'متجر كاش لاين',
                    role: UserRole.MERCHANT, // Or potentially ADMIN, but keeping it MERCHANT fits the product relation best
                    isActive: true,
                    emailVerified: true,
                    phoneVerified: true,
                }
            });
        }

        // Check if merchant profile exists
        let merchant = await prisma.merchant.findUnique({
            where: { userId: user.id }
        });

        if (!merchant) {
            console.log('Creating System Merchant Profile...');
            merchant = await prisma.merchant.create({
                data: {
                    userId: user.id,
                    storeName: 'متجر كاش لاين (الرئيسي)',
                    description: 'المتجر الرسمي للتطبيق',
                    type: 'MERCHANT',
                    address: 'الإدارة الرئيسية',
                    lat: 0,
                    lng: 0,
                    idImageUrl: 'system',
                    isApproved: true,
                    approvedAt: new Date(),
                    bankName: 'System',
                    accountName: 'System',
                    accountNumber: 'SystemNumber',
                }
            });
            console.log('System Merchant created successfully:', merchant.storeName);
        } else {
            console.log('System Merchant already exists:', merchant.storeName);
        }

    } catch (error) {
        console.error('Error creating system merchant:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createSystemMerchant();
