import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/v1/products/deals-of-day
 * عروض اليوم — أحدث المنتجات المتاحة كـ "عروض"
 */
export const getDealsOfDay = async (req: Request, res: Response) => {
    try {
        const deals = await prisma.product.findMany({
            where: {
                isAvailable: true,
                status: 'APPROVED',
                deletedAt: null,
                stock: { gt: 0 },
            },
            orderBy: [{ createdAt: 'desc' }],
            take: 10,
            select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
                isAvailable: true,
                stock: true,
                category: true,
                unit: true,
                createdAt: true,
                merchantId: true,
                merchant: { select: { storeName: true } },
            },
        });

        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);

        return res.status(200).json({
            status: 'success',
            data: deals.map((p) => ({
                ...p,
                merchantName: p.merchant?.storeName ?? null,
            })),
            expiresAt: midnight.toISOString(),
        });
    } catch (error) {
        console.error('❌ getDealsOfDay error:', error);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
    }
};



/**
 * GET /api/products
 * ط¬ظ„ط¨ ط¬ظ…ظٹط¹ ط§ظ„ظ…ظ†طھط¬ط§طھ ظ…ط¹ ظپظ„ط§طھط± ط§ط®طھظٹط§ط±ظٹط©
 */
export const getAllProducts = async (req: Request, res: Response) => {
    try {
        const {
            category,
            status,
            merchantId,
            search,
            page = '1',
            limit = '50'
        } = req.query;

        const where: Prisma.ProductWhereInput = {};

        if (category && category !== 'ط§ظ„ظƒظ„') {
            where.category = category as string;
        }

        if (status) {
            where.status = status as any;
        }

        if (merchantId) {
            where.merchantId = merchantId as string;
        }

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { nameEn: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    merchant: {
                        select: {
                            storeName: true,
                            userId: true,
                        }
                    }
                },
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.product.count({ where })
        ]);

        res.json({
            success: true,
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظ…ظ†طھط¬ط§طھ',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * GET /api/products/:id
 * ط¬ظ„ط¨ ظ…ظ†طھط¬ ظˆط§ط­ط¯ ط¨ط§ظ„ظ€ ID
 */
export const getProductById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                merchant: {
                    select: {
                        storeName: true,
                        userId: true,
                        address: true,
                    }
                }
            }
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'ط§ظ„ظ…ظ†طھط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            success: false,
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظ…ظ†طھط¬',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * POST /api/products
 * ط¥ط¶ط§ظپط© ظ…ظ†طھط¬ ط¬ط¯ظٹط¯
 */
export const createProduct = async (req: Request, res: Response) => {
    try {
        const {
            merchantId,
            name,
            nameEn,
            description,
            price,
            category,
            unit,
            stock,
            imageUrl,
            status = 'PENDING'
        } = req.body;

        // Validation
        if (!merchantId || !name || !price || !category) {
            return res.status(400).json({
                success: false,
                message: 'ط§ظ„ط±ط¬ط§ط، ط¥ط¯ط®ط§ظ„ ط¬ظ…ظٹط¹ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظ…ط·ظ„ظˆط¨ط©'
            });
        }

        const product = await prisma.product.create({
            data: {
                merchantId,
                name,
                nameEn,
                description,
                price: new Prisma.Decimal(price),
                category,
                unit: unit || 'ظ‚ط·ط¹ط©',
                stock: stock || 0,
                imageUrl,
                status: status as any,
            },
            include: {
                merchant: {
                    select: {
                        storeName: true,
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'طھظ… ط¥ط¶ط§ظپط© ط§ظ„ظ…ظ†طھط¬ ط¨ظ†ط¬ط§ط­',
            data: product
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({
            success: false,
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¥ط¶ط§ظپط© ط§ظ„ظ…ظ†طھط¬',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * PUT /api/products/:id
 * طھط­ط¯ظٹط« ظ…ظ†طھط¬
 */
export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            name,
            nameEn,
            description,
            price,
            category,
            unit,
            stock,
            imageUrl,
            isAvailable
        } = req.body;

        const updateData: Prisma.ProductUpdateInput = {};

        if (name !== undefined) updateData.name = name;
        if (nameEn !== undefined) updateData.nameEn = nameEn;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = new Prisma.Decimal(price);
        if (category !== undefined) updateData.category = category;
        if (unit !== undefined) updateData.unit = unit;
        if (stock !== undefined) updateData.stock = stock;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

        const product = await prisma.product.update({
            where: { id },
            data: updateData,
            include: {
                merchant: {
                    select: {
                        storeName: true,
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„ظ…ظ†طھط¬ ط¨ظ†ط¬ط§ط­',
            data: product
        });
    } catch (error) {
        console.error('Error updating product:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'ط§ظ„ظ…ظ†طھط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        res.status(500).json({
            success: false,
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ طھط­ط¯ظٹط« ط§ظ„ظ…ظ†طھط¬',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * DELETE /api/products/:id
 * ط­ط°ظپ ظ…ظ†طھط¬
 */
export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.product.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'طھظ… ط­ط°ظپ ط§ظ„ظ…ظ†طھط¬ ط¨ظ†ط¬ط§ط­'
        });
    } catch (error) {
        console.error('Error deleting product:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'ط§ظ„ظ…ظ†طھط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        res.status(500).json({
            success: false,
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط­ط°ظپ ط§ظ„ظ…ظ†طھط¬',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * PUT /api/products/:id/approve
 * ط§ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ظ…ظ†طھط¬ (طھط؛ظٹظٹط± ط­ط§ظ„طھظ‡ ط¥ظ„ظ‰ APPROVED)
 */
export const approveProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.update({
            where: { id },
            data: {
                status: 'APPROVED',
                isAvailable: true,
            },
            include: {
                merchant: {
                    select: {
                        storeName: true,
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'طھظ… ظ‚ط¨ظˆظ„ ط§ظ„ظ…ظ†طھط¬ ط¨ظ†ط¬ط§ط­',
            data: product
        });
    } catch (error) {
        console.error('Error approving product:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'ط§ظ„ظ…ظ†طھط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        res.status(500).json({
            success: false,
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ظ‚ط¨ظˆظ„ ط§ظ„ظ…ظ†طھط¬',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * PUT /api/products/:id/reject
 * ط±ظپط¶ ظ…ظ†طھط¬ (طھط؛ظٹظٹط± ط­ط§ظ„طھظ‡ ط¥ظ„ظ‰ REJECTED)
 */
export const rejectProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.update({
            where: { id },
            data: {
                status: 'REJECTED',
                isAvailable: false,
            },
            include: {
                merchant: {
                    select: {
                        storeName: true,
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'طھظ… ط±ظپط¶ ط§ظ„ظ…ظ†طھط¬',
            data: product
        });
    } catch (error) {
        console.error('Error rejecting product:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'ط§ظ„ظ…ظ†طھط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        res.status(500).json({
            success: false,
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط±ظپط¶ ط§ظ„ظ…ظ†طھط¬',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
