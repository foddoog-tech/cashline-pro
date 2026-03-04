/**
 * Script to create the initial Super Admin account
 * Run: node scripts/create-admin.js
 * Requires: DATABASE_URL environment variable
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const ADMIN_PHONE = '+967700000000';
const ADMIN_PASSWORD = 'Admin@CashLine2024';
const ADMIN_NAME = 'Super Admin';
const ADMIN_EMAIL = 'admin@cashline.app';

async function createAdmin() {
    console.log('🚀 Creating Super Admin account...');

    // Check if admin already exists
    const existing = await prisma.user.findUnique({ where: { phone: ADMIN_PHONE } });
    if (existing) {
        console.log('⚠️  Admin already exists:', existing.phone);
        console.log('📱 Phone:', ADMIN_PHONE);
        console.log('🔑 Password:', ADMIN_PASSWORD);
        return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const admin = await prisma.user.create({
        data: {
            phone: ADMIN_PHONE,
            passwordHash,
            role: 'SUPER_ADMIN',
            fullName: ADMIN_NAME,
            email: ADMIN_EMAIL,
            isActive: true,
            admin: {
                create: {
                    permissions: {
                        all: true,
                        manageUsers: true,
                        manageOrders: true,
                        manageProducts: true,
                        viewReports: true,
                    },
                },
            },
        },
    });

    console.log('✅ Super Admin created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 Phone:   ', ADMIN_PHONE);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

createAdmin()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
