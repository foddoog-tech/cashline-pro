import { PrismaClient, PaymentMethod, OrderStatus } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export interface PaymentResult {
    success: boolean;
    transactionId?: string;
    message: string;
    error?: string;
}

export interface CommissionBreakdown {
    subtotal: number;
    deliveryFee: number;
    platformFee: number;
    totalAmount: number;
    merchantNet: number;
    driverFee: number;
}

export interface KCBResponse {
    success: boolean;
    transactionId?: string;
    message: string;
}

export interface JeebResponse {
    success: boolean;
    transactionId?: string;
    message: string;
}

export class PaymentService {
    /**
     * معالجة الدفع
     */
    async processPayment(orderId: string, method: PaymentMethod): Promise<PaymentResult> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    merchant: true,
                    customer: true,
                },
            });

            if (!order) {
                return {
                    success: false,
                    message: 'Order not found',
                    error: 'ORDER_NOT_FOUND',
                };
            }

            if (order.isPaid) {
                return {
                    success: false,
                    message: 'Order already paid',
                    error: 'ALREADY_PAID',
                };
            }

            let result: PaymentResult;

            switch (method) {
                case 'CASH_ON_DELIVERY':
                    result = await this.processCashPayment(orderId);
                    break;

                case 'KCB_BANK':
                    result = await this.processKCBPayment(orderId);
                    break;

                case 'JEEB_WALLET':
                    result = await this.processJeebPayment(orderId);
                    break;

                default:
                    return {
                        success: false,
                        message: 'Invalid payment method',
                        error: 'INVALID_METHOD',
                    };
            }

            if (result.success) {
                // تحديث حالة الطلب
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        isPaid: true,
                        paidAt: new Date(),
                    },
                });

                // إنشاء سجل الدفع
                await this.createPaymentRecord(orderId, result.transactionId);
            }

            return result;
        } catch (error) {
            console.error('Error processing payment:', error);
            return {
                success: false,
                message: 'Payment processing failed',
                error: 'PROCESSING_ERROR',
            };
        }
    }

    /**
     * معالجة الدفع عند الاستلام
     */
    private async processCashPayment(orderId: string): Promise<PaymentResult> {
        // الدفع عند الاستلام لا يحتاج معالجة فورية
        // سيتم تأكيد الدفع عند التسليم
        return {
            success: true,
            transactionId: `CASH_${orderId}_${Date.now()}`,
            message: 'Cash on delivery confirmed',
        };
    }

    /**
     * معالجة الدفع عبر KCB Bank (LIVE INTEGRATION)
     */
    private async processKCBPayment(orderId: string): Promise<PaymentResult> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { customer: { include: { user: true } } }
            });

            if (!order) return { success: false, message: 'Order not found' };

            // 1. Prepare KCB Payment Request
            const kcbUrl = process.env.KCB_API_URL;
            const apiKey = process.env.KCB_API_KEY;

            if (!apiKey) {
                console.error('❌ KCB API Key missing in .env');
                return { success: false, message: 'System configuration error', error: 'CONFIG_ERROR' };
            }

            // Unique Reference
            const reference = `ORD-${orderId.split('-')[0].toUpperCase()}-${Date.now()}`;

            console.log(`🔌 Initiating KCB Payment for ${reference}...`);

            // 2. Execute Real API Call
            const response = await axios.post(
                kcbUrl || 'https://api.kcb.com/v1/payments', // Fallback URL
                {
                    amount: Number(order.totalAmount),
                    currency: 'YER',
                    reference: reference,
                    narrative: `Order Payment #${orderId}`,
                    customer: {
                        phone: order.customer?.user?.phone || '000000000',
                        name: order.customer?.user?.fullName || 'Customer'
                    },
                    callback_url: `${process.env.API_URL}/api/v1/payments/webhook`
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`, // Or Basic Auth depending on specific KCB docs
                        'Content-Type': 'application/json',
                        'X-Source-System': 'CASHLINE_APP'
                    },
                    timeout: 15000 // 15s timeout
                }
            );

            // 3. Handle Response
            if (response.data && (response.data.status === 'SUCCESS' || response.data.status === 'PENDING')) {
                console.log(`✅ KCB Response: ${response.data.transaction_id}`);
                return {
                    success: true,
                    transactionId: response.data.transaction_id || reference,
                    message: 'Payment processed successfully',
                };
            } else {
                console.error('❌ KCB Declined:', response.data);
                return {
                    success: false,
                    message: response.data?.message || 'Payment declined',
                    error: 'BANK_DECLINED'
                };
            }

        } catch (error: any) {
            console.error('⚡ KCB Integration Error:', error.message);

            return {
                success: false,
                message: 'Connection failed',
                error: 'CONNECTION_ERROR',
            };
        }
    }

    /**
     * معالجة الدفع عبر محفظة جيب
     */
    private async processJeebPayment(orderId: string): Promise<PaymentResult> {
        try {
            // TODO: تكامل محفظة جيب API
            // هذا مثال افتراضي - يجب استبداله بالـ API الحقيقي

            const order = await prisma.order.findUnique({
                where: { id: orderId },
            });

            if (!order) {
                return {
                    success: false,
                    message: 'Order not found',
                };
            }

            // مؤقتاً: إرجاع نجاح افتراضي
            console.warn('Jeeb Wallet API not configured. Using mock payment.');
            return {
                success: true,
                transactionId: `JEEB_${orderId}_${Date.now()}`,
                message: 'Jeeb payment successful (MOCK)',
            };
        } catch (error) {
            console.error('Error processing Jeeb payment:', error);
            return {
                success: false,
                message: 'Jeeb payment failed',
                error: 'JEEB_ERROR',
            };
        }
    }

    /**
     * حساب العمولات
     */
    async calculateCommissions(orderId: string): Promise<CommissionBreakdown> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { merchant: true },
            });

            if (!order) {
                throw new Error('Order not found');
            }

            const subtotal = Number(order.subtotal);
            const deliveryFee = Number(order.deliveryFee);
            const commissionRate = order.merchant.commissionRate;

            // حساب عمولة المنصة
            const platformFee = subtotal * Number(commissionRate);

            // حساب صافي التاجر (بعد خصم العمولة)
            const merchantNet = subtotal - platformFee;

            // رسوم المندوب (كامل رسوم التوصيل)
            const driverFee = deliveryFee;

            const totalAmount = subtotal + deliveryFee;

            return {
                subtotal,
                deliveryFee,
                platformFee,
                totalAmount,
                merchantNet,
                driverFee,
            };
        } catch (error) {
            console.error('Error calculating commissions:', error);
            throw error;
        }
    }

    /**
     * إنشاء سجل الدفع
     */
    private async createPaymentRecord(
        orderId: string,
        transactionId?: string
    ): Promise<void> {
        try {
            const breakdown = await this.calculateCommissions(orderId);

            await prisma.payment.create({
                data: {
                    orderId,
                    totalAmount: breakdown.totalAmount,
                    platformFee: breakdown.platformFee,
                    driverFee: breakdown.driverFee,
                    merchantNet: breakdown.merchantNet,
                    status: 'completed',
                    transactionId: transactionId || `TXN_${orderId}_${Date.now()}`,
                },
            });
        } catch (error) {
            console.error('Error creating payment record:', error);
            throw error;
        }
    }

    /**
     * توزيع المبالغ (بعد تسليم الطلب)
     */
    async distributePayment(orderId: string): Promise<void> {
        try {
            console.log(`💰 Starting fund distribution for Order #${orderId}`);
            const { WalletService } = require('./wallet.service');

            await prisma.$transaction(async (tx) => {
                const order = await tx.order.findUnique({
                    where: { id: orderId },
                    include: { payment: true },
                });

                if (!order) throw new Error('Order not found');
                if (order.status !== OrderStatus.DELIVERED) throw new Error('Order not delivered yet');
                if (!order.payment) throw new Error('Payment record not found');
                if (order.payment.status === 'distributed') {
                    console.log('Skipping distribution, already distributed.');
                    return;
                }

                console.log('Calculating commissions...');
                const breakdown = await this.calculateCommissions(orderId);

                // 1. Capture Customer Funds (HOLD -> CAPTURE)
                if (order.paymentMethod !== 'CASH_ON_DELIVERY') {
                    console.log(`Capturing customer funds: ${breakdown.totalAmount}`);
                    await WalletService.capture(
                        order.customerId,
                        breakdown.totalAmount,
                        `Payment for Order #${orderId}`,
                        {
                            tx,
                            referenceType: 'ORDER',
                            referenceId: orderId
                        }
                    );
                    console.log(`✅ Captured Customer Payment`);
                }

                // 2. Credit Merchant
                console.log(`Crediting Merchant: ${breakdown.merchantNet}`);
                await WalletService.credit(
                    order.merchantId,
                    breakdown.merchantNet,
                    {
                        tx,
                        description: `Sale Revenue: Order #${orderId}`,
                        referenceType: 'ORDER',
                        referenceId: orderId
                    }
                );
                console.log(`✅ Credited Merchant`);

                // 3. Credit Driver
                if (order.driverId && breakdown.driverFee > 0) {
                    console.log(`Crediting Driver: ${breakdown.driverFee}`);
                    await WalletService.credit(
                        order.driverId,
                        breakdown.driverFee,
                        {
                            tx,
                            description: `Delivery Fee: Order #${orderId}`,
                            referenceType: 'ORDER',
                            referenceId: orderId
                        }
                    );
                    console.log(`✅ Credited Driver`);
                }

                // 4. Update Payment Status
                await tx.payment.update({
                    where: { id: order.payment.id },
                    data: { status: 'distributed' }
                });

                console.log('Payment Distribution Completed Successfully.');
            }, {
                maxWait: 5000,
                timeout: 15000
            });

            console.log(`🎉 Payment fully distributed for order ${orderId}`);
        } catch (error) {
            console.error('Error distributing payment:', error);
            throw error;
        }
    }

    /**
     * معالجة طلبات السحب
     */
    async processWithdrawal(withdrawalId: string): Promise<void> {
        try {
            const withdrawal = await prisma.withdrawal.findUnique({
                where: { id: withdrawalId },
                include: { driver: { include: { user: true } } },
            });

            if (!withdrawal) {
                throw new Error('Withdrawal not found');
            }

            if (withdrawal.status !== 'approved') {
                throw new Error('Withdrawal not approved');
            }

            // TODO: تحويل المبلغ للمندوب عبر KCB أو جيب
            // هذا يتطلب تكامل مع نظام الدفع الخارجي

            // تحديث حالة السحب
            await prisma.withdrawal.update({
                where: { id: withdrawalId },
                data: {
                    status: 'completed',
                    processedAt: new Date(),
                },
            });

            console.log(`Withdrawal ${withdrawalId} processed successfully`);
        } catch (error) {
            console.error('Error processing withdrawal:', error);
            throw error;
        }
    }

    /**
     * التحقق من حالة الدفع
     */
    async verifyPayment(transactionId: string): Promise<{ status: string; isPaid: boolean }> {
        try {
            const payment = await prisma.payment.findFirst({
                where: { transactionId },
            });

            if (!payment) {
                return { status: 'not_found', isPaid: false };
            }

            return {
                status: payment.status,
                isPaid: payment.status === 'completed',
            };
        } catch (error) {
            console.error('Error verifying payment:', error);
            throw error;
        }
    }

    /**
     * حساب إجمالي أرباح المنصة
     */
    async calculatePlatformRevenue(startDate: Date, endDate: Date): Promise<number> {
        try {
            const payments = await prisma.payment.findMany({
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                    status: 'completed',
                },
            });

            const totalRevenue = payments.reduce(
                (sum, payment) => sum + Number(payment.platformFee),
                0
            );

            return totalRevenue;
        } catch (error) {
            console.error('Error calculating platform revenue:', error);
            throw error;
        }
    }

    /**
     * حساب أرباح التاجر
     */
    async calculateMerchantEarnings(
        merchantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        try {
            const orders = await prisma.order.findMany({
                where: {
                    merchantId,
                    status: OrderStatus.DELIVERED,
                    deliveredAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            });

            const totalEarnings = orders.reduce(
                (sum, order: any) => sum + (order.payment ? Number(order.payment.merchantNet) : 0),
                0
            );

            return totalEarnings;
        } catch (error) {
            console.error('Error calculating merchant earnings:', error);
            throw error;
        }
    }

    /**
     * حساب أرباح المندوب
     */
    async calculateDriverEarnings(
        driverId: string,
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        try {
            const orders = await prisma.order.findMany({
                where: {
                    driverId,
                    status: OrderStatus.DELIVERED,
                    deliveredAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                include: { payment: true },
            });

            const totalEarnings = orders.reduce(
                (sum, order: any) => sum + (order.payment ? Number(order.payment.driverFee) : 0),
                0
            );

            return totalEarnings;
        } catch (error) {
            console.error('Error calculating driver earnings:', error);
            throw error;
        }
    }

    /**
     * الحصول على ملخص مالي
     */
    async getFinancialSummary(startDate: Date, endDate: Date) {
        try {
            const platformRevenue = await this.calculatePlatformRevenue(startDate, endDate);

            const completedOrders = await prisma.order.count({
                where: {
                    status: OrderStatus.DELIVERED,
                    deliveredAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            });

            const totalTransactions = await prisma.payment.aggregate({
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                    status: 'completed',
                },
                _sum: {
                    totalAmount: true,
                },
            });

            return {
                platformRevenue,
                completedOrders,
                totalTransactions: Number(totalTransactions._sum.totalAmount || 0),
                period: {
                    start: startDate,
                    end: endDate,
                },
            };
        } catch (error) {
            console.error('Error getFinancialSummary:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const paymentService = new PaymentService();
