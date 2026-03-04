
import { WalletTxType, OrderStatus } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { createOrder, cancelOrder, updateOrderStatus } from '../src/controllers/order.controller'; // We will invoke controllers or services directly for speed, or simulate requests

// Mock Request/Response
const mockReq = (body: any = {}, user: any = {}, params: any = {}) => ({
    body,
    user,
    params,
    query: {}
} as any);

const mockRes = () => {
    const res: any = {};
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data: any) => {
        res.data = data;
        return res;
    };
    return res;
};

async function main() {
    console.log('🛑 STARTING CODE RED VERIFICATION (SHADOW MODE SIMULATION) 🛑');

    try {
        // 1. Setup Data
        const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
        const merchant = await prisma.user.findFirst({ where: { role: 'MERCHANT' } }); // User who is merchant
        const merchantProfile = await prisma.merchant.findFirst({ where: { userId: merchant?.id } });
        const driver = await prisma.user.findFirst({ where: { role: 'DRIVER' } });
        let driverProfile = await prisma.driver.findFirst({ where: { userId: driver?.id } });
        let product = await prisma.product.findFirst({ where: { merchantId: merchantProfile?.userId } });

        if (!customer || !merchant || !driver) {
            console.error('❌ Missing Test User Data (Customer, Merchant, or Driver). Run seed first.');
            process.exit(1);
        }

        // Ensure Profiles Exist (Foreign Key Requirements)
        if (!merchantProfile) {
            console.log('⚠️ Merchant Profile missing. Creating one...');
            await prisma.merchant.create({
                data: {
                    userId: merchant.id,
                    storeName: 'Test Store',
                    address: 'Sana\'a',
                    lat: 15.3694,
                    lng: 44.1910,
                    type: 'MERCHANT',
                    commissionRate: 0.05,
                    isApproved: true,
                    bankName: 'Test Bank',
                    accountName: 'Test Account',
                    accountNumber: '1234567890'
                }
            });
        }

        if (!driverProfile) {
            console.log('⚠️ Driver Profile missing. Creating one...');
            driverProfile = await prisma.driver.create({
                data: {
                    userId: driver.id,
                    vehicleType: 'Car',
                    vehicleNumber: '1234',
                    isApproved: true,
                    isAvailable: true,
                    currentLat: 15.3694,
                    currentLng: 44.1910,
                    bankName: 'Driver Bank',
                    accountName: 'Driver Account',
                    accountNumber: '0987654321'
                }
            });
        }

        // Re-fetch product if it was missing due to missing profile or just check
        if (!product) {
            console.log('⚠️ Product missing. Creating one...');
            product = await prisma.product.create({
                data: {
                    merchantId: merchant.id,
                    name: 'Test Product',
                    price: 1500,
                    category: 'Food',
                    isAvailable: true,
                    stock: 10
                }
            });
        }

        // Ensure Customer Wallet has funds
        let custWallet = await prisma.wallet.findUnique({ where: { userId: customer.id } });
        if (!custWallet) {
            custWallet = await prisma.wallet.create({ data: { userId: customer.id, balance: 50000, holdBalance: 0, isActive: true, currency: 'YER' } });
        } else {
            // Top up if low
            await prisma.wallet.update({ where: { id: custWallet.id }, data: { balance: 50000, holdBalance: 0 } });
        }

        console.log(`✅ Customer Setup: ${customer.id} | Balance: 50000`);

        // 2. Create Order (Expecting HOLD)
        console.log('\n🧪 TEST 1: Create Order with JEEB_WALLET (Simulating Online Payment)...');
        // Note: JEEB_WALLET in enum, we treat it as "Online" to trigger hold in our logic 
        // (logic says: if !== CASH_ON_DELIVERY -> Hold)

        const createReq = mockReq({
            merchantId: merchantProfile?.userId,
            items: [{ productId: product!.id, quantity: 1 }],
            deliveryAddress: 'Test Addr', deliveryLat: 10, deliveryLng: 10,
            paymentMethod: 'JEEB_WALLET'
        }, { id: customer.id }); // Auth user

        const createRes = mockRes();
        await createOrder(createReq, createRes);

        if (!createRes.data || !createRes.data.data || !createRes.data.data.id) {
            console.error('❌ Create Order Failed:', createRes.data);
            process.exit(1);
        }
        const orderId = createRes.data.data.id;
        console.log(`✅ Order Created: ${orderId}`);

        // VERIFY HOLD
        const holdTx = await prisma.walletTransaction.findFirst({
            where: {
                walletId: custWallet?.id,
                transactionType: 'HOLD',
                referenceId: orderId
            },
            orderBy: { createdAt: 'desc' }
        });

        if (holdTx) {
            console.log(`✅ EVIDENCE: Wallet Hold Transaction Found! ID: ${holdTx.id}, Amount: ${holdTx.amount}`);
        } else {
            console.error('❌ FAIL: No Hold Transaction found.');
            // process.exit(1); // Don't exit, keep checking
        }

        const updatedCustWallet = await prisma.wallet.findUnique({ where: { userId: customer.id } });
        console.log(`ℹ️ Customer HoldBalance: ${updatedCustWallet?.holdBalance} (Should be > 0)`);


        // 3. Test Cancel -> Release
        console.log('\n🧪 TEST 2: Cancel Order (Expect Release)...');
        const cancelReq = mockReq({ reason: 'Test Cancel' }, { id: customer.id }, { id: orderId });
        const cancelRes = mockRes();
        await cancelOrder(cancelReq, cancelRes);

        // Verify Release
        const releaseTx = await prisma.walletTransaction.findFirst({
            where: {
                walletId: custWallet?.id,
                transactionType: 'RELEASE',
                referenceId: orderId
            }
        });

        if (releaseTx) {
            console.log(`✅ EVIDENCE: Wallet Release Transaction Found! ID: ${releaseTx.id}`);
        } else {
            console.error('❌ FAIL: No Release Transaction found.');
        }

        const finalCustWallet = await prisma.wallet.findUnique({ where: { userId: customer.id } });
        console.log(`ℹ️ Customer HoldBalance after Cancel: ${finalCustWallet?.holdBalance} (Should be 0 if only one order)`);


        // 4. Test Completion & Commission
        console.log('\n🧪 TEST 3: Complete Success Flow (Order -> Deliver -> Commission)...');
        // Create new order
        await createOrder(createReq, createRes); // res reused, data overwritten
        const successOrderId = createRes.data.data.id;
        console.log(`   New Order: ${successOrderId}`);

        // Manually assign driver (Simulate Acceptance)
        await prisma.order.update({
            where: { id: successOrderId },
            data: {
                driverId: driver.id,
                status: 'IN_TRANSIT',
                payment: { update: { status: 'PENDING' } } // Ensure payment exists
            }
        });

        // Update status to DELIVERED (Simulate Driver App)
        // Must provide proofImageUrl or it should fail
        console.log('   Attempting Delivery WITHOUT Proof (Expect Error)...');
        const failDeliverReq = mockReq({ status: 'DELIVERED' }, { id: driver.id }, { id: successOrderId });
        const failDeliverRes = mockRes();
        await updateOrderStatus(failDeliverReq, failDeliverRes);

        if (failDeliverRes.statusCode === 400 && failDeliverRes.data.message.includes('Proof')) {
            console.log('✅ EVIDENCE: PoD Enforcement Worked (Got 400 missing proof).');
        } else {
            console.error('❌ FAIL: Did not enforce PoD.', failDeliverRes.data);
        }

        // Deliver WITH Proof
        console.log('   Attempting Delivery WITH Proof...');
        const successDeliverReq = mockReq({
            status: 'DELIVERED',
            proofImageUrl: 'http://evidence.com/proof.jpg',
            deliverySignature: 'signed'
        }, { id: driver.id }, { id: successOrderId });
        await updateOrderStatus(successDeliverReq, failDeliverRes); // Reuse res object

        if (failDeliverRes.data.status === 'success') {
            console.log('✅ Order Delivered Successfully.');
        } else {
            console.error('❌ Order Delivery Failed:', failDeliverRes.data);
        }

        // Poll for Payment Distribution Confirmation (Max 20s)
        console.log('⏳ Waiting for Payment Distribution (Polling for up to 20s)...');

        let merchantTx: any = null;
        let attempts = 0;
        const maxAttempts = 10;
        const merchWallet = await prisma.wallet.findUnique({ where: { userId: merchant.id } });

        while (attempts < maxAttempts) {
            attempts++;
            merchantTx = await prisma.walletTransaction.findFirst({
                where: { walletId: merchWallet?.id, referenceId: successOrderId, transactionType: 'CREDIT' }
            });

            if (merchantTx) {
                console.log(`✅ EVIDENCE: Payment Distributed! Found after ${attempts * 2}s.`);
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // VERIFY COMMISSION DISTRIBUTION
        if (merchantTx) {
            console.log(`✅ EVIDENCE: Merchant Credited! Amount: ${merchantTx.amount}`);
        } else {
            console.error('❌ FAIL: Merchant not credited after timeout.');
        }

        // Check Customer CAPTURE
        const captureTx = await prisma.walletTransaction.findFirst({
            where: { walletId: custWallet?.id, referenceId: successOrderId, transactionType: 'DEBIT' } // Capture uses DEBIT type
        });
        if (captureTx && captureTx.description?.includes('Payment')) {
            console.log(`✅ EVIDENCE: Customer Funds Captured! Amount: ${captureTx.amount}`);
        } else {
            console.error('❌ FAIL: Customer funds not captured.');
        }

        console.log('\n🔥 VERIFICATION COMPLETE 🔥');

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
