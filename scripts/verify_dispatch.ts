
import { PrismaClient } from '@prisma/client';
import { DispatchService } from '../src/services/dispatch.service';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function runTest() {
    console.log('🧪 Starting Smart Dispatch System Test...');

    try {
        // 0. Setup: Create Customer
        let customerUser = await prisma.user.findFirst({ where: { email: 'test_customer_dispatch@example.com' } });
        if (!customerUser) {
            customerUser = await prisma.user.create({
                data: {
                    phone: '967722220000', role: 'CUSTOMER', fullName: 'Dispatch Test Customer',
                    email: 'test_customer_dispatch@example.com', passwordHash: 'mock', isActive: true,
                    customer: {
                        create: {
                            address: 'Home Test Address'
                        }
                    }
                }
            });
        }

        // 1. Setup: Create Merchant at Origin (0,0)
        let merchantUser = await prisma.user.findFirst({ where: { email: 'test_merchant_dispatch@example.com' } });
        if (!merchantUser) {
            merchantUser = await prisma.user.create({
                data: {
                    phone: '967700009999', role: 'MERCHANT', fullName: 'Dispatch Test Merchant',
                    email: 'test_merchant_dispatch@example.com', passwordHash: 'mock', isActive: true,
                    merchant: {
                        create: {
                            storeName: 'Central Store', type: 'MERCHANT', address: 'Center',
                            lat: 15.3694, lng: 44.1910, // Sanaa center
                            bankName: 'Test Bank', accountName: 'Merchant Test'
                        }
                    }
                },
                include: { merchant: true }
            });
        }
        const merchant = await prisma.merchant.findUnique({ where: { userId: merchantUser.id } });
        if (!merchant) throw new Error("Merchant creation failed");


        // 2. Setup: Create Driver A (NEAR)
        let driverAUser = await prisma.user.findFirst({ where: { email: 'driver_near@example.com' } });
        if (!driverAUser) {
            driverAUser = await prisma.user.create({
                data: {
                    phone: '967711110001', role: 'DRIVER', fullName: 'Driver Near',
                    email: 'driver_near@example.com', passwordHash: 'mock', isActive: true,
                    driver: {
                        create: {
                            currentLat: 15.3695, currentLng: 44.1911, // Very close
                            isAvailable: true, vehicleType: 'BIKE', vehicleNumber: 'A-111',
                            bankName: 'Driver Bank', accountName: 'Driver Near'
                        }
                    }
                }
            });
        }

        // 3. Setup: Create Driver B (FAR)
        let driverBUser = await prisma.user.findFirst({ where: { email: 'driver_far@example.com' } });
        if (!driverBUser) {
            driverBUser = await prisma.user.create({
                data: {
                    phone: '967711110002', role: 'DRIVER', fullName: 'Driver Far',
                    email: 'driver_far@example.com', passwordHash: 'mock', isActive: true,
                    driver: {
                        create: {
                            currentLat: 15.4000, currentLng: 44.2500, // Further away
                            isAvailable: true, vehicleType: 'BIKE', vehicleNumber: 'B-222',
                            bankName: 'Driver Bank', accountName: 'Driver Far'
                        }
                    }
                }
            });
        }

        // Ensure both drivers are available
        await prisma.driver.updateMany({
            where: { userId: { in: [driverAUser.id, driverBUser.id] } },
            data: { isAvailable: true }
        });

        console.log(`📍 Merchant Loc: [15.3694, 44.1910]`);
        console.log(`🏍️ Driver A (Near): ${driverAUser.id}`);
        console.log(`🏍️ Driver B (Far):  ${driverBUser.id}`);

        // 4. Create Order
        const order = await prisma.order.create({
            data: {
                customerId: customerUser.id,
                merchantId: merchant.userId,
                totalAmount: 500, subtotal: 400, deliveryFee: 100, platformFee: 0,
                status: 'PENDING', paymentMethod: 'CASH_ON_DELIVERY',
                deliveryAddress: 'Test', deliveryLat: 0, deliveryLng: 0,
                items: { create: [] }
            }
        });
        console.log(`📝 Order Created: ${order.id}`);

        // 5. TEST: Assign Order
        console.log('\n🔄 Step 1: Updating Status to READY (Triggering Assignment)...');

        await prisma.order.update({ where: { id: order.id }, data: { status: 'READY' } });
        const driver1 = await DispatchService.assignOrder(order.id);

        console.log(`👉 Assigned To: ${driver1?.userId}`);

        if (driver1?.userId === driverAUser.id) {
            console.log('✅ Success: System chose the NEAREST driver (Driver A).');
        } else {
            console.log('❌ Fail: System did not choose the nearest driver.');
        }

        // 6. TEST: Driver A Rejects
        console.log('\n🚫 Step 2: Driver A Rejects the Order...');
        await DispatchService.handleRejection(order.id, driverAUser.id);

        // 7. Verify Reassignment (Polling)
        console.log('⏳ Waiting for reassignment (Polling)...');
        let updatedOrder;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
            updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });

            if (updatedOrder?.assignedDriverId) {
                break; // Found assignment!
            }
            console.log(`... attempt ${attempts + 1}/${maxAttempts}: Still waiting`);
            attempts++;
        }

        console.log(`👉 New Assigned To: ${updatedOrder?.assignedDriverId}`);
        console.log(`🗑️ Rejected By List: ${JSON.stringify(updatedOrder?.rejectedDriverIds)}`);

        if (updatedOrder?.assignedDriverId === driverBUser.id) {
            console.log('🎉 GREAT SUCCESS! Order automatically reassigned to Driver B.');
        } else {
            console.log('❌ Fail: Order was not reassigned correctly within timeout.');
        }

    } catch (error) {
        console.error('❌ Test Execution Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
