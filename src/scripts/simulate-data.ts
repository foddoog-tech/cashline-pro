import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Realistic Data Simulation...');

    // 1. Create a Pending Merchant
    console.log('📦 Simulating Pending Merchant Signup...');
    try {
        const merchantUser = await prisma.user.create({
            data: {
                phone: `+96777000${Math.floor(Math.random() * 1000)}`,
                passwordHash: 'simulation_hash',
                role: 'MERCHANT',
                fullName: 'New Merchant Test',
                email: `merchant${Date.now()}@test.com`,
                isActive: false
            }
        });

        await prisma.merchant.create({
            data: {
                userId: merchantUser.id,
                storeName: 'Al-Sultan Nuts (Pending Approval)',
                type: 'MERCHANT',
                address: 'Sanaa, Hadda St.',
                lat: 15.349880,
                lng: 44.206410,
                bankName: 'Kuraimi Bank',
                accountNumber: '123456',
                accountName: 'Sultan Owner',
                licenseNumber: 'REG-1234',
                isApproved: false, // Pending
                idImageUrl: 'https://placeholder.com/merchant-id.jpg' // ← إضافة: رابط صورة الهوية
            }
        });
        console.log('✅ Pending Merchant Created');
    } catch (e) {
        console.error('Failed to create merchant:', e);
    }

    // 2. Create a Pending Driver
    console.log('🚚 Simulating Pending Driver Signup...');
    try {
        const driverUser = await prisma.user.create({
            data: {
                phone: `+96773300${Math.floor(Math.random() * 1000)}`,
                passwordHash: 'simulation_hash',
                role: 'DRIVER',
                fullName: 'Driver Essam (Pending)',
                email: `driver${Date.now()}@test.com`,
                isActive: false
            }
        });

        await prisma.driver.create({
            data: {
                userId: driverUser.id,
                vehicleType: 'Suzuki Van',
                vehicleNumber: '12-9988',
                bankName: 'Jeeb Wallet',
                accountNumber: '733000111',
                accountName: 'Essam Driver',
                currentLat: 15.352880,
                currentLng: 44.209410,
                isApproved: false, // Pending
                idImageUrl: 'https://placeholder.com/driver-id.jpg' // ← إضافة: رابط صورة الهوية
            }
        });
        console.log('✅ Pending Driver Created');
    } catch (e) {
        console.error('Failed to create driver:', e);
    }

    // 3. Create an Active Merchant & Product Approval Request
    console.log('🍔 Simulating Product Addition Request...');
    try {
        // First, verify if an active merchant exists or create one
        let activeMerchant = await prisma.merchant.findFirst({ where: { isApproved: true } });

        if (!activeMerchant) {
            const u = await prisma.user.create({
                data: {
                    phone: `+96771100${Math.floor(Math.random() * 1000)}`,
                    passwordHash: 'hash', role: 'MERCHANT', fullName: 'Active Merchant', isActive: true
                }
            });
            activeMerchant = await prisma.merchant.create({
                data: {
                    userId: u.id,
                    storeName: 'Capital Sweets',
                    type: 'MERCHANT',
                    address: 'Sanaa',
                    lat: 15.360,
                    lng: 44.190,
                    isApproved: true,
                    bankName: 'Kuraimi Bank', // ← إضافة: مطلوب من schema
                    accountNumber: '987654321', // ← إضافة: مطلوب من schema
                    accountName: 'Capital Sweets Owner', // ← إضافة: مطلوب من schema
                    licenseNumber: 'REG-5678', // ← إضافة: مطلوب من schema
                    idImageUrl: 'https://placeholder.com/active-merchant-id.jpg' // ← إضافة: رابط صورة الهوية
                }
            });
        }

        await prisma.product.create({
            data: {
                merchantId: activeMerchant.userId,
                name: 'Super Baklava (Needs Approval)',
                nameEn: 'Baklava',
                description: 'Fresh and tasty',
                price: 5000,
                category: 'Sweets',
                stock: 50,
                unit: 'KG',
                status: 'PENDING'
            }
        });
        console.log('✅ Pending Product Created');
    } catch (e) {
        console.error('Failed to create product:', e);
    }

    console.log('🎉 Simulation Complete! Check Admin Dashboard.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
