
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdminUser() {
    try {
        const adminPhone = '+967777777777';
        const adminEmail = 'admin@cashline.com';
        const password = 'Admin123!';

        // Check if user exists
        let user = await prisma.user.findUnique({
            where: { phone: adminPhone }
        });

        if (!user) {
            console.log('Creating Admin User...');
            const hashedPassword = await bcrypt.hash(password, 10);
            user = await prisma.user.create({
                data: {
                    phone: adminPhone,
                    email: adminEmail,
                    passwordHash: hashedPassword,
                    fullName: 'المدير العام',
                    role: UserRole.ADMIN,
                    isActive: true,
                    emailVerified: true,
                    phoneVerified: true,
                }
            });
            console.log('Admin User created successfully.');
        } else {
            console.log('Admin User already exists.');
            // Always update password to ensure it matches
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash: hashedPassword,
                    role: UserRole.ADMIN,
                    isActive: true
                }
            });
            console.log('Admin password and role updated successfully.');
        }

        // Create Admin Profile if needed (optional based on schema, but good for permissions)
        const adminProfile = await prisma.admin.findUnique({
            where: { userId: user.id }
        });

        if (!adminProfile) {
            console.log('Creating Admin Profile...');
            await prisma.admin.create({
                data: {
                    userId: user.id,
                    permissions: { all: true }
                }
            });
        }

        console.log(`
    =========================================
    Admin Account Ready:
    Phone: ${adminPhone}
    Password: ${password}
    =========================================
    `);

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdminUser();
