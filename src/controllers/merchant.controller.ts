import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get Merchant Profile
export const getMerchantProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const merchant = await prisma.merchant.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        fullName: true,
                        phone: true,
                        email: true,
                        avatarUrl: true,
                    }
                }
            }
        });

        if (!merchant) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„طھط§ط¬ط± ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        res.json({
            status: 'success',
            data: merchant
        });
    } catch (error) {
        console.error('Error getting merchant profile:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط¨ظٹط§ظ†ط§طھ'
        });
    }
};

// Update Merchant Profile
export const updateMerchantProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { storeName, description, address, lat, lng, bankName, accountNumber, accountName } = req.body;

        const merchant = await prisma.merchant.update({
            where: { userId },
            data: {
                storeName,
                description,
                address,
                lat,
                lng,
                bankName,
                accountNumber,
                accountName,
            }
        });

        res.json({
            status: 'success',
            message: 'تم تحديث البيانات بنجاح',
            data: merchant
        });
    } catch (error) {
        console.error('Error updating merchant profile:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ في تحديث البيانات'
        });
    }
};

// Resubmit Merchant Application
export const resubmitApplication = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { 
            fullName, 
            storeName, 
            description, 
            address, 
            lat, 
            lng, 
            bankName, 
            accountNumber, 
            accountName, 
            licenseNumber, 
            idImageUrl, 
            licenseImageUrl 
        } = req.body;

        // Update User Profile
        if (fullName) {
            await prisma.user.update({
                where: { id: userId },
                data: { fullName }
            });
        }

        // Update Merchant Profile
        const merchant = await prisma.merchant.update({
            where: { userId },
            data: {
                storeName,
                description,
                address,
                lat,
                lng,
                bankName,
                accountNumber,
                accountName,
                licenseNumber,
                ...(idImageUrl && { idImageUrl }),
                ...(licenseImageUrl && { licenseImageUrl }),
                isApproved: false, // Ensure it's false and awaits approval again
            }
        });

        // Delete any rejection notifications so the user goes back to pending status
        await prisma.notification.deleteMany({
            where: {
                userId,
                type: 'ACCOUNT_REJECTED'
            }
        });

        res.json({
            status: 'success',
            message: 'تم إعادة تقديم الطلب بنجاح',
            data: merchant
        });
    } catch (error) {
        console.error('Error resubmitting merchant application:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ في إعادة تقديم الطلب'
        });
    }
};

// Get Merchant Products
export const getMerchantProducts = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { page = 1, limit = 10, category, isAvailable } = req.query;

        const where: any = { merchantId: userId };

        if (category) where.category = category;
        if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true';

        const skip = (Number(page) - 1) * Number(limit);

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.product.count({ where })
        ]);

        res.json({
            status: 'success',
            data: {
                products,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });
    } catch (error) {
        console.error('Error getting products:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظ…ظ†طھط¬ط§طھ'
        });
    }
};

// Add Product
export const addProduct = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { name, description, price, imageUrl, category, stock } = req.body;

        const product = await prisma.product.create({
            data: {
                merchantId: userId,
                name,
                description,
                price,
                imageUrl,
                category,
                stock,
                isAvailable: true
            }
        });

        res.status(201).json({
            status: 'success',
            message: 'طھظ… ط¥ط¶ط§ظپط© ط§ظ„ظ…ظ†طھط¬ ط¨ظ†ط¬ط§ط­',
            data: product
        });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¥ط¶ط§ظپط© ط§ظ„ظ…ظ†طھط¬'
        });
    }
};

// Update Product
export const updateProduct = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { id } = req.params;
        const { name, description, price, imageUrl, category, stock, isAvailable } = req.body;

        // Check if product belongs to merchant
        const existingProduct = await prisma.product.findFirst({
            where: { id, merchantId: userId }
        });

        if (!existingProduct) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„ظ…ظ†طھط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        const product = await prisma.product.update({
            where: { id },
            data: {
                name,
                description,
                price,
                imageUrl,
                category,
                stock,
                isAvailable
            }
        });

        res.json({
            status: 'success',
            message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„ظ…ظ†طھط¬ ط¨ظ†ط¬ط§ط­',
            data: product
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ طھط­ط¯ظٹط« ط§ظ„ظ…ظ†طھط¬'
        });
    }
};

