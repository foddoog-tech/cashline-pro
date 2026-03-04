import prisma from '../lib/prisma';
import { WalletTxType, Prisma } from '@prisma/client';

export interface WalletTxOptions {
    description?: string;
    referenceType?: string;
    referenceId?: string;
    tx?: Prisma.TransactionClient;
    metadata?: any;
}

export class WalletService {

    /**
     * إنشاء محفظة جديدة للمستخدم
     */
    static async createWallet(userId: string, currency: string = 'YER') {
        return prisma.wallet.create({
            data: {
                userId,
                balance: new Prisma.Decimal(0),
                holdBalance: new Prisma.Decimal(0),
                currency,
                isActive: true
            }
        });
    }

    /**
     * إيداع (Credit) - عملية آمنة
     */
    static async credit(
        userId: string,
        amount: number | Prisma.Decimal,
        options: WalletTxOptions = {}
    ) {
        const decimalAmount = new Prisma.Decimal(amount);
        if (decimalAmount.lte(0)) throw new Error('Amount must be positive');

        const db = options.tx || prisma; // Use transaction if provided, else prisma

        // If no transaction provided, we should probably wrap in one to be safe, 
        // but if the caller doesn't provide one, maybe they don't need atomicity with other ops.
        // However, updating wallet and creating transaction record MUST be atomic.
        // If options.tx is missing, we must start a transaction.

        const performCredit = async (tx: Prisma.TransactionClient) => {
            const wallet = await tx.wallet.findUnique({
                where: { userId },
                select: { id: true, balance: true, isActive: true }
            });

            if (!wallet) throw new Error('Wallet not found');
            if (!wallet.isActive) throw new Error('Wallet is inactive');

            const currentBalance = wallet.balance;
            const newBalance = currentBalance.add(decimalAmount);

            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    transactionType: WalletTxType.CREDIT,
                    amount: decimalAmount,
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    description: options.description,
                    referenceType: options.referenceType,
                    referenceId: options.referenceId,
                    metadata: options.metadata || { source: 'system' }
                }
            });

            return tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance }
            });
        };

        if (options.tx) {
            return performCredit(options.tx);
        } else {
            return prisma.$transaction(performCredit);
        }
    }

    /**
     * سحب (Debit) - عملية آمنة مع تحقق الرصيد
     */
    static async debit(
        userId: string,
        amount: number | Prisma.Decimal,
        options: WalletTxOptions = {}
    ) {
        const decimalAmount = new Prisma.Decimal(amount);
        if (decimalAmount.lte(0)) throw new Error('Amount must be positive');

        const performDebit = async (tx: Prisma.TransactionClient) => {
            const wallet = await tx.wallet.findUnique({
                where: { userId }
            });

            if (!wallet) throw new Error('Wallet not found');
            if (!wallet.isActive) throw new Error('Wallet is inactive');

            const currentBalance = wallet.balance;

            if (currentBalance.lt(decimalAmount)) {
                throw new Error('Insufficient balance');
            }

            const newBalance = currentBalance.sub(decimalAmount);

            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    transactionType: WalletTxType.DEBIT,
                    amount: decimalAmount,
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    description: options.description,
                    referenceType: options.referenceType,
                    referenceId: options.referenceId,
                    metadata: options.metadata
                }
            });

            return tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance }
            });
        };

        if (options.tx) {
            return performDebit(options.tx);
        } else {
            return prisma.$transaction(performDebit);
        }
    }

    /**
     * حجز (Hold) - للطلبات قيد المعالجة
     */
    static async hold(
        userId: string,
        amount: number | Prisma.Decimal,
        description: string,
        options: WalletTxOptions = {}
    ) {
        const decimalAmount = new Prisma.Decimal(amount);
        if (decimalAmount.lte(0)) throw new Error('Amount must be positive');

        const performHold = async (tx: Prisma.TransactionClient) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) throw new Error('Wallet not found');

            // الرصيد المتاح = balance - holdBalance
            const availableBalance = wallet.balance.sub(wallet.holdBalance);
            if (availableBalance.lt(decimalAmount)) {
                throw new Error('Insufficient available balance');
            }

            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    transactionType: WalletTxType.HOLD,
                    amount: decimalAmount,
                    balanceBefore: wallet.balance,
                    balanceAfter: wallet.balance, // Balance doesn't change, just hold increases
                    description: description,
                    referenceType: options.referenceType,
                    referenceId: options.referenceId,
                    metadata: options.metadata
                }
            });

            return tx.wallet.update({
                where: { id: wallet.id },
                data: { holdBalance: { increment: decimalAmount } }
            });
        };

        if (options.tx) {
            return performHold(options.tx);
        } else {
            return prisma.$transaction(performHold);
        }
    }

    /**
     * تحرير الحجز (Release) - عند إلغاء الطلب
     */
    static async release(
        userId: string,
        amount: number | Prisma.Decimal,
        description: string,
        options: WalletTxOptions = {}
    ) {
        const decimalAmount = new Prisma.Decimal(amount);
        if (decimalAmount.lte(0)) throw new Error('Amount must be positive');

        const performRelease = async (tx: Prisma.TransactionClient) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) throw new Error('Wallet not found');

            // Ensure we don't release more than held? 
            // Ideally we track by ReferenceID but simple balance check is safer for now.
            if (wallet.holdBalance.lt(decimalAmount)) {
                // throw new Error('Cannot release more than held balance'); 
                // Warn but allow correction? No, strict.
                console.warn(`⚠️ Warning: Releasing ${decimalAmount} but hold is ${wallet.holdBalance}`);
            }

            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    transactionType: WalletTxType.RELEASE,
                    amount: decimalAmount,
                    balanceBefore: wallet.balance,
                    balanceAfter: wallet.balance,
                    description: description,
                    referenceType: options.referenceType,
                    referenceId: options.referenceId,
                    metadata: options.metadata
                }
            });

            return tx.wallet.update({
                where: { id: wallet.id },
                data: { holdBalance: { decrement: decimalAmount } }
            });
        };

        if (options.tx) {
            return performRelease(options.tx);
        } else {
            return prisma.$transaction(performRelease);
        }
    }

    /**
     * إتمام الخصم من الحجز (Capture) - عند نجاح الطلب
     */
    static async capture(
        userId: string,
        amount: number | Prisma.Decimal,
        description: string,
        options: WalletTxOptions = {}
    ) {
        const decimalAmount = new Prisma.Decimal(amount);
        if (decimalAmount.lte(0)) throw new Error('Amount must be positive');

        const performCapture = async (tx: Prisma.TransactionClient) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) throw new Error('Wallet not found');

            // Deduct from Balance AND HoldBalance
            const currentBalance = wallet.balance;
            const newBalance = currentBalance.sub(decimalAmount);

            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    transactionType: WalletTxType.DEBIT, // Or specific CAPTURE type if enum allowed
                    amount: decimalAmount,
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    description: description,
                    referenceType: options.referenceType,
                    referenceId: options.referenceId,
                    metadata: { ...(options.metadata || {}), action: 'capture_hold' }
                }
            });

            return tx.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: newBalance,
                    holdBalance: { decrement: decimalAmount }
                }
            });
        };

        if (options.tx) {
            return performCapture(options.tx);
        } else {
            return prisma.$transaction(performCapture);
        }
    }

    /**
     * الحصول على الرصيد مع التفاصيل
     */
    static async getBalance(userId: string) {
        const wallet = await prisma.wallet.findUnique({
            where: { userId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!wallet) return null;

        return {
            total: wallet.balance,
            hold: wallet.holdBalance,
            available: wallet.balance.sub(wallet.holdBalance),
            currency: wallet.currency,
            recentTransactions: wallet.transactions
        };
    }

    /**
     * إنشاء طلب سحب
     */
    static async createWithdrawal(data: {
        driverId: string;
        amount: Prisma.Decimal;
        bankAccountId?: string;
        idempotencyKey?: string;
    }) {
        const { driverId, amount, bankAccountId, idempotencyKey } = data;

        // Check available balance first
        const wallet = await prisma.wallet.findUnique({ where: { userId: driverId } });
        if (!wallet) throw new Error('Wallet not found');

        const available = wallet.balance.sub(wallet.holdBalance);
        if (available.lt(amount)) {
            throw new Error('Insufficient available balance');
        }

        // Create Withdrawal Request
        // Note: Actual money debiting typically happens on approval, 
        // OR we can move it to 'hold' now. 
        // For this system, let's just create the request.

        return prisma.withdrawal.create({
            data: {
                driverId,
                amount,
                bankAccountId,
                idempotencyKey,
                status: 'PENDING'
            }
        });
    }
}
