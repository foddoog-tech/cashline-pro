
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import * as bcrypt from 'bcrypt';

dotenv.config();
const prisma = new PrismaClient();

const SERVER_URL = "http://127.0.0.1:5000";
const DRIVER_EMAIL = "driver_near@example.com";

async function runTest() {
    console.log("🚕 Starting Driver Response Verification...");

    // Check Server Health
    try {
        const health = await fetch(`${SERVER_URL}/health`);
        const healthData = await health.json();
        console.log(`✅ Server is reachable: ${health.status} ${health.statusText}`);
    } catch (e) {
        console.error("❌ Server is NOT reachable. Is it running on port 5000?");
        process.exit(1);
    }

    // 1. Get Target Driver ID
    const driverUser = await prisma.user.findFirst({
        where: { email: DRIVER_EMAIL }
    });

    if (!driverUser) {
        console.error("❌ Driver not found! Run verify_dispatch.ts first.");
        process.exit(1);
    }

    // 2. Login as Driver
    console.log("🔹 Step A: Logging in as Driver...");
    // Reset password to known value for test
    const newPassword = 'mock123456';
    const newHash = await bcrypt.hash(newPassword, 10);
    const updatedDriver = await prisma.user.update({
        where: { id: driverUser.id },
        data: { passwordHash: newHash, phone: '967700008888' } // Ensure phone exists!
    });

    const loginRes = await fetch(`${SERVER_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '967700008888', password: newPassword })
    });

    const loginData: any = await loginRes.json();
    const accessToken = loginData.data?.tokens?.accessToken;

    if (!accessToken) {
        console.error("❌ Driver Login Failed:", JSON.stringify(loginData));
        process.exit(1);
    }
    console.log("🔑 Driver Logged In.");

    // 3. Create a Dummy Order assigned to this driver
    console.log("🔹 Step B: Creating Test Order assigned to Driver...");

    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    const merchant = await prisma.merchant.findFirst();

    if (!customer || !merchant) {
        throw new Error("Missing customer or merchant for test.");
    }

    const order = await prisma.order.create({
        data: {
            customerId: customer.id,
            merchantId: merchant.userId,
            totalAmount: 500, subtotal: 400, deliveryFee: 100, platformFee: 0,
            status: 'READY', paymentMethod: 'CASH_ON_DELIVERY',
            deliveryAddress: 'Driver Response Test Address', deliveryLat: 0, deliveryLng: 0,
            // @ts-ignore
            assignedDriverId: driverUser.id, // Direct Assignment
            items: { create: [] }
        }
    });
    console.log(`📝 Order Created: ${order.id}`);
    console.log(`👉 Assigned To (DB): ${order.assignedDriverId}`); // Must not be null!

    if (order.assignedDriverId !== driverUser.id) {
        console.error(`❌ CRITICAL: Order was created but assignedDriverId is missing/mismatched! Expected ${driverUser.id}, Got ${order.assignedDriverId}`);
        // Try update explicitly if create failed to set it (Prisma quirk?)
        const fixedOrder = await prisma.order.update({
            where: { id: order.id },
            data: { assignedDriverId: driverUser.id }
        });
        console.log(`🔧 Forced Update Assigned To: ${fixedOrder.assignedDriverId}`);
    }

    // DISCONNECT PRISMA BEFORE API call
    await prisma.$disconnect();

    // 4. Call Accept API
    console.log(`🚀 Step C: Calling Accept Order API for ${order.id}...`);

    const acceptRes = await fetch(`${SERVER_URL}/api/v1/drivers/orders/${order.id}/accept`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const acceptData: any = await acceptRes.json();

    if (!acceptRes.ok) {
        console.error(`❌ API Accept Failed: ${acceptRes.status}`, JSON.stringify(acceptData));
        process.exit(1);
    }

    console.log("✅ API Success Response:", JSON.stringify(acceptData.message));

    // 5. Verify Database State
    // We need a fresh prisma client or reconnect? No, ideally we should verify via API or reconnect.
    // For simplicity, let's trust the API response data which prevents needing to reconnect prisma.

    const updatedOrder = acceptData.data;
    if (updatedOrder.status === 'PICKED_UP' && updatedOrder.driverId === driverUser.id && updatedOrder.assignedDriverId === null) {
        console.log("🎉 SUCCESS! Order status is PICKED_UP and driver is assigned.");
    } else {
        console.error("❌ Verification Failed! Order state is incorrect:", JSON.stringify(updatedOrder));
        process.exit(1);
    }

}

runTest();
