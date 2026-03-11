import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get All Merchants (For Customer Display)
export const getMerchants = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 20, search, category } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {
            isApproved: true,
            deletedAt: null
        };

        if (search) {
            where.storeName = { contains: String(search), mode: 'insensitive' };
        }
        if (category) {
            where.type = String(category);
        }

        const [merchants, total] = await Promise.all([
            prisma.merchant.findMany({
                where,
                skip,
                take: Number(limit),
                select: {
                    userId: true,
                    storeName: true,
                    type: true,
                    description: true,
                    storeImageUrl: true,
                    address: true,
                    isApproved: true,
                    user: { select: { fullName: true } }
                } as any
            }),
            prisma.merchant.count({ where })
        ]);

        // Map to customer-friendly format
        const formatted = (merchants as any[]).map((m: any) => ({
            id: m.userId,
            userId: m.userId,
            storeName: m.storeName,
            logoUrl: m.storeImageUrl ?? null,
            category: m.type,
            description: m.description,
            deliveryTime: '30-45 دقيقة',
            isOpen: true,
            ownerName: m.user?.fullName
        }));

        res.json({
            status: 'success',
            data: {
                merchants: formatted,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get Merchants Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error fetching merchants' });
    }
};

// Get Merchant Products
export const getMerchantProducts = async (req: Request, res: Response) => {
    try {
        const { merchantId } = req.params;
        const { page = 1, limit = 10, category } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const where: any = {
            merchantId,
            isAvailable: true
        };

        if (category) {
            where.category = category;
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { name: 'asc' }
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
        console.error('Get Merchant Products Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error fetching products' });
    }
};

// Rate Order
export const rateOrder = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { orderId, rating, comment, type } = req.body;

        const order = await prisma.order.findUnique({ where: { id: orderId } });

        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
        if (order.customerId !== userId) return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        if (order.status !== 'DELIVERED') return res.status(400).json({ status: 'error', message: 'Order must be delivered to rate' });

        const targetUserId = type === 'merchant' ? order.merchantId : order.driverId;
        if (!targetUserId) return res.status(400).json({ status: 'error', message: 'Target user not found' });

        const ratingRecord = await prisma.rating.create({
            data: {
                orderId,
                fromUserId: userId,
                toUserId: targetUserId,
                role: type === 'merchant' ? 'customer_to_merchant' : 'customer_to_driver',
                rating: Number(rating),
                comment
            }
        });

        res.json({ status: 'success', message: 'Rating submitted', data: ratingRecord });

    } catch (error) {
        console.error('Rate Order Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error submitting rating' });
    }
};

// âœ… Get ALL Products (Home Page) â€” ط§ظ„ط£ط­ط¯ط« ط£ظˆظ„ط§ظ‹ ط«ظ… ط§ظ„ط£ظ‚ظ„ ط³ط¹ط±ط§ظ‹
export const getAllProducts = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 20, category, sort = 'newest' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { isAvailable: true, status: 'APPROVED' };
        if (category) where.category = String(category);

        // طھط±طھظٹط¨: ط§ظ„ط£ط­ط¯ط« ط£ظˆظ„ط§ظ‹ + ط§ظ„ط£ظ‚ظ„ ط³ط¹ط±ط§ظ‹
        const orderBy: any[] = sort === 'price'
            ? [{ price: 'asc' }]
            : [{ createdAt: 'desc' }, { price: 'asc' }];

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy,
                include: {
                    merchant: {
                        select: { storeName: true, userId: true }
                    }
                }
            }),
            prisma.product.count({ where })
        ]);

        // âœ… ظ†ظڈط±ط¬ط¹ userId ط§ظ„طھط§ط¬ط± ظƒظ€ merchantId ظ„ط§ط³طھط®ط¯ط§ظ…ظ‡ ظپظٹ ط§ظ„ط·ظ„ط¨ط§طھ
        const formattedProducts = products.map(p => ({
            ...p,
            merchantId: p.merchant?.userId ?? p.merchantId, // â†گ userId ظ„ظ„ظ€ order controller
            merchantName: p.merchant?.storeName ?? null,
        }));

        res.json({
            status: 'success',
            data: {
                products: formattedProducts,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get All Products Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};
