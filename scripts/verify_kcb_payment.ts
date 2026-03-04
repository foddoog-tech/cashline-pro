
import { PrismaClient } from '@prisma/client';
import { paymentService } from '../src/services/payment.service';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function runTest() {
    console.log('🧪 Starting FULL Financial Cycle Test...');

    try {
        // 1. Setup Data
        let customerUser = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
        if (!customerUser) {
            customerUser = await prisma.user.create({
                data: {
                    phone: '967700000000', role: 'CUSTOMER', fullName: 'Test Customer',
                    passwordHash: 'mock_hash', isActive: true, fcmToken: 'test_token',
                    emailVerified: true, phoneVerified: true
                }
            });
            await prisma.customer.create({ data: { userId: customerUser.id, address: 'Test', lat: 0, lng: 0 } });
        }

        const merchant = await prisma.merchant.findFirst({ include: { user: true } });
        if (!merchant) { console.error('❌ No merchant found.'); return; }

        console.log(`👤 Customer: ${customerUser.fullName}`);
        console.log(`🏪 Merchant: ${merchant.storeName}`);

        // 2. Create Order
        const order = await prisma.order.create({
            data: {
                customerId: customerUser.id,
                merchantId: merchant.userId,
                totalAmount: 2000.00,  // Total
                subtotal: 1000.00,     // Item Price
                deliveryFee: 1000.00,  // Delivery
                platformFee: 50.00,    // 5% of 1000
                status: 'PENDING',
                paymentMethod: 'KCB_BANK',
                deliveryAddress: 'Test Address', deliveryLat: 15.0, deliveryLng: 44.0,
                items: { create: [] }
            }
        });
        console.log(`📝 Order Created: ${order.id} (Total: 2000, Merch: 1000, Del: 1000)`);

        // 3. Process Payment
        console.log('💳 Processing Payment...');
        const payResult = await paymentService.processPayment(order.id, 'KCB_BANK');

        if (!payResult.success) {
            console.error('❌ Payment Failed');
            return;
        }
        console.log('✅ Payment Successful (Mock/Real)');

        // 4. Simulate Delivery & Distribution
        console.log('🚚 Simulating Delivery...');
        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'DELIVERED', deliveredAt: new Date() }
        });

        // Check Initial Balance
        let merchWallet = await prisma.wallet.findUnique({ where: { userId: merchant.userId } });
        const initialBalance = Number(merchWallet?.balance || 0);
        console.log(`💰 Merchant Balance BEFORE: ${initialBalance}`);

        console.log('🔄 Distributing Funds...');
        await paymentService.distributePayment(order.id);

        // Check Final Balance
        merchWallet = await prisma.wallet.findUnique({ where: { userId: merchant.userId } });
        const finalBalance = Number(merchWallet?.balance || 0);
        const expectedNet = 1000 - 50; // 1000 - 5%

        console.log(`💰 Merchant Balance AFTER:  ${finalBalance}`);
        console.log(`📈 Difference: ${finalBalance - initialBalance} (Expected: ${expectedNet})`);

        if (finalBalance > initialBalance) {
            console.log('🎉 GREAT SUCCESS! Money moved to the wallet.');
        } else {
            console.log('⚠️ Warning: Balance did not change. Check WalletService.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
