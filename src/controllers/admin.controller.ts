import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AuditService } from '../services/audit.service';
import { EncryptionService } from '../services/encryption.service';
import { WalletService } from '../services/wallet.service';

import { sendSMS } from '../services/sms.service';
import { NotificationService } from '../services/notification.service';

const encryption = new EncryptionService();
const notificationService = new NotificationService();

// Helper function to get decrypted bank info (for admin view only)
async function getDecryptedBankInfo(userId: string, accountType: 'MERCHANT' | 'DRIVER') {
    // 1. Try to get from the new encrypted table
    const bankAccount = await prisma.bankAccount.findFirst({
        where: { userId, accountType, isDefault: true }
    });

    if (bankAccount) {
        try {
            return {
                source: 'encrypted',
                bankName: bankAccount.bankName,
                accountNumber: encryption.decrypt(bankAccount.accountNumberEncrypted),
                accountName: encryption.decrypt(bankAccount.accountNameEncrypted),
                isVerified: bankAccount.isVerified
            };
        } catch (e) {
            console.error('Decryption failed for user:', userId, e);
            return null;
        }
    }

    // 2. Fallback to legacy data (additive-only phase)
    if (accountType === 'MERCHANT') {
        const merchant = await prisma.merchant.findUnique({
            where: { userId },
            select: { bankName: true, accountNumber: true, accountName: true }
        });
        if (merchant?.accountNumber) {
            return {
                source: 'legacy',
                bankName: merchant.bankName,
                accountNumber: merchant.accountNumber,
                accountName: merchant.accountName,
                isVerified: false
            };
        }
    } else {
        const driver = await prisma.driver.findUnique({
            where: { userId },
            select: { bankName: true, accountNumber: true, accountName: true }
        });
        if (driver?.accountNumber) {
            return {
                source: 'legacy',
                bankName: driver.bankName,
                accountNumber: driver.accountNumber,
                accountName: driver.accountName,
                isVerified: false
            };
        }
    }

    return null;
}