// Delete Product
export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { id } = req.params;

        // Check if product belongs to merchant
        const existingProduct = await prisma.product.findFirst({
            where: { id, merchantId: userId }
        });

        if (!existingProduct) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„ظ…ظ†طھط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        await prisma.product.delete({
            where: { id }
        });

        res.json({
            status: 'success',
            message: 'طھظ… ط­ط°ظپ ط§ظ„ظ…ظ†طھط¬ ط¨ظ†ط¬ط§ط­'
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط­ط°ظپ ط§ظ„ظ…ظ†طھط¬'
        });
    }
};

// Get Merchant Orders
export const getMerchantOrders = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { status, page = 1, limit = 10 } = req.query;

        const where: any = { merchantId: userId };
        if (status) where.status = status;

        const skip = (Number(page) - 1) * Number(limit);

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    customer: {
                        include: {
                            user: {
                                select: {
                                    fullName: true,
                                    phone: true
                                }
                            }
                        }
                    },
                    driver: {
                        include: {
                            user: {
                                select: {
                                    fullName: true,
                                    phone: true
                                }
                            }
                        }
                    },
                    items: {
                        include: {
                            product: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.order.count({ where })
        ]);

        res.json({
            status: 'success',
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
        console.error('Error getting orders:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط·ظ„ط¨ط§طھ'
        });
    }
};

// Update Order Status
export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { id } = req.params;
        const { status } = req.body;

        // Check if order belongs to merchant
        const existingOrder = await prisma.order.findFirst({
            where: { id, merchantId: userId }
        });

        if (!existingOrder) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        const updateData: any = { status };

        if (status === 'ACCEPTED') {
            updateData.acceptedAt = new Date();
        } else if (status === 'READY') {
            updateData.preparedAt = new Date();
        }

        const order = await prisma.order.update({
            where: { id },
            data: updateData
        });

        res.json({
            status: 'success',
            message: 'طھظ… طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ط·ظ„ط¨ ط¨ظ†ط¬ط§ط­',
            data: order
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ط·ظ„ط¨'
        });
    }
};

// Get Finance Summary
export const getFinanceSummary = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const merchant = await prisma.merchant.findUnique({
            where: { userId }
        });

        if (!merchant) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„طھط§ط¬ط± ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        // Get completed orders
        const completedOrders = await prisma.order.findMany({
            where: {
                merchantId: userId,
                status: 'DELIVERED',
                isPaid: true
            },
            include: {
                payment: true
            }
        });

        const totalSales = completedOrders.reduce((sum, order) =>
            sum + Number(order.totalAmount), 0
        );

        const totalPlatformFee = completedOrders.reduce((sum, order) =>
            sum + Number(order.platformFee), 0
        );

        const netEarnings = totalSales - totalPlatformFee;

        // Get pending withdrawals
        const pendingWithdrawals = await prisma.withdrawal.count({
            where: {
                driver: {
                    userId
                },
                status: 'pending'
            }
        });

        res.json({
            status: 'success',
            data: {
                totalSales,
                totalPlatformFee,
                netEarnings,
                commissionRate: merchant.commissionRate,
                totalOrders: completedOrders.length,
                pendingWithdrawals
            }
        });
    } catch (error) {
        console.error('Error getting finance summary:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظ…ظ„ط®طµ ط§ظ„ظ…ط§ظ„ظٹ'
        });
    }
};

// Request Withdrawal
export const requestWithdrawal = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { amount, notes } = req.body;

        // TODO: Check available balance
        // TODO: Create withdrawal request

        res.json({
            status: 'success',
            message: 'طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط³ط­ط¨ ط¨ظ†ط¬ط§ط­'
        });
    } catch (error) {
        console.error('Error requesting withdrawal:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط·ظ„ط¨ ط§ظ„ط³ط­ط¨'
        });
    }
};
