
import axios from 'axios';
import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api/v1';
const SOCKET_URL = 'http://localhost:5000';

const DRIVER_PHONE = '967700008888';
const DRIVER_PASSWORD = 'mock123456';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function main() {
    console.log('🔔 Starting Real-time Socket Alert Verification...');

    // 1. Login Driver
    let driverToken = '';
    let driverUserId = '';
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            phone: DRIVER_PHONE, password: DRIVER_PASSWORD
        });
        driverToken = loginRes.data.data.tokens.accessToken;
        driverUserId = loginRes.data.data.user.id;
        console.log(`✅ Logged in as Driver: ${driverUserId}`);
    } catch (e: any) {
        console.error('❌ Login Failed:', e.response?.data || e.message);
        process.exit(1);
    }

    // 2. Connect to Socket
    console.log('\n🔌 Connecting to Socket...');
    const socket = io(SOCKET_URL, {
        auth: { token: driverToken }
    });

    socket.on('connect', () => {
        console.log(`✅ Socket Connected! ID: ${socket.id}`);
    });

    // 3. Listen for Order Assignment
    console.log('👂 Listening for "order:assigned" event...');

    let eventReceived = false;
    socket.on('order:assigned', (data) => {
        console.log('\n🎉 EVENT RECEIVED: order:assigned');
        console.log('📦 Data:', JSON.stringify(data, null, 2));

        if (data.orderId && data.totalAmount) {
            console.log('✅ Validation: Event contains expected data.');
            eventReceived = true;
            socket.disconnect();
            process.exit(0);
        }
    });

    // 4. Prepare Environment
    console.log('📍 Updating Driver Location & Availability...');
    await prisma.driver.update({
        where: { userId: driverUserId },
        data: {
            isAvailable: true,
            currentLat: 15.35, // Near the delivery/merchant
            currentLng: 44.20
        }
    });
    await new Promise(r => setTimeout(r, 1000)); // Wait for socket room join

    // 5. Create Order (PENDING)
    console.log('\n📦 Creating Order (PENDING)...');
    const customer = await prisma.customer.findFirst();
    const merchant = await prisma.merchant.findFirst();

    if (!customer || !merchant) {
        console.error('❌ Missing customer/merchant'); process.exit(1);
    }

    const order = await prisma.order.create({
        data: {
            customerId: customer.userId,
            merchantId: merchant.userId,
            totalAmount: 1500, subtotal: 1300, platformFee: 50, deliveryFee: 150,
            status: 'PENDING', paymentMethod: 'CASH_ON_DELIVERY',
            deliveryAddress: 'Test Socket Address',
            items: { create: [] },
            deliveryLat: 15.35, deliveryLng: 44.20
        }
    });
    console.log(`✅ Order Created: ${order.id}`);

    // 6. Generate Merchant Token & Update Status via API
    console.log('🔑 Generating Merchant Token & Calling API...');
    const merchantToken = jwt.sign(
        { userId: merchant.userId, role: 'MERCHANT' },
        JWT_SECRET,
        { expiresIn: '15m' }
    );

    try {
        console.log('🚀 API: PUT /api/v1/orders/:id/status -> READY');
        // Use PUT here strictly
        await axios.put(`${API_URL}/orders/${order.id}/status`,
            { status: 'READY' },
            { headers: { Authorization: `Bearer ${merchantToken}` } }
        );
        console.log('✅ API Triggered via Merchant!');
    } catch (e: any) {
        console.error('❌ API Error:', e.response?.data || e.message);
        process.exit(1);
    }

    // 7. Wait & Poll for Result
    const startTime = Date.now();
    const timeout = 15000;

    const checkInterval = setInterval(async () => {
        if (eventReceived) {
            clearInterval(checkInterval);
            return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > timeout) {
            console.error('\n❌ Timeout reached.');
            clearInterval(checkInterval);
            socket.disconnect();

            // Final DB Check
            const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
            console.log('🔴 Final Database State:', {
                status: finalOrder?.status,
                // @ts-ignore
                assignedDriverId: finalOrder?.assignedDriverId,
                // @ts-ignore
                rejectedDriverIds: finalOrder?.rejectedDriverIds
            });

            if (finalOrder?.status === 'READY' && !(finalOrder as any).assignedDriverId) {
                console.error('⚠️ Diagnosis: Order became READY but NO DRIVER was assigned. Dispatch failed to find driver?');
            } else if ((finalOrder as any).assignedDriverId === driverUserId) {
                console.error('⚠️ Diagnosis: Driver WAS assigned in DB, but Socket event didn\'t arrive. Socket Room/Emission issue?');
            }

            process.exit(1);
        }

        // Periodic Check
        const currentOrder = await prisma.order.findUnique({ where: { id: order.id } });
        // @ts-ignore
        if (currentOrder?.assignedDriverId) {
            console.log(`🔎 DB Update Detected: Assigned to ${(currentOrder as any).assignedDriverId}`);
            if (!eventReceived) {
                console.log('   ...but socket event not yet received.');
            }
        }

    }, 1000);

    // Add explicit error handling for Socket
    socket.on('connect_error', (err) => {
        console.error('❌ Socket Connect Error:', err.message);
    });
}

main();