// Get Merchant Details (Specific for Merchant View Modal)
export const getMerchantDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // 1. Get basic merchant data
        const merchant = await prisma.merchant.findUnique({
            where: { userId: id },
            include: {
                user: true,
                orders: {
                    where: { isPaid: true, status: 'DELIVERED' },
                    select: { totalAmount: true }
                }
            }
        });

        if (!merchant) {
            return res.status(404).json({ error: 'Merchant not found' });
        }

        // 2. Get Bank Details (Encrypted or Legacy)
        let bankDetails = null;
        let securityWarning = null;

        // Try encrypted table first
        const bankAccount = await prisma.bankAccount.findFirst({
            where: { userId: id, accountType: 'MERCHANT', isDefault: true }
        });

        if (bankAccount) {
            try {
                // Use the existing encryption instance if available, or create new
                bankDetails = {
                    bankName: bankAccount.bankName,
                    accountNumber: encryption.decrypt(bankAccount.accountNumberEncrypted),
                    accountName: encryption.decrypt(bankAccount.accountNameEncrypted),
                    source: 'encrypted'
                };
            } catch (e) {
                console.error('Decryption error:', e);
                bankDetails = null;
            }
        }
        // Fallback to legacy
        else if (merchant.accountNumber) {
            bankDetails = {
                bankName: merchant.bankName,
                accountNumber: merchant.accountNumber,
                accountName: merchant.accountName,
                source: 'legacy'
            };
            securityWarning = 'ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¨ظ†ظƒظٹط© ظ„ظ… طھظڈظ†ظ‚ظ„ ظ„ظ„طھط®ط²ظٹظ† ط§ظ„ظ…ط´ظپط± ط¨ط¹ط¯';
        }

        // 3. Get Wallet
        const wallet = await prisma.wallet.findUnique({
            where: { userId: id }
        });

        // 4. Return Full Response
        return res.json({
            id: merchant.userId,
            storeName: merchant.storeName,
            ownerName: merchant.user.fullName,
            phone: merchant.user.phone,
            email: merchant.user.email,
            address: merchant.address,
            status: merchant.isApproved ? 'ظ…ط¹طھظ…ط¯' : 'ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ظ…ظˆط§ظپظ‚ط©',
            idImageUrl: merchant.idImageUrl,
            licenseImageUrl: merchant.licenseImageUrl,

            // Missing Data in UI
            bankDetails: bankDetails,
            securityWarning: securityWarning,

            wallet: wallet ? {
                total: wallet.balance,
                hold: wallet.holdBalance,
                available: Number(wallet.balance) - Number(wallet.holdBalance),
                currency: wallet.currency
            } : null,

            earnings: merchant.orders?.reduce((sum, order) => sum + Number(order.totalAmount), 0) || 0
        });

    } catch (error) {
        console.error('Error fetching merchant details:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

// Get Users List (Customers, Merchants, Drivers)
export const getUsers = async (req: Request, res: Response) => {
    try {
        const { role, page = 1, limit = 10, search } = req.query;
        // Check if role is passed via route wrapper (req.params or assigned in middleware)
        const targetRole = role || (req as any).targetRole;

        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (targetRole) where.role = targetRole;
        if (search) {
            where.OR = [
                { fullName: { contains: String(search), mode: 'insensitive' } },
                { phone: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                select: {
                    id: true,
                    fullName: true,
                    role: true,
                    phone: true,
                    email: true,
                    isActive: true,
                    createdAt: true,
                    merchant: { select: { isApproved: true, storeName: true } },
                    driver: {
                        select: {
                            isApproved: true,
                            vehicleType: true,
                            isAvailable: true,
                            vehicleNumber: true,
                            idImageUrl: true,
                            licenseImageUrl: true,
                            vehicleImageUrl: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            status: 'success',
            data: {
                users,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get Users Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

// Get Approval Details (Merchant/Driver Request)
export const getApprovalDetails = async (req: Request, res: Response) => {
    console.log('[DEBUG] getApprovalDetails called for ID:', req.params.id);
    try {
        const { id } = req.params;

        // Try to find as Merchant first
        const merchant = await prisma.merchant.findUnique({
            where: { userId: id },
            include: { user: true }
        });

        if (merchant) {
            console.log('[DEBUG] Found merchant, fetching bank info...');
            const bankInfo = await getDecryptedBankInfo(id, 'MERCHANT');
            console.log('[DEBUG] Bank info fetched, fetching wallet...');
            const wallet = await prisma.wallet.findUnique({ where: { userId: id } });
            console.log('[DEBUG] Wallet fetched, sending response...');

            return res.json({
                success: true,
                data: {
                    id: merchant.userId,
                    type: 'MERCHANT',
                    status: merchant.isApproved ? (merchant.user.isActive ? 'APPROVED' : 'SUSPENDED') : 'PENDING',
                    submittedAt: merchant.user.createdAt,
                    personalInfo: {
                        fullName: merchant.user.fullName,
                        phone: merchant.user.phone,
                        email: merchant.user.email,
                        nationalId: 'N/A',
                        city: merchant.address.split(',')[0] || 'Unknown',
                        address: merchant.address,
                    },
                    businessInfo: {
                        storeName: merchant.storeName,
                        commercialRegister: merchant.licenseNumber,
                        taxNumber: 'N/A',
                        bankAccount: bankInfo ? {
                            bank: bankInfo.bankName,
                            number: bankInfo.accountNumber,
                            name: bankInfo.accountName,
                            source: bankInfo.source
                        } : null
                    },
                    wallet: wallet ? {
                        balance: wallet.balance,
                        holdBalance: wallet.holdBalance,
                        currency: wallet.currency
                    } : null,
                    securityWarning: bankInfo?.source === 'legacy' ?
                        'Data not yet migrated to encrypted storage' : null,
                    documents: [
                        { type: 'ط§ظ„ظ‡ظˆظٹط© ط§ظ„ظˆط·ظ†ظٹط©', url: merchant.idImageUrl },
                        { type: 'ط§ظ„ط³ط¬ظ„ ط§ظ„طھط¬ط§ط±ظٹ', url: merchant.licenseImageUrl }
                    ].filter(d => d.url)
                }
            });
        }


        // Try to find as Driver
        const driver = await prisma.driver.findUnique({
            where: { userId: id },
            include: { user: true }
        });

        if (driver) {
            const bankInfo = await getDecryptedBankInfo(id, 'DRIVER');
            const wallet = await prisma.wallet.findUnique({ where: { userId: id } });

            return res.json({
                success: true,
                data: {
                    id: driver.userId,
                    type: 'DRIVER',
                    status: driver.isApproved ? (driver.user.isActive ? 'APPROVED' : 'SUSPENDED') : 'PENDING',
                    submittedAt: driver.user.createdAt,
                    personalInfo: {
                        fullName: driver.user.fullName,
                        phone: driver.user.phone,
                        email: driver.user.email,
                    },
                    vehicleInfo: {
                        type: driver.vehicleType,
                        plateNumber: driver.vehicleNumber,
                        model: 'N/A',
                        year: 'N/A'
                    },
                    bankAccount: bankInfo ? {
                        bank: bankInfo.bankName,
                        number: bankInfo.accountNumber,
                        name: bankInfo.accountName,
                        source: bankInfo.source
                    } : null,
                    wallet: wallet ? {
                        balance: wallet.balance,
                        holdBalance: wallet.holdBalance,
                        currency: wallet.currency
                    } : null,
                    securityWarning: bankInfo?.source === 'legacy' ?
                        'Data not yet migrated to encrypted storage' : null,
                    documents: [
                        { type: 'ط§ظ„ظ‡ظˆظٹط© ط§ظ„ظˆط·ظ†ظٹط©', url: driver.idImageUrl },
                        { type: 'ط±ط®طµط© ط§ظ„ظ‚ظٹط§ط¯ط©', url: driver.licenseImageUrl },
                        { type: 'ط§ط³طھظ…ط§ط±ط© ط§ظ„ظ…ط±ظƒط¨ط©', url: driver.vehicleImageUrl }
                    ].filter(d => d.url)
                }
            });
        }


        return res.status(404).json({ success: false, message: 'Request not found' });

    } catch (error) {
        console.error('Get Approval Details Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Upload Document (For Approval Process)
export const uploadDriverDocument = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { docType } = req.body; // e.g., 'license', 'id_card', 'vehicle'
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${file.filename}`;

        // Determine which table and field to update
        // We'll try to find the user role first or just try update both (inefficient but safe if ID is unique USerID)
        // Best is to check role
        const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.role === 'DRIVER') {
            let updateData: any = {};
            if (docType === 'license') updateData.licenseImageUrl = fileUrl;
            else if (docType === 'id_card') updateData.idImageUrl = fileUrl;
            else if (docType === 'vehicle') updateData.vehicleImageUrl = fileUrl;
            else return res.status(400).json({ success: false, message: 'Invalid docType' });

            await prisma.driver.update({
                where: { userId: id },
                data: updateData
            });
        } else if (user.role === 'MERCHANT') {
            let updateData: any = {};
            if (docType === 'license') updateData.licenseImageUrl = fileUrl; // Valid for merchant commercial register
            else if (docType === 'id_card') updateData.idImageUrl = fileUrl;
            else return res.status(400).json({ success: false, message: 'Invalid docType' });

            await prisma.merchant.update({
                where: { userId: id },
                data: updateData
            });
        }

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: { url: fileUrl }
        });

    } catch (error) {
        console.error('Upload Document Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Approve User
export const approveUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = (req as any).user.userId;

        const result = await prisma.$transaction(async (tx) => {
            // Fetch before state
            const userBefore = await tx.user.findUnique({ where: { id } });
            if (!userBefore) throw new Error('User not found');

            // Activate User
            const user = await tx.user.update({
                where: { id },
                data: { isActive: true }
            });

            // Approve Role Profile
            let profileUpdated: any = null;
            if (user.role === 'MERCHANT') {
                profileUpdated = await tx.merchant.update({
                    where: { userId: id },
                    data: { isApproved: true, approvedAt: new Date(), approvedBy: adminId }
                });
            } else if (user.role === 'DRIVER') {
                profileUpdated = await tx.driver.update({
                    where: { userId: id },
                    data: { isApproved: true }
                });
            }

            // Audit Log
            await AuditService.log({
                tx,
                tableName: 'users',
                recordId: id,
                action: 'APPROVE_USER',
                oldData: userBefore,
                newData: { ...user, profile: profileUpdated },
                performedBy: adminId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] as string
            });

            return { user, profile: profileUpdated };
        });

        res.json({ success: true, message: 'User approved successfully', data: result });
    } catch (error: any) {
        console.error('Approve User Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

// Reject User
export const rejectUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminId = (req as any).user.userId;

        const result = await prisma.$transaction(async (tx) => {
            const userBefore = await tx.user.findUnique({ where: { id } });
            if (!userBefore) throw new Error('User not found');

            let profileUpdated: any = null;
            if (userBefore.role === 'MERCHANT') {
                profileUpdated = await tx.merchant.update({ where: { userId: id }, data: { isApproved: false } });
            } else if (userBefore.role === 'DRIVER') {
                profileUpdated = await tx.driver.update({ where: { userId: id }, data: { isApproved: false } });
            }

            // Create Notification in DB
            await tx.notification.create({
                data: {
                    userId: id,
                    title: 'ط·ظ„ط¨ ط§ظ„طھط³ط¬ظٹظ„ ظ…ط±ظپظˆط¶',
                    body: reason ? `طھظ… ط±ظپط¶ ط·ظ„ط¨ظƒ ظ„ظ„ط³ط¨ط¨: ${reason}` : 'طھظ… ط±ظپط¶ ط·ظ„ط¨ ط§ظ„طھط³ط¬ظٹظ„. ظٹط±ط¬ظ‰ ظ…ط±ط§ط¬ط¹ط© ط¨ظٹط§ظ†ط§طھظƒ.',
                    type: 'ACCOUNT_REJECTED',
                    data: reason ? { reason } : {}
                }
            });

            // Audit
            await AuditService.log({
                tx,
                tableName: 'users', // Fixed property name
                recordId: id, // Fixed property name
                action: 'REJECT_USER',
                oldData: userBefore,
                newData: { ...userBefore, isApproved: false, rejectionReason: reason },
                performedBy: adminId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] as string
            });

            return { userId: id, status: 'REJECTED' };
        });

        // Send Push Notification (Fire & Forget)
        notificationService.sendPushNotification(
            id,
            'ط·ظ„ط¨ ط§ظ„طھط³ط¬ظٹظ„ ظ…ط±ظپظˆط¶ â‌Œ',
            reason ? `ط§ظ„ط³ط¨ط¨: ${reason}` : 'ظٹط±ط¬ظ‰ ظ…ط±ط§ط¬ط¹ط© ط¨ظٹط§ظ†ط§طھظƒ.',
            { type: 'ACCOUNT_REJECTED', reason }
        ).catch(err => console.error('Failed to send rejection push:', err));

        res.json({ success: true, message: 'User rejected successfully', data: result });
    } catch (error: any) {
        console.error('Reject User Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

// Suspend User
export const suspendUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = (req as any).user.userId;

        const result = await prisma.$transaction(async (tx) => {
            const before = await tx.user.findUnique({ where: { id } });
            const user = await tx.user.update({ where: { id }, data: { isActive: false } });

            await AuditService.log({
                tx,
                tableName: 'users',
                recordId: id,
                action: 'SUSPEND_USER',
                oldData: before,
                newData: user,
                performedBy: adminId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] as string
            });
            return user;
        });

        res.json({ success: true, message: 'User suspended successfully' });
    } catch (error) {
        console.error('Suspend User Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Activate User (Un-suspend)
export const activateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = (req as any).user.userId;

        const result = await prisma.$transaction(async (tx) => {
            const before = await tx.user.findUnique({ where: { id } });
            const user = await tx.user.update({ where: { id }, data: { isActive: true } });

            await AuditService.log({
                tx,
                tableName: 'users',
                recordId: id,
                action: 'ACTIVATE_USER',
                oldData: before,
                newData: user,
                performedBy: adminId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] as string
            });
            return user;
        });

        res.json({ success: true, message: 'User activated successfully' });
    } catch (error) {
        console.error('Activate User Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 1. Get Dashboard Stats (Dynamic)
export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // Simple aggregates
        const usersCount = await prisma.user.groupBy({
            by: ['role'],
            _count: true
        });

        // Revenue from PAID orders only
        const revenueStats = await prisma.order.aggregate({
            where: { isPaid: true, status: 'DELIVERED' },
            _sum: {
                totalAmount: true,     // Total Revenue
                platformFee: true,     // App Commission
                deliveryFee: true      // Delivery Fees
            }
        });

        // Pending Withdrawals
        const pendingWithdrawals = await prisma.withdrawal.aggregate({
            where: { status: 'PENDING' },
            _sum: { amount: true }
        });

        // Map data to frontend structure
        const summary = {
            totalRevenue: Number(revenueStats._sum.totalAmount || 0),
            totalPlatformFee: Number(revenueStats._sum.platformFee || 0), // Commissions
            totalDeliveryFees: Number(revenueStats._sum.deliveryFee || 0),
            pendingWithdrawals: Number(pendingWithdrawals._sum.amount || 0),
            netProfit: Number(revenueStats._sum.platformFee || 0), // Net profit usually = commissions
            monthlyGrowth: 0, // Needs complex date logic, kept 0 for now
        };

        res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('Get Stats Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 2. Get Commissions (From Completed Orders)
export const getCommissions = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { status: 'DELIVERED', isPaid: true };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: Number(limit),
                select: {
                    id: true,
                    totalAmount: true,
                    platformFee: true, // Commission amount
                    merchant: {
                        select: {
                            storeName: true,
                            type: true, // MERCHANT vs FAMILY_PRODUCER
                            commissionRate: true // Rate used
                        }
                    },
                    updatedAt: true // Date completed
                },
                orderBy: { updatedAt: 'desc' }
            }),
            prisma.order.count({ where })
        ]);

        const commissions = orders.map(o => ({
            id: o.id,
            orderId: '#' + o.id.split('-')[0].toUpperCase(),
            merchantName: o.merchant.storeName,
            type: o.merchant.type,
            orderAmount: Number(o.totalAmount),
            rate: (o.merchant.commissionRate || 0.05) * 100,
            commissionAmount: Number(o.platformFee),
            date: o.updatedAt.toISOString().split('T')[0]
        }));

        res.json({
            success: true,
            data: { commissions, total }
        });
    } catch (error) {
        console.error('Get Commissions Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 2.5 Get All Orders (Admin View)
export const getAllOrders = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (status) where.status = status;

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    merchant: { select: { storeName: true } },
                    customer: { select: { user: { select: { fullName: true } } } },
                    driver: { select: { user: { select: { fullName: true } } } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.order.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                orders,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get All Orders Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 3. Get Withdrawals
export const getWithdrawals = async (req: Request, res: Response) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (status) where.status = status;

        const [withdrawals, total] = await Promise.all([
            prisma.withdrawal.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    driver: {
                        include: { user: true } // To get name & role
                    }
                },
                orderBy: { requestedAt: 'desc' }
            }),
            prisma.withdrawal.count({ where })
        ]);

        const formattedWithdrawals = await Promise.all(withdrawals.map(async (w) => {
            const bankInfo = await getDecryptedBankInfo(w.driverId, 'DRIVER');
            return {
                id: w.id,
                user: w.driver.user.fullName,
                role: 'ظ…ظ†ط¯ظˆط¨',
                amount: Number(w.amount),
                bank: bankInfo?.bankName || w.driver.bankName,
                account: bankInfo?.accountNumber || w.driver.accountNumber,
                status: w.status,
                requestedAt: w.requestedAt.toISOString().split('T')[0],
                securityWarning: bankInfo?.source === 'legacy' ? 'Legacy' : null
            };
        }));

        res.json({
            success: true,
            data: { withdrawals: formattedWithdrawals, total }
        });

    } catch (error) {
        console.error('Get Withdrawals Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 4. Get Live Driver Locations
export const getLiveDrivers = async (req: Request, res: Response) => {
    try {
        const drivers = await prisma.driver.findMany({
            where: {
                isApproved: true,
                user: { isActive: true } // Only active drivers
            },
            select: {
                userId: true,
                currentLat: true,
                currentLng: true,
                vehicleType: true,
                user: {
                    select: {
                        fullName: true,
                        phone: true
                    }
                }
            }
        });

        // Format for frontend map
        const locations = drivers.map(d => ({
            id: d.userId,
            name: d.user.fullName,
            phone: d.user.phone,
            lat: d.currentLat || 13.97486, // Default to Ibb if null
            lng: d.currentLng || 44.18431, // Default to Ibb if null
            vehicle: d.vehicleType,
            status: 'ONLINE' // Placeholder until socket.io integration
        }));

        res.json({
            success: true,
            data: locations
        });
    } catch (error) {
        console.error('Get Live Drivers Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 5. Process Withdrawal (Approve/Reject)
export const processWithdrawal = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { action, notes } = req.body; // 'approve' | 'reject'
    const adminId = (req as any).user.userId;

    try {
        const withdrawal = await prisma.withdrawal.findUnique({
            where: { id },
            include: { driver: true }
        });

        if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
        if (withdrawal.status !== 'pending') return res.status(400).json({ success: false, message: 'Already processed' });

        if (action === 'approve') {
            await WalletService.debit(
                withdrawal.driverId,
                withdrawal.amount,
                {
                    description: `Withdrawal approved: ${id}`,
                    referenceType: 'WITHDRAWAL',
                    referenceId: withdrawal.id
                }
            );

            await prisma.withdrawal.update({
                where: { id },
                data: {
                    status: 'completed',
                    processedAt: new Date(),
                    processedBy: adminId,
                    notes: notes || 'Approved by admin'
                }
            });

            await AuditService.log({
                tableName: 'withdrawals',
                recordId: id,
                action: 'APPROVE_WITHDRAWAL',
                newData: { status: 'completed', processedBy: adminId },
                performedBy: adminId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] as string
            });
        } else {
            await prisma.withdrawal.update({
                where: { id },
                data: {
                    status: 'rejected',
                    processedAt: new Date(),
                    processedBy: adminId,
                    notes: notes || 'Rejected by admin'
                }
            });

            await AuditService.log({
                tableName: 'withdrawals',
                recordId: id,
                action: 'REJECT_WITHDRAWAL',
                newData: { status: 'rejected', reason: notes },
                performedBy: adminId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] as string
            });
        }

        return res.json({ success: true, message: `Withdrawal ${action}d successfully` });

    } catch (error: any) {
        console.error('Process withdrawal error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

// ── Merchant Settlements ──────────────────────────────────────────────────

/**
 * GET /admin/finance/settlements
 * Returns all merchants with unsettled sales amounts.
 */
export const getMerchantSettlements = async (req: Request, res: Response) => {
    try {
        const merchants = await prisma.merchant.findMany({
            where: { isApproved: true },
            include: {
                user: { select: { fullName: true, phone: true } }
            }
        });

        const results = await Promise.all(merchants.map(async (merchant) => {
            const since = (merchant as any).lastSettledAt || new Date(0);

            const aggregate = await prisma.payment.aggregate({
                where: {
                    order: {
                        merchantId: merchant.userId,
                        status: 'DELIVERED',
                        deliveredAt: { gte: since }
                    },
                    status: { in: ['completed', 'distributed'] }
                },
                _sum: {
                    totalAmount: true,
                    platformFee: true,
                    merchantNet: true
                }
            });

            const totalSales = Number(aggregate._sum.totalAmount || 0);
            const commission = Number(aggregate._sum.platformFee || 0);
            const netDue = Number(aggregate._sum.merchantNet || 0);

            return {
                merchantId: merchant.userId,
                storeName: merchant.storeName,
                merchantName: merchant.user?.fullName,
                phone: merchant.user?.phone,
                commissionRate: Number(merchant.commissionRate),
                lastSettledAt: (merchant as any).lastSettledAt ?? null,
                totalSales,
                commission,
                netDue
            };
        }));

        const totalNetDue = results.reduce((s, m) => s + m.netDue, 0);

        return res.json({
            success: true,
            data: {
                settlements: results,
                pendingCount: results.filter(m => m.netDue > 0).length,
                totalNetDue
            }
        });
    } catch (error: any) {
        console.error('getMerchantSettlements error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

/**
 * POST /admin/finance/settlements/:merchantId/settle
 * Records a settlement and notifies the merchant.
 */
export const processMerchantSettlement = async (req: Request, res: Response) => {
    const { merchantId } = req.params;
    const { notes } = req.body;
    const adminId = (req as any).user.userId;

    try {
        const merchant = await prisma.merchant.findUnique({
            where: { userId: merchantId },
            include: { user: { select: { fullName: true, phone: true } } }
        });

        if (!merchant) {
            return res.status(404).json({ success: false, message: 'Merchant not found' });
        }

        const since = (merchant as any).lastSettledAt || new Date(0);

        const aggregate = await prisma.payment.aggregate({
            where: {
                order: {
                    merchantId,
                    status: 'DELIVERED',
                    deliveredAt: { gte: since }
                },
                status: { in: ['completed', 'distributed'] }
            },
            _sum: { merchantNet: true }
        });

        const netAmount = Number(aggregate._sum.merchantNet || 0);

        if (netAmount <= 0) {
            return res.status(400).json({ success: false, message: 'لا توجد مبالغ مستحقة لهذا التاجر' });
        }

        const now = new Date();

        // Record lastSettledAt on Merchant
        await (prisma.merchant as any).update({
            where: { userId: merchantId },
            data: { lastSettledAt: now }
        });

        // Audit log
        await AuditService.log({
            tableName: 'merchant_settlements',
            recordId: merchantId,
            action: 'PROCESS_SETTLEMENT',
            newData: { netAmount, settledAt: now, notes },
            performedBy: adminId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string
        });

        // Notify merchant
        await notificationService.sendPushNotification(
            merchantId,
            '💰 تمت تسوية حسابك',
            `تمت معالجة تسوية حسابك بمبلغ ${netAmount.toLocaleString()} ر.ي`
        ).catch(() => { });

        return res.json({
            success: true,
            message: 'تمت التسوية بنجاح',
            data: { merchantId, storeName: merchant.storeName, netAmount, settledAt: now }
        });
    } catch (error: any) {
        console.error('processMerchantSettlement error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

// ── Update Merchant Store Image ────────────────────────────────────────────

/**
 * POST /admin/merchants/:id/store-image   (multipart/form-data, field: "image")
 * Accepts a direct file upload and saves the public URL to storeImageUrl.
 */
export const updateMerchantStoreImage = async (req: Request, res: Response) => {
    try {
        const { id: merchantId } = req.params;

        // Build image URL from uploaded file OR from body URL fallback
        let storeImageUrl: string | undefined;
        if (req.file) {
            const baseUrl = process.env.BACKEND_URL || 'https://cashline-pro-production.up.railway.app';
            storeImageUrl = `${baseUrl}/uploads/${req.file.filename}`;
        } else {
            storeImageUrl = req.body?.storeImageUrl;
        }

        if (!storeImageUrl) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }

        const merchant = await prisma.merchant.findUnique({ where: { userId: merchantId } });
        if (!merchant) {
            return res.status(404).json({ success: false, message: 'Merchant not found' });
        }

        const updated = await (prisma.merchant as any).update({
            where: { userId: merchantId },
            data: { storeImageUrl },
            select: { userId: true, storeName: true, storeImageUrl: true }
        });

        return res.json({
            success: true,
            message: `✅ تم تحديث صورة متجر "${merchant.storeName}"`,
            data: { ...updated, logoUrl: storeImageUrl }
        });

    } catch (error: any) {
        console.error('updateMerchantStoreImage error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

