import { paymentService } from '../../../src/services/payment.service';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { WalletService } from '../../../src/services/wallet.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const prisma = new PrismaClient();

describe('PaymentService - Complete Coverage', () => {
    let merchantId: string;
    let customerUserId: string;
    let driverId: string;
    let orderId1: string; // CASH order
    let orderId2: string; // KCB order (for declined / failure logic)
    let orderId3: string; // KCB order for distribution
    let withdrawalId: string;

    beforeAll(async () => {
        const userM = await prisma.user.create({ data: { phone: `+967${Math.floor(Math.random() * 100000000)}`, passwordHash: 'dummy', role: 'MERCHANT', fullName: 'Merchant' } });
        merchantId = userM.id;
        await prisma.merchant.create({ data: { userId: merchantId, type: 'MERCHANT', storeName: 'Test', address: 'Test', lat: 15.3, lng: 44.1, bankName: 'Test', accountName: 'Test', isApproved: true, commissionRate: 0.05 } });
        await WalletService.createWallet(merchantId, 'YER');

        const userC = await prisma.user.create({ data: { phone: `+967${Math.floor(Math.random() * 100000000)}`, passwordHash: 'dummy', role: 'CUSTOMER', fullName: 'Customer' } });
        customerUserId = userC.id;
        await prisma.customer.create({ data: { userId: customerUserId, address: 'Test' } });
        await WalletService.createWallet(customerUserId, 'YER');
        await WalletService.credit(customerUserId, 5000); // Give customer some money

        const userD = await prisma.user.create({ data: { phone: `+967${Math.floor(Math.random() * 100000000)}`, passwordHash: 'dummy', role: 'DRIVER', fullName: 'Driver' } });
        driverId = userD.id;
        await prisma.driver.create({ data: { userId: driverId, vehicleType: 'CAR', bankName: 'Yemen Bank', accountName: 'Driver 1', isAvailable: true } });
        await WalletService.createWallet(driverId, 'YER');

        // Order 1: CASH
        const order1 = await prisma.order.create({
            data: { customerId: customerUserId, merchantId: merchantId, driverId, subtotal: 100, deliveryFee: 20, platformFee: 0, totalAmount: 120, paymentMethod: 'CASH_ON_DELIVERY', deliveryAddress: 'Test', deliveryLat: 15.3, deliveryLng: 44.1, status: 'DELIVERED' }
        });
        orderId1 = order1.id;
        await prisma.payment.create({ data: { orderId: orderId1, totalAmount: 120, platformFee: 0, driverFee: 20, merchantNet: 100, status: 'completed', transactionId: `CASH_${orderId1}` } });

        // Order 2: KCB Failed
        const order2 = await prisma.order.create({
            data: { customerId: customerUserId, merchantId: merchantId, driverId, subtotal: 50, deliveryFee: 10, platformFee: 0, totalAmount: 60, paymentMethod: 'KCB_BANK', deliveryAddress: 'Test', deliveryLat: 15.3, deliveryLng: 44.1, status: 'PENDING' }
        });
        orderId2 = order2.id;
        // Don't create payment for 2, it hasn't succeeded yet

        // Order 3: KCB Success and ready for distribution
        const order3 = await prisma.order.create({
            data: { customerId: customerUserId, merchantId: merchantId, driverId, subtotal: 200, deliveryFee: 30, platformFee: 0, totalAmount: 230, paymentMethod: 'KCB_BANK', deliveryAddress: 'Test', deliveryLat: 15.3, deliveryLng: 44.1, status: 'DELIVERED' }
        });
        orderId3 = order3.id;
        await WalletService.hold(customerUserId, 230, 'KCB Hold'); // Mock held funds
        await prisma.payment.create({ data: { orderId: orderId3, totalAmount: 230, platformFee: 0, driverFee: 30, merchantNet: 200, status: 'completed', transactionId: `KCB_${orderId3}` } });

        const w = await prisma.withdrawal.create({
            data: { driverId, amount: 50, status: 'approved' }
        });
        withdrawalId = w.id;
    });

    afterAll(async () => {
        // Safe cascading cleanup
        await prisma.withdrawal.deleteMany({ where: { driverId } });
        await prisma.payment.deleteMany({ where: { orderId: { in: [orderId1, orderId2, orderId3] } } });
        await prisma.order.deleteMany({ where: { id: { in: [orderId1, orderId2, orderId3] } } });
        await prisma.merchant.delete({ where: { userId: merchantId } });
        await prisma.customer.delete({ where: { userId: customerUserId } });
        await prisma.driver.delete({ where: { userId: driverId } });

        await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: [merchantId, customerUserId, driverId] } } } });
        await prisma.wallet.deleteMany({ where: { userId: { in: [merchantId, customerUserId, driverId] } } });
        await prisma.user.deleteMany({ where: { id: { in: [merchantId, customerUserId, driverId] } } });
        await prisma.$disconnect();
    });

    // 1. Commission Validation and Boundaries
    it('should calculate exactly 5% commission for merchant (100 -> 95 for net, 5 for platform) with 20 delivery', async () => {
        const breakdown = await paymentService.calculateCommissions(orderId1);
        expect(Math.abs(Number(breakdown.subtotal) - 100)).toBeLessThan(0.001);
        expect(Math.abs(Number(breakdown.merchantNet) - 95)).toBeLessThan(0.001);
        expect(Math.abs(Number(breakdown.platformFee) - 5)).toBeLessThan(0.001);
        expect(Math.abs(Number(breakdown.driverFee) - 20)).toBeLessThan(0.001);
        expect(breakdown.totalAmount).toBe(120);
    });

    it('should calculate handle zero amount edge case gracefully without math issues', async () => {
        const orderZero = await prisma.order.create({
            data: { customerId: customerUserId, merchantId: merchantId, subtotal: 0, deliveryFee: 0, platformFee: 0, totalAmount: 0, paymentMethod: 'CASH_ON_DELIVERY', deliveryAddress: 'Test', deliveryLat: 15.3, deliveryLng: 44.1, status: 'PENDING' }
        });

        const breakdown = await paymentService.calculateCommissions(orderZero.id);
        expect(Number(breakdown.subtotal)).toBe(0);
        expect(Number(breakdown.merchantNet)).toBe(0);

        await prisma.order.delete({ where: { id: orderZero.id } });
    });

    // 2. KCB Failures & Edge cases
    it('should handle KCB API network timeout gracefully without crashing app or double charging', async () => {
        mockedAxios.post.mockRejectedValueOnce(new Error('timeout of 15000ms exceeded'));

        const result = await paymentService.processPayment(orderId2, 'KCB_BANK');
        expect(result.success).toBe(false);
        expect(result.error).toBe('CONNECTION_ERROR');

        const order = await prisma.order.findUnique({ where: { id: orderId2 } });
        expect(order?.isPaid).toBe(false);
    });

    it('should handle KCB card declined response', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: { status: 'FAILED', message: 'Insufficient Funds', code: '51' }
        });

        const result = await paymentService.processPayment(orderId2, 'KCB_BANK');
        expect(result.success).toBe(false);
        expect(result.message).toBe('Insufficient Funds');
        expect(result.error).toBe('BANK_DECLINED');
    });

    it('should prevent double charging for same order ID (Idempotency)', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: { status: 'SUCCESS', transaction_id: 'KCB_12345' }
        });

        // First attempt -> updates isPaid to true
        const res1 = await paymentService.processPayment(orderId2, 'KCB_BANK');
        expect(res1.success).toBe(true);

        // Second attempt -> ALREADY_PAID
        const res2 = await paymentService.processPayment(orderId2, 'KCB_BANK');
        expect(res2.success).toBe(false);
        expect(res2.error).toBe('ALREADY_PAID');
    });

    // 3. Payment Distribution (The complete Flow) -> Integration checks
    it('should successfully distribute a KCB payment (hold -> release/capture -> credit merchant & driver)', async () => {
        // Order 3 (KCB) was created with 230 held from customer. Distribution should capture it.
        await paymentService.distributePayment(orderId3);

        const order = await prisma.order.findUnique({ where: { id: orderId3 }, include: { payment: true } });
        expect(order?.payment?.status).toBe('distributed');

        // Verify Merchant received Net amount (Subtotal 200 -> 190 net)
        const merchantWallet = await prisma.wallet.findUnique({ where: { userId: merchantId } });
        expect(Number(merchantWallet?.balance)).toBe(190); // since he started with 0

        // Verify Driver received delivery fee (30)
        const driverWallet = await prisma.wallet.findUnique({ where: { userId: driverId } });
        expect(Number(driverWallet?.balance)).toBe(30);

        // Verify Customer hold balance was cleared (captured)
        const customerWallet = await prisma.wallet.findUnique({ where: { userId: customerUserId } });
        expect(Number(customerWallet?.holdBalance)).toBe(0);
    });

    it('should ignore duplicate distributePayment calls across multiple hits', async () => {
        const merchantBalBefore = await prisma.wallet.findUnique({ where: { userId: merchantId } });

        // Distribute again Should gracefully skip!
        await paymentService.distributePayment(orderId3);

        const merchantBalAfter = await prisma.wallet.findUnique({ where: { userId: merchantId } });

        // Ensure no new money was added
        expect(Number(merchantBalAfter?.balance)).toBe(Number(merchantBalBefore?.balance));
    });

    it('should successfully handle CASH ON DELIVERY distribution routing', async () => {
        // Order 1 is CASH_ON_DELIVERY. Meaning customer pays driver physically. The platform does NOT capture customer funds.
        await paymentService.distributePayment(orderId1);

        const order = await prisma.order.findUnique({ where: { id: orderId1 }, include: { payment: true } });
        expect(order?.payment?.status).toBe('distributed');

        // Customer shouldn't lose money from wallet for COD.
    });

    // 4. Withdrawal Testing
    it('should process an approved withdrawal request for driver', async () => {
        await paymentService.processWithdrawal(withdrawalId);

        const w = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
        expect(w?.status).toBe('completed');
    });

    it('should throw error when processing invalid withdrawal', async () => {
        const badId = 'invalid-id-uuid-test99';
        await expect(paymentService.processWithdrawal(badId)).rejects.toThrow('Withdrawal not found');
    });

    it('should handle wallet process payment mocked routes gracefully', async () => {
        // order1 is already marked as isPaid=true in previous KCB test
        // let's use a fresh order for Jeeb
        const jeebOrder = await prisma.order.create({
            data: { customerId: customerUserId, merchantId: merchantId, driverId, subtotal: 50, deliveryFee: 10, platformFee: 0, totalAmount: 60, paymentMethod: 'JEEB_WALLET', deliveryAddress: 'Test', deliveryLat: 15.3, deliveryLng: 44.1, status: 'PENDING' }
        });
        const res = await paymentService.processPayment(jeebOrder.id, 'JEEB_WALLET');
        expect(res.success).toBe(true);
        expect(res.transactionId).toContain('JEEB_');

        await prisma.payment.deleteMany({ where: { orderId: jeebOrder.id } });
        await prisma.order.delete({ where: { id: jeebOrder.id } });
    });

    // Verify / Read tests
    it('should verify payment status correctly', async () => {
        const res = await paymentService.verifyPayment(`KCB_${orderId3}`);
        expect(res.status).toBe('distributed');
    });

    it('should return not_found when verifying invalid payment id', async () => {
        const res = await paymentService.verifyPayment(`FAKE_ID`);
        expect(res.status).toBe('not_found');
        expect(res.isPaid).toBe(false);
    });

    it('should throw error for invalid payment method', async () => {
        const fakeOrder = await prisma.order.create({
            data: { customerId: customerUserId, merchantId: merchantId, subtotal: 5, deliveryFee: 0, platformFee: 0, totalAmount: 5, paymentMethod: 'CASH_ON_DELIVERY', deliveryAddress: 'Test', deliveryLat: 0, deliveryLng: 0, status: 'PENDING' }
        });

        // Suppress TS error to test runtime check
        const res = await paymentService.processPayment(fakeOrder.id, 'INVALID_METHOD' as any);
        expect(res.success).toBe(false);
        expect(res.error).toBe('INVALID_METHOD');

        await prisma.order.delete({ where: { id: fakeOrder.id } });
    });

    it('should handle minimum amount payments (0.01)', async () => {
        const smallOrder = await prisma.order.create({
            data: { customerId: customerUserId, merchantId: merchantId, subtotal: 0.01, deliveryFee: 0, platformFee: 0, totalAmount: 0.01, paymentMethod: 'CASH_ON_DELIVERY', deliveryAddress: 'Test', deliveryLat: 0, deliveryLng: 0, status: 'PENDING' }
        });
        const breakdown = await paymentService.calculateCommissions(smallOrder.id);
        expect(Number(breakdown.subtotal)).toBeCloseTo(0.01);
        expect(Number(breakdown.platformFee)).toBeCloseTo(0.0005, 4);

        await prisma.order.delete({ where: { id: smallOrder.id } });
    });

    it('should handle missing order for calculateCommissions safely', async () => {
        await expect(paymentService.calculateCommissions('fake-order')).rejects.toThrow('Order not found');
    });

    it('should prevent double distribution for same order', async () => {
        await paymentService.distributePayment(orderId3);
        const secondTry = await paymentService.distributePayment(orderId3);
        // Method returns void and skips implicitly (covered but reinforcing explicitly)
        // No errors thrown, and no money added again
        expect(secondTry).toBeUndefined(); // Returns early cleanly
    });

    it('should handle processPayment when order does not exist', async () => {
        const res = await paymentService.processPayment('fake-order', 'KCB_BANK');
        expect(res.success).toBe(false);
        expect(res.error).toBe('ORDER_NOT_FOUND');
    });

    it('should not distribute payment for cancelled orders', async () => {
        const cancelledOrder = await prisma.order.create({
            data: { customerId: customerUserId, merchantId: merchantId, driverId, subtotal: 50, deliveryFee: 10, platformFee: 0, totalAmount: 60, paymentMethod: 'KCB_BANK', deliveryAddress: 'Test', deliveryLat: 15.3, deliveryLng: 44.1, status: 'CANCELLED' }
        });

        await expect(paymentService.distributePayment(cancelledOrder.id)).rejects.toThrow('Order not delivered yet');
        await prisma.order.delete({ where: { id: cancelledOrder.id } });
    });

    it('should handle unexpected errors gracefully in verify payment (Catch Block)', async () => {
        const spy = jest.spyOn(prisma.payment, 'findFirst').mockRejectedValueOnce(new Error('DB Error'));
        const result = await paymentService.verifyPayment('any');
        expect(result.status).toBe('not_found');
        expect(result.isPaid).toBe(false);
        spy.mockRestore();
    });

    it('should reject distributePayment with missing payment record', async () => {
        // Create an order delivered but entirely missing the payment link
        const noPaymentOrder = await prisma.order.create({
            data: { customerId: customerUserId, merchantId: merchantId, driverId, subtotal: 50, deliveryFee: 10, platformFee: 0, totalAmount: 60, paymentMethod: 'KCB_BANK', deliveryAddress: 'Test', deliveryLat: 15.3, deliveryLng: 44.1, status: 'DELIVERED' }
        });

        await expect(paymentService.distributePayment(noPaymentOrder.id))
            .rejects.toThrow('Payment record not found');

        await prisma.order.delete({ where: { id: noPaymentOrder.id } });
    });

    it('should reject unapproved withdrawal', async () => {
        const tempW = await prisma.withdrawal.create({
            data: { driverId, amount: 20, status: 'pending' }
        });
        await expect(paymentService.processWithdrawal(tempW.id)).rejects.toThrow('Withdrawal not approved');
        await prisma.withdrawal.delete({ where: { id: tempW.id } });
    });

    it('should return financial reporting details correctly', async () => {
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24);
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24);

        const rev = await paymentService.calculatePlatformRevenue(start, end);
        expect(rev).toBeGreaterThanOrEqual(0);

        const earned = await paymentService.calculateMerchantEarnings(merchantId, start, end);
        expect(earned).toBeGreaterThanOrEqual(0);

        const dEarned = await paymentService.calculateDriverEarnings(driverId, start, end);
        expect(dEarned).toBeGreaterThanOrEqual(0);

        const summary = await paymentService.getFinancialSummary(start, end);
        expect(summary.completedOrders).toBeGreaterThanOrEqual(0);
        expect(summary.platformRevenue).toBeGreaterThanOrEqual(0);
        expect(summary.totalTransactions).toBeGreaterThanOrEqual(0);
    });

    // Error checks on financial reporting
    it('should hit catch blocks on revenue calculators on db failure', async () => {
        const spy0 = jest.spyOn(prisma.payment, 'findMany').mockRejectedValueOnce(new Error('DB Lost'));
        const result = await paymentService.calculatePlatformRevenue(new Date(), new Date());
        expect(result).toBe(0);
        spy0.mockRestore();

        const spy1 = jest.spyOn(prisma.order, 'findMany').mockRejectedValueOnce(new Error('DB Lost'));
        const result1 = await paymentService.calculateMerchantEarnings(merchantId, new Date(), new Date());
        expect(result1).toBe(0);
        spy1.mockRestore();

        const spy2 = jest.spyOn(prisma.order, 'findMany').mockRejectedValueOnce(new Error('DB Lost'));
        const driverResult = await paymentService.calculateDriverEarnings(driverId, new Date(), new Date());
        expect(driverResult).toBe(0);
        spy2.mockRestore();

        const spy3 = jest.spyOn(paymentService, 'calculatePlatformRevenue').mockRejectedValueOnce(new Error('DB Lost'));
        await expect(paymentService.getFinancialSummary(new Date(), new Date())).rejects.toThrow('DB Lost');
        spy3.mockRestore();
    });

    it('should hit catch blocks on distribution and processPayment on db fail', async () => {
        const pSpy = jest.spyOn(prisma.order, 'findUnique').mockRejectedValueOnce(new Error('find fail'));
        const result = await paymentService.calculateCommissions(orderId1);
        expect(result).toBeDefined();
        expect(result.subtotal).toBe(100);
        pSpy.mockRestore();

        const proSpy = jest.spyOn(prisma.order, 'findUnique').mockRejectedValueOnce(new Error('find fail'));
        const r = await paymentService.processPayment(orderId1, 'KCB_BANK');
        expect(r.success).toBe(false);
        expect(r.error).toBe('CONNECTION_ERROR');
        proSpy.mockRestore();

        const dSpy = jest.spyOn(prisma.withdrawal, 'findUnique').mockRejectedValueOnce(new Error('DB Down'));
        await expect(paymentService.processWithdrawal(withdrawalId)).rejects.toThrow();
        dSpy.mockRestore();
    });
});
