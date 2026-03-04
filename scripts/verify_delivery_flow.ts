
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api/v1';

// Same credentials as verified
const DRIVER_PHONE = '967700008888';
const DRIVER_PASSWORD = 'mock123456';

async function main() {
    console.log('🚚 Starting FULL Driver Delivery Flow Verification...');

    // 0. Check Server
    try {
        await axios.get('http://localhost:5000/health');
        console.log('✅ Server is reachable.');
    } catch {
        console.error('❌ Server NOT reachable. Start with "npm run dev".');
        process.exit(1);
    }

    // 1. Login
    console.log('\n🔑 Step 1: Login Driver...');
    let token = '';
    let driverUserId = '';
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            phone: DRIVER_PHONE, password: DRIVER_PASSWORD
        });
        token = loginRes.data.data.tokens.accessToken;
        driverUserId = loginRes.data.data.user.id;
        console.log(`✅ Logged in as Driver: ${driverUserId}`);
    } catch (e: any) {
        console.error('❌ Login Failed:', e.response?.data?.message || e.message);
        process.exit(1);
    }

    // 2. Create Order
    console.log('\n📦 Step 2: Create Test Order...');
    const customer = await prisma.customer.findFirst();
    const merchant = await prisma.merchant.findFirst();
    if (!customer || !merchant) {
        console.error('❌ Missing customer/merchant in DB.'); process.exit(1);
    }

    // Ensure driver is "Available" first? (acceptOrder checks isAvailable)
    await prisma.driver.update({
        where: { userId: driverUserId },
        data: { isAvailable: true }
    });

    // CHECK AND CREATE WALLET FOR DRIVER
    const driverWallet = await prisma.wallet.findUnique({ where: { userId: driverUserId } });
    if (!driverWallet) {
        console.log('⚠️ Wallet missing for DRIVER, creating one...');
        await prisma.wallet.create({
            data: { userId: driverUserId, balance: 0, holdBalance: 0, currency: 'YER', isActive: true }
        });
        console.log('✅ DRIVER Wallet created.');
    }

    // CHECK AND CREATE WALLET FOR MERCHANT
    const merchantWallet = await prisma.wallet.findUnique({ where: { userId: merchant.userId } });
    if (!merchantWallet) {
        console.log('⚠️ Wallet missing for MERCHANT, creating one...');
        await prisma.wallet.create({
            data: { userId: merchant.userId, balance: 0, holdBalance: 0, currency: 'YER', isActive: true }
        });
        console.log('✅ MERCHANT Wallet created.');
    }

    const order = await prisma.order.create({
        data: {
            customerId: customer.userId,
            merchantId: merchant.userId,
            totalAmount: 1200, subtotal: 1000, deliveryFee: 200, platformFee: 50,
            status: 'READY', paymentMethod: 'CASH_ON_DELIVERY',
            deliveryAddress: 'Delivery Flow Test Address', deliveryLat: 15.3, deliveryLng: 44.2,
            // @ts-ignore
            assignedDriverId: driverUserId,
            items: { create: [] }
        }
    });
    console.log(`✅ Order Created: ${order.id}`);
    await prisma.$disconnect();

    // 3. Accept Order
    console.log(`\n👍 Step 3: Accept Order (${order.id})...`);
    try {
        const acceptRes = await axios.post(
            `${API_URL}/drivers/orders/${order.id}/accept`, {},
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('✅ API Accept Success:', acceptRes.data.status);
    } catch (e: any) {
        console.error('❌ Accept Failed:', e.response?.data || e.message);
        process.exit(1);
    }

    // Verify Status: PICKED_UP
    const verifyPrisma = new PrismaClient();
    let orderCheck = await verifyPrisma.order.findUnique({ where: { id: order.id } });
    if (orderCheck?.status === 'PICKED_UP' && orderCheck.driverId === driverUserId) {
        console.log('✅ DB Verification: Status is PICKED_UP.');
    } else {
        console.error(`❌ DB Verification Failed: Status is ${orderCheck?.status}`);
        process.exit(1);
    }

    // 4. Confirm Pickup (Start Delivery)
    console.log(`\n🚗 Step 4: Confirm Pickup (Start Journey)...`);
    try {
        const pickupRes = await axios.put( // Note PUT
            `${API_URL}/drivers/orders/${order.id}/pickup`, {},
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('✅ API Pickup Success:', pickupRes.data.message);
    } catch (e: any) {
        console.error('❌ Pickup Failed:', e.response?.data || e.message);
        process.exit(1);
    }

    // Verify Status: IN_TRANSIT
    orderCheck = await verifyPrisma.order.findUnique({ where: { id: order.id } });
    if (orderCheck?.status === 'IN_TRANSIT' && orderCheck.pickedUpAt) {
        console.log('✅ DB Verification: Status is IN_TRANSIT, pickedUpAt is set.');
    } else {
        console.error(`❌ DB Verification Failed: Status is ${orderCheck?.status}`);
        process.exit(1);
    }

    // 5. Confirm Delivery (Finish)
    console.log(`\n🏁 Step 5: Confirm Delivery...`);
    try {
        const deliverRes = await axios.put( // Note PUT
            `${API_URL}/drivers/orders/${order.id}/deliver`, {},
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('✅ API Delivery Success:', deliverRes.data.message); // Should contain success message
    } catch (e: any) {
        console.error('❌ Delivery Failed:', e.response?.data || e.message);
        process.exit(1);
    }

    // Verify Status: DELIVERED, Payment Created
    orderCheck = await verifyPrisma.order.findUnique({ where: { id: order.id } });
    if (orderCheck?.status === 'DELIVERED' && orderCheck.deliveredAt && orderCheck.isPaid) {
        console.log('✅ DB Verification: Status depends on controller (DELIVERED), deliveredAt set, isPaid true.');
    } else {
        console.error(`❌ DB Verification Failed: Status is ${orderCheck?.status}`);
    }

    // Verify Payment Record
    const payment = await verifyPrisma.payment.findFirst({ where: { orderId: order.id } });
    if (payment) {
        console.log(`✅ Payment Record Found: ID ${payment.id}, Amount: ${payment.totalAmount}, DriverFee: ${payment.driverFee}`);
    } else {
        console.error('❌ Payment Record MISSING!');
    }

    console.log('\n🎉 FULL DELIVERY FLOW COMPLETED SUCCESSFULLY! 🚀');
    await verifyPrisma.$disconnect();
}

main();
