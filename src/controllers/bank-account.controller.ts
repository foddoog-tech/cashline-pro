import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { EncryptionService } from '../services/encryption.service';

const encryption = new EncryptionService();

// Helper to mask account number
function maskAccountNumber(accNum: string): string {
    if (!accNum) return '';
    return accNum.slice(-4).padStart(accNum.length, '*');
}

export const createBankAccount = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { accountName, accountNumber, iban, bankName, accountType, isDefault } = req.body;

        // Validation (Zod should be used in middleware, but here is a basic check)
        if (!accountName || !accountNumber || !bankName || !accountType) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const result = await prisma.$transaction(async (tx) => {
            // If setting as default, unset others first
            if (isDefault) {
                await tx.bankAccount.updateMany({
                    where: { userId, accountType },
                    data: { isDefault: false }
                });
            }

            return tx.bankAccount.create({
                data: {
                    userId,
                    accountType,
                    bankName,
                    accountNameEncrypted: encryption.encrypt(accountName),
                    accountNumberEncrypted: encryption.encrypt(accountNumber),
                    ibanEncrypted: iban ? encryption.encrypt(iban) : null,
                    isDefault: isDefault || false
                }
            });
        });

        res.json({
            success: true,
            message: 'Bank account added successfully',
            data: {
                id: result.id,
                bankName: result.bankName,
                accountName: accountName, // Return raw for immediate UI feedback if safe, or decrypt result
                accountNumber: maskAccountNumber(accountNumber),
                isDefault: result.isDefault
            }
        });

    } catch (error) {
        console.error('Create Bank Account Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const getMyBankAccounts = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const accounts = await prisma.bankAccount.findMany({
            where: { userId }
        });

        const decryptedAccounts = accounts.map(acc => ({
            id: acc.id,
            bankName: acc.bankName,
            accountType: acc.accountType,
            accountName: encryption.decrypt(acc.accountNameEncrypted),
            accountNumber: maskAccountNumber(encryption.decrypt(acc.accountNumberEncrypted)),
            isDefault: acc.isDefault,
            isVerified: acc.isVerified
        }));

        res.json({
            success: true,
            data: decryptedAccounts
        });
    } catch (error) {
        console.error('Get Bank Accounts Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
