
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as bcrypt from 'bcrypt'; // Optional, if installed

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api/v1';

// Same credentials as verify_driver_response.ts
const DRIVER_EMAIL = "driver_near@example.com";
const DRIVER_PHONE = '967700008888';
const DRIVER_PASSWORD = 'mock123456';

async function main() {
    console.log('🚕 Starting Driver Rejection Verification...');

    // 0. Check Server Health
    try {
        await axios.get('http://localhost:5000/health');
        console.log('✅ Server is reachable: 200 OK');
    } catch (error) {
        console.error('❌ Server is NOT reachable. Please start server via "npm run dev"');
        process.exit(1);
    }

    // 1. Get Target Driver & Update Credentials (to be safe)
    let driverUser = await prisma.user.findFirst({
        where: { email: DRIVER_EMAIL }
    });

    if (!driverUser) {
        console.error("❌ Driver not found! Run verify_dispatch.ts first.");
        process.exit(1);
    }

    // Ensure password matches
    // Note: bcrypt might not be available in ts-node context if not installed in devDependencies same way.
    // So we rely on verify_driver_response.ts havign run, OR just trust login.
    // If login fails, user should run verify_driver_response.ts first to reset pwd.

    // 2. Login as Driver
    console.log('🔹 Step A: Logging in as Driver...');
    let token = '';
    let driverUserId = driverUser.id;

    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            phone: DRIVER_PHONE,
            password: DRIVER_PASSWORD
        });
        // Adjust for structure: data -> tokens -> accessToken
        token = loginRes.data.data.tokens.accessToken;
        driverUserId = loginRes.data.data.user.id;
        console.log('🔑 Driver Logged In.');
    } catch (error: any) {
        console.error('❌ Login Failed:', error.response?.data || error.message);
        console.error('💡 Tip: Run verify_driver_response.ts first to reset password if needed.');
        process.exit(1);
    }

    // 3. Create a NEW Order & Assign to Driver
    console.log('🔹 Step B: Creating Test Order assigned to Driver...');

    // Fetch a random customer and merchant to link
    const customer = await prisma.customer.findFirst();
    const merchant = await prisma.merchant.findFirst();

    if (!customer || !merchant) {
        console.error('❌ Pre-requisite: Need at least 1 Customer and 1 Merchant in DB.');
        process.exit(1);
    }

    const order = await prisma.order.create({
        data: {
            customerId: customer.userId,
            merchantId: merchant.userId,
            totalAmount: 600, subtotal: 500, deliveryFee: 100, platformFee: 0,
            status: 'READY', paymentMethod: 'CASH_ON_DELIVERY',
            deliveryAddress: 'Rejection Test Address', deliveryLat: 0, deliveryLng: 0,
            // @ts-ignore
            assignedDriverId: driverUserId, // Direct Assignment
            items: { create: [] }
        }
    });
    console.log(`📝 Order Created: ${order.id}`);

    // DISCONNECT PRISMA BEFORE API calls to avoid locks
    await prisma.$disconnect();

    // 4. Call Reject API
    console.log(`🚀 Step C: Calling REJECT Order API for ${order.id}...`);

    try {
        const rejectRes = await axios.post(
            (`${API_URL}/drivers/orders/${order.id}/reject`),
            {}, // Empty body
            { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log('✅ API Success Response:', rejectRes.data.message);

        // 5. Verification
        // Re-connect prisma to check status
        const prismaVerify = new PrismaClient();
        const updatedOrder = await prismaVerify.order.findUnique({ where: { id: order.id } });

        // @ts-ignore
        if (updatedOrder && updatedOrder.assignedDriverId === null) {
            console.log('🎉 SUCCESS! assignedDriverId is NULL.');
        } else {
            // @ts-ignore
            console.error(`❌ FAILURE! assignedDriverId is STILL ${updatedOrder?.assignedDriverId}`);
        }

        // @ts-ignore
        // Check rejectedDriverIds (might be returned as array or string depending on client)
        if (updatedOrder && updatedOrder.rejectedDriverIds && updatedOrder.rejectedDriverIds.includes(driverUserId)) {
            console.log('🎉 SUCCESS! Driver added to rejectedDriverIds.');
        } else {
            // @ts-ignore
            console.error(`❌ FAILURE! Driver NOT in rejectedDriverIds: ${JSON.stringify(updatedOrder?.rejectedDriverIds)}`);
        }

        await prismaVerify.$disconnect();

    } catch (error: any) {
        console.error('❌ API Reject Failed:', error.response?.status, error.response?.data || error.message);
    }
}

main();
