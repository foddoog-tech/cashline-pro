const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Realistic Data Simulation (JS Version)...');

    // 1. Pending Merchant
    try {
        const merchantUser = await prisma.user.create({
            data: {
                phone: `+96777000${Math.floor(Math.random() * 1000)}`,
                passwordHash: 'simulation_hash',
                role: 'MERCHANT',
                fullName: 'New Merchant Test JS',
                email: `merchant${Date.now()}@test.com`,
                isActive: false,
                merchant: {
                    create: {
                        storeName: 'Al-Sultan Nuts (Pending JS)',
                        type: 'MERCHANT',
                        address: 'Sanaa, Hadda St.',
                        lat: 15.349880,
                        lng: 44.206410,
                        bankName: 'Kuraimi Bank',
                        accountNumber: '123456',
                        accountName: 'Sultan Owner',
                        licenseNumber: 'REG-1234',
                        isApproved: false
                    }
                }
            }
        });
        console.log('✅ Pending Merchant Created');
    } catch (e) {
        console.error('Failed to create merchant:', e);
    }

    // 2. Pending Driver
    try {
        const driverUser = await prisma.user.create({
            data: {
                phone: `+96773300${Math.floor(Math.random() * 1000)}`,
                passwordHash: 'simulation_hash',
                role: 'DRIVER',
                fullName: 'Driver Essam (Pending JS)',
                email: `driver${Date.now()}@test.com`,
                isActive: false,
                driver: {
                    create: {
                        vehicleType: 'Suzuki Van',
                        vehicleNumber: '12-9988',
                        bankName: 'Jeeb Wallet',
                        accountNumber: '733000111',
                        accountName: 'Essam Driver',
                        currentLat: 15.352880,
                        currentLng: 44.209410,
                        isApproved: false
                    }
                }
            }
        });
        console.log('✅ Pending Driver Created');
    } catch (e) {
        console.error('Failed to create driver:');
    }

    console.log('🎉 Simulation Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
