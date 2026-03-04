const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const ADMIN_PHONE = '+967700000000';
const ADMIN_PASSWORD = 'Admin@CashLine2024';
const STORE_PHONE = '+967711111111';
const STORE_PASSWORD = 'Store@CashLine2024';

async function main() {
    console.log('🚀 Setting up CashLine accounts...');

    // ── 1. Super Admin ─────────────────────────────────────────────────────
    const existingAdmin = await prisma.user.findUnique({ where: { phone: ADMIN_PHONE } });
    if (!existingAdmin) {
        const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
        await prisma.user.create({
            data: {
                phone: ADMIN_PHONE, passwordHash: hash,
                role: 'SUPER_ADMIN', fullName: 'Super Admin',
                email: 'admin@cashline.app', isActive: true,
                admin: { create: { permissions: { all: true } } },
            },
        });
        console.log('✅ Admin created  →', ADMIN_PHONE, '/', ADMIN_PASSWORD);
    } else {
        console.log('ℹ️  Admin exists  →', ADMIN_PHONE);
    }

    // ── 2. Main Store (managed from Admin Dashboard) ────────────────────────
    const existingStore = await prisma.user.findUnique({ where: { phone: STORE_PHONE } });
    if (!existingStore) {
        const hash = await bcrypt.hash(STORE_PASSWORD, 12);
        await prisma.user.create({
            data: {
                phone: STORE_PHONE, passwordHash: hash,
                role: 'MERCHANT', fullName: 'Cash Line Store',
                email: 'store@cashline.app', isActive: true,
                merchant: {
                    create: {
                        storeName: 'كاش لاين - المتجر الرسمي',
                        type: 'MERCHANT',
                        description: 'المتجر الرسمي لتطبيق كاش لاين',
                        address: 'اليمن - صنعاء', lat: 15.3694, lng: 44.1910,
                        bankName: 'كاش لاين', accountName: 'Cash Line',
                        commissionRate: 0.0, isApproved: true, approvedAt: new Date(),
                    },
                },
            },
        });
        console.log('✅ Main Store created → يظهر الآن في لوحة التحكم عند إضافة منتجات');
    } else {
        console.log('ℹ️  Main Store exists already');
    }

    console.log('🎉 Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
