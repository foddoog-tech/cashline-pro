import { WalletService } from '../../../src/services/wallet.service';
import { PrismaClient } from '@prisma/client';
import prismaClient from '../../../src/lib/prisma'; // Important for spy

const prisma = new PrismaClient();

describe('WalletService - Escrow & Refund Logic', () => {
    let customerUserId: string;

    beforeAll(async () => {
        // Create a dummy user for testing wallet logic
        const user = await prisma.user.create({
            data: {
                phone: `+967${Math.floor(Math.random() * 100000000)}`,
                passwordHash: 'dummy',
                role: 'CUSTOMER',
                fullName: 'Test Complete Customer'
            }
        });
        customerUserId = user.id;

        // Create wallet
        await WalletService.createWallet(customerUserId, 'YER');
    });

    afterAll(async () => {
        // Cleanup all transactions for the user
        await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: customerUserId } } });
        await prisma.wallet.deleteMany({ where: { userId: customerUserId } });
        await prisma.user.delete({ where: { id: customerUserId } });
        await prisma.$disconnect();
    });

    it('should hold funds correctly (Escrow) and reduce available balance', async () => {
        // 1. Credit the wallet with 500 first
        await WalletService.credit(customerUserId, 500, { description: 'Initial Deposit' });

        const walletBefore = await prisma.wallet.findUnique({ where: { userId: customerUserId } });
        expect(Number(walletBefore?.balance)).toBe(500);
        expect(Number(walletBefore?.holdBalance)).toBe(0);

        // 2. Hold 200
        await WalletService.hold(customerUserId, 200, 'Hold for Order #TEST_1');

        const walletAfterHold = await prisma.wallet.findUnique({ where: { userId: customerUserId } });
        expect(Number(walletAfterHold?.balance)).toBe(500);
        expect(Number(walletAfterHold?.holdBalance)).toBe(200);

        const availableBalance = Number(walletAfterHold!.balance) - Number(walletAfterHold!.holdBalance);
        expect(availableBalance).toBe(300);
    });

    it('should refund funds correctly in less than 5 seconds', async () => {
        const start = Date.now();

        await WalletService.release(customerUserId, 200, 'Refund for Order #TEST_1');

        const walletAfterRelease = await prisma.wallet.findUnique({ where: { userId: customerUserId } });
        expect(Number(walletAfterRelease?.holdBalance)).toBe(0);

        const end = Date.now();
        expect(end - start).toBeLessThan(5000);
    });

    // 5. Boundary testing (0 and negative)
    it('should reject zero or negative amounts for all operations', async () => {
        await expect(WalletService.credit(customerUserId, 0)).rejects.toThrow('Amount must be positive');
        await expect(WalletService.credit(customerUserId, -50)).rejects.toThrow('Amount must be positive');
        await expect(WalletService.debit(customerUserId, 0)).rejects.toThrow('Amount must be positive');
        await expect(WalletService.debit(customerUserId, -100)).rejects.toThrow('Amount must be positive');
        await expect(WalletService.hold(customerUserId, -10, 'Hold')).rejects.toThrow('Amount must be positive');
        await expect(WalletService.release(customerUserId, -10, 'Release')).rejects.toThrow('Amount must be positive');
        await expect(WalletService.capture(customerUserId, -10, 'Capture')).rejects.toThrow('Amount must be positive');
    });

    // 6. Floating point Precision Issue Fix (using bounds and decimal representation check)
    it('should handle decimal fractional units gracefully (Floating Point)', async () => {
        // Wallet currently has 500
        await WalletService.credit(customerUserId, 100.999, { description: 'Fractional deposit' }); // Total: 600.999

        const walletBefore = await prisma.wallet.findUnique({ where: { userId: customerUserId } });
        // Since database is Decimal(12,2) it might round. Let's just assure it doesn't crash and holds right value
        const balanceNum = Number(walletBefore?.balance);
        expect(balanceNum).toBeGreaterThanOrEqual(600.99);
        expect(balanceNum).toBeLessThanOrEqual(601.001);

        await WalletService.debit(customerUserId, 5.049, { description: 'Fractional deduction' });

        const walletAfter = await prisma.wallet.findUnique({ where: { userId: customerUserId } });
        const finalNum = Number(walletAfter?.balance);
        expect(finalNum).toBeGreaterThanOrEqual(595.94);
        expect(finalNum).toBeLessThanOrEqual(595.96);
    });

    it('should reject insufficient funds for debit and hold', async () => {
        const currentWallet = await prisma.wallet.findUnique({ where: { userId: customerUserId } });
        const overkill = Number(currentWallet?.balance) + 500;
        await expect(WalletService.debit(customerUserId, overkill)).rejects.toThrow('Insufficient balance');
        await expect(WalletService.hold(customerUserId, overkill, 'Hold')).rejects.toThrow('Insufficient available balance');
    });

    it('should capture previously held funds correctly without altering total balance arbitrarily', async () => {
        // Current balance around 595.95
        await WalletService.hold(customerUserId, 50, 'Hold 50');

        let wallet = await prisma.wallet.findUnique({ where: { userId: customerUserId } });
        expect(Number(wallet?.holdBalance)).toBe(50);
        const originalBalance = Number(wallet?.balance);

        await WalletService.capture(customerUserId, 50, 'Capture 50');

        wallet = await prisma.wallet.findUnique({ where: { userId: customerUserId } });

        // Balance decreased, Hold decreased
        expect(Number(wallet?.balance)).toBeCloseTo(originalBalance - 50, 1);
        expect(Number(wallet?.holdBalance)).toBe(0);
    });

    // DB transaction Error recovery Check
    it('should handle database connection failure or transaction error during debit safely', async () => {
        // Mock prisma client throw error
        const mockTransaction = jest.spyOn(prismaClient, '$transaction').mockRejectedValueOnce(new Error('Simulated Database Crash'));

        const walletBefore = await prisma.wallet.findUnique({ where: { userId: customerUserId } });

        await expect(WalletService.debit(customerUserId, 10)).rejects.toThrow('Simulated Database Crash');

        // Verify balance hasn't changed at all due to crash (Rollback)
        const walletAfter = await prisma.wallet.findUnique({ where: { userId: customerUserId } });
        expect(Number(walletAfter?.balance)).toBe(Number(walletBefore?.balance));

        mockTransaction.mockRestore(); // Restore original
    });

    // Concurrency Check
    it('should handle concurrent debits safely', async () => {
        const user = await prisma.user.create({
            data: { phone: `+967${Math.floor(Math.random() * 100000000)}`, passwordHash: 'dummy', role: 'CUSTOMER', fullName: 'Concurrency Tester' }
        });
        await WalletService.createWallet(user.id, 'YER');
        await WalletService.credit(user.id, 100);

        // Two concurrent 60 debits
        const p1 = WalletService.debit(user.id, 60);
        const p2 = WalletService.debit(user.id, 60);

        const results = await Promise.allSettled([p1, p2]);
        const fulfilled = results.filter(r => r.status === 'fulfilled');

        expect(fulfilled.length).toBeGreaterThanOrEqual(1);

        const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
        const finalBalance = Number(wallet?.balance);

        expect(finalBalance).toBeGreaterThanOrEqual(0); // NO OVERDRAFT.

        await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: user.id } } });
        await prisma.wallet.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
    });

    it('should throw error if wallet not found or inactive', async () => {
        await expect(WalletService.credit('non-existent', 50)).rejects.toThrow('Wallet not found');
        await expect(WalletService.debit('non-existent', 50)).rejects.toThrow('Wallet not found');

        // Test inactive
        const user = await prisma.user.create({
            data: { phone: `+967${Math.floor(Math.random() * 100000000)}`, passwordHash: 'dummy', role: 'CUSTOMER', fullName: 'Inactive Tester' }
        });
        await WalletService.createWallet(user.id, 'YER');
        await prisma.wallet.update({ where: { userId: user.id }, data: { isActive: false } });

        await expect(WalletService.credit(user.id, 50)).rejects.toThrow('Wallet is inactive');
        await expect(WalletService.debit(user.id, 50)).rejects.toThrow('Wallet is inactive');

        await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: user.id } } });
        await prisma.wallet.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
    });

    it('should throw WalletNotFound when trying to hold from non-existent wallet', async () => {
        const fakeUserId = 'non-existent-user-123';
        await expect(WalletService.hold(fakeUserId, 100, 'Hold error'))
            .rejects.toThrow('Wallet not found');
    });

    it('should release held funds back to available balance', async () => {
        // Create isolated user for clean math
        const userR = await prisma.user.create({ data: { phone: `+967${Math.floor(Math.random() * 100000000)}`, passwordHash: 'x', role: 'CUSTOMER', fullName: 'Release Test' } });
        await WalletService.createWallet(userR.id, 'YER');
        await WalletService.credit(userR.id, 500);

        // Hold 100
        await WalletService.hold(userR.id, 100, 'Hold test');

        let wallet = await prisma.wallet.findUnique({ where: { userId: userR.id } });
        expect(Number(wallet?.holdBalance)).toBe(100);
        expect(Number(wallet?.balance)).toBe(500);

        // Release 40
        await WalletService.release(userR.id, 40, 'Release test');

        wallet = await prisma.wallet.findUnique({ where: { userId: userR.id } });
        expect(Number(wallet?.holdBalance)).toBe(60); // 100 - 40
        expect(Number(wallet?.balance)).toBe(500);

        // cleanup
        await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: userR.id } } });
        await prisma.wallet.deleteMany({ where: { userId: userR.id } });
        await prisma.user.delete({ where: { id: userR.id } });
    });

    it('should capture held funds (move from held to platform/merchant)', async () => {
        const userC = await prisma.user.create({ data: { phone: `+967${Math.floor(Math.random() * 100000000)}`, passwordHash: 'x', role: 'CUSTOMER', fullName: 'Capture Test' } });
        await WalletService.createWallet(userC.id, 'YER');
        await WalletService.credit(userC.id, 1000);

        // Hold 300
        await WalletService.hold(userC.id, 300, 'Hold test');

        // Capture 200
        await WalletService.capture(userC.id, 200, 'Capture test');

        const wallet = await prisma.wallet.findUnique({ where: { userId: userC.id } });

        // Total balance decreases by captured amount
        expect(Number(wallet?.balance)).toBe(800);
        // Hold decreases by captured amount
        expect(Number(wallet?.holdBalance)).toBe(100);

        // cleanup
        await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: userC.id } } });
        await prisma.wallet.deleteMany({ where: { userId: userC.id } });
        await prisma.user.delete({ where: { id: userC.id } });
    });

});
