import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────
// POST /api/v1/promo/validate
// التحقق من صلاحية كود الخصم وحساب قيمته
// ──────────────────────────────────────────────────
export const validatePromoCode = async (req: Request, res: Response) => {
    try {
        const { code, cartTotal } = req.body;
        const customerId = (req as any).user?.userId;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ valid: false, message: 'كود الخصم مطلوب' });
        }

        const promo = await prisma.promoCode.findUnique({
            where: { code: code.trim().toUpperCase() },
        });

        if (!promo || !promo.isActive) {
            return res.status(404).json({ valid: false, message: 'كود الخصم غير موجود أو غير فعال' });
        }

        // التحقق من تاريخ الانتهاء
        if (promo.expiresAt && new Date() > promo.expiresAt) {
            return res.status(400).json({ valid: false, message: 'انتهت صلاحية كود الخصم' });
        }

        // التحقق من الحد الكلي للاستخدام
        if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
            return res.status(400).json({ valid: false, message: 'تم استنفاد عدد مرات استخدام هذا الكود' });
        }

        // الحد الأدنى للطلب
        const total = Number(cartTotal) || 0;
        if (total < promo.minOrderAmount) {
            return res.status(400).json({
                valid: false,
                message: `الحد الأدنى للطلب ${promo.minOrderAmount} ر.ي`,
            });
        }

        // التحقق هل العميل استخدمه من قبل
        if (customerId && promo.usagePerCustomer > 0) {
            const existing = await prisma.promoUsage.findFirst({
                where: { promoCodeId: promo.id, customerId },
            });
            if (existing) {
                return res.status(400).json({ valid: false, message: 'لقد استخدمت هذا الكود مسبقاً' });
            }
        }

        // حساب قيمة الخصم
        let discountAmount = 0;
        if (promo.type === 'PERCENTAGE') {
            discountAmount = (total * promo.value) / 100;
            if (promo.maxDiscount !== null && discountAmount > promo.maxDiscount) {
                discountAmount = promo.maxDiscount;
            }
        } else {
            // FIXED
            discountAmount = Math.min(promo.value, total);
        }

        return res.status(200).json({
            status: 'success',
            valid: true,
            data: {
                discountAmount: Math.round(discountAmount * 100) / 100,
                code: promo.code,
                type: promo.type,
                message: `خصم ${promo.type === 'PERCENTAGE' ? promo.value + '%' : promo.value + ' ر.ي'}`,
            },
        });
    } catch (error) {
        console.error('❌ Promo validate error:', error);
        return res.status(500).json({ valid: false, message: 'حدث خطأ في الخادم' });
    }
};

// ──────────────────────────────────────────────────
// POST /api/v1/promo/apply
// تسجيل استخدام الكود بعد إتمام الطلب
// ──────────────────────────────────────────────────
export const applyPromoCode = async (req: Request, res: Response) => {
    try {
        const { code, orderId } = req.body;
        const customerId = (req as any).user?.userId;

        const promo = await prisma.promoCode.findUnique({
            where: { code: code.trim().toUpperCase() },
        });

        if (!promo) {
            return res.status(404).json({ message: 'كود الخصم غير موجود' });
        }

        // تسجيل الاستخدام
        await prisma.$transaction([
            prisma.promoUsage.create({
                data: { promoCodeId: promo.id, customerId, orderId },
            }),
            prisma.promoCode.update({
                where: { id: promo.id },
                data: { usedCount: { increment: 1 } },
            }),
        ]);

        return res.status(200).json({ status: 'success', message: 'تم تطبيق كود الخصم' });
    } catch (error) {
        console.error('❌ Promo apply error:', error);
        return res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};
