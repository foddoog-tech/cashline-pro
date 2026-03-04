import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * ✅ جلب قائمة المفضلة للعميل
 * GET /wishlist
 */
export const getWishlist = async (req: Request, res: Response) => {
    try {
        const customerId = (req as any).user.userId;

        const wishlist = await (prisma as any).wishlist.findMany({
            where: { customerId },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        imageUrl: true,
                        stock: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ status: 'success', data: wishlist });
    } catch (error: any) {
        console.error('Get Wishlist Error:', error);
        res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
    }
};

/**
 * ✅ إضافة منتج للمفضلة
 * POST /wishlist
 */
export const addToWishlist = async (req: Request, res: Response) => {
    try {
        const customerId = (req as any).user.userId;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ status: 'error', message: 'productId مطلوب' });
        }

        // التحقق من وجود المنتج
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ status: 'error', message: 'المنتج غير موجود' });
        }

        const item = await (prisma as any).wishlist.create({
            data: { customerId, productId }
        });

        res.status(201).json({
            status: 'success',
            message: 'تمت الإضافة للمفضلة',
            data: item
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({
                status: 'error',
                message: 'المنتج موجود بالفعل في المفضلة'
            });
        }
        console.error('Add To Wishlist Error:', error);
        res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
    }
};

/**
 * ✅ حذف منتج من المفضلة
 * DELETE /wishlist/:productId
 */
export const removeFromWishlist = async (req: Request, res: Response) => {
    try {
        const customerId = (req as any).user.userId;
        const { productId } = req.params;

        await (prisma as any).wishlist.deleteMany({
            where: { customerId, productId }
        });

        res.json({ status: 'success', message: 'تم الحذف من المفضلة' });
    } catch (error: any) {
        console.error('Remove From Wishlist Error:', error);
        res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
    }
};

/**
 * ✅ نقل منتج من المفضلة إلى السلة
 * POST /wishlist/move-to-cart
 */
export const moveToCart = async (req: Request, res: Response) => {
    try {
        const customerId = (req as any).user.userId;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ status: 'error', message: 'productId مطلوب' });
        }

        // التحقق من توفر المنتج
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product || product.stock < 1) {
            return res.status(400).json({
                status: 'error',
                message: 'المنتج غير متوفر حالياً'
            });
        }

        // إيجاد أو إنشاء سلة نشطة
        let cart = await (prisma as any).cart.findFirst({
            where: { customerId, status: 'ACTIVE' }
        });

        if (!cart) {
            cart = await (prisma as any).cart.create({
                data: { customerId, status: 'ACTIVE' }
            });
        }

        // نقل from wishlist إلى cart في transaction واحدة
        await prisma.$transaction([
            // حذف من المفضلة
            (prisma as any).wishlist.deleteMany({
                where: { customerId, productId }
            }),
            // إضافة للسلة (upsert)
            (prisma as any).cartItem.upsert({
                where: {
                    cartId_productId: {
                        cartId: cart.id,
                        productId
                    }
                },
                update: { quantity: { increment: 1 } },
                create: {
                    cartId: cart.id,
                    productId,
                    quantity: 1,
                    price: Number(product.price)
                }
            })
        ]);

        res.json({
            status: 'success',
            message: 'تم نقل المنتج للسلة',
            data: { cartId: cart.id }
        });
    } catch (error: any) {
        console.error('Move To Cart Error:', error);
        res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
    }
};
