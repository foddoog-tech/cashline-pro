import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// ──────────────────────────────────────────────────────
// GET /api/v1/addresses
// جلب كل عناوين العميل
// ──────────────────────────────────────────────────────
export const getAddresses = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const addresses = await prisma.address.findMany({
            where: { userId, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                label: true,
                address: true,
                lat: true,
                lng: true,
                building: true,
                floor: true,
                apartment: true,
                additionalInstructions: true,
                isDefault: true,
                createdAt: true,
            },
        });
        return res.json({ status: 'success', data: addresses });
    } catch (error) {
        console.error('❌ getAddresses error:', error);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
    }
};

// ──────────────────────────────────────────────────────
// POST /api/v1/addresses
// إضافة عنوان جديد
// ──────────────────────────────────────────────────────
export const createAddress = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const {
            label,
            address,
            lat,
            lng,
            building,
            floor,
            apartment,
            instructions, // اسم الحقل من Flutter
            isDefault,
        } = req.body;

        if (!address) {
            return res.status(400).json({ status: 'error', message: 'address مطلوب' });
        }

        // إلغاء الافتراضية عن البقية إذا كان هذا العنوان افتراضياً
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        const newAddress = await prisma.address.create({
            data: {
                userId,
                label: label?.trim() || 'عنوان',
                address: address.trim(),
                lat: lat ? Number(lat) : null,
                lng: lng ? Number(lng) : null,
                building: building?.trim() || null,
                floor: floor?.trim() || null,
                apartment: apartment?.trim() || null,
                additionalInstructions: instructions?.trim() || null,
                isDefault: isDefault ?? false,
                isActive: true,
            },
        });

        return res.status(201).json({ status: 'success', data: newAddress });
    } catch (error) {
        console.error('❌ createAddress error:', error);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
    }
};

// ──────────────────────────────────────────────────────
// PUT /api/v1/addresses/:id
// تحديث عنوان
// ──────────────────────────────────────────────────────
export const updateAddress = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.userId;
        const {
            label,
            address,
            lat,
            lng,
            building,
            floor,
            apartment,
            instructions,
            isDefault,
        } = req.body;

        // التحقق من ملكية العنوان
        const existing = await prisma.address.findFirst({ where: { id, userId } });
        if (!existing) {
            return res.status(404).json({ status: 'error', message: 'العنوان غير موجود' });
        }

        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        const updated = await prisma.address.update({
            where: { id },
            data: {
                ...(label !== undefined && { label: label.trim() }),
                ...(address !== undefined && { address: address.trim() }),
                ...(lat !== undefined && { lat: lat ? Number(lat) : null }),
                ...(lng !== undefined && { lng: lng ? Number(lng) : null }),
                ...(building !== undefined && { building: building?.trim() || null }),
                ...(floor !== undefined && { floor: floor?.trim() || null }),
                ...(apartment !== undefined && { apartment: apartment?.trim() || null }),
                ...(instructions !== undefined && { additionalInstructions: instructions?.trim() || null }),
                ...(isDefault !== undefined && { isDefault }),
            },
        });

        return res.json({ status: 'success', data: updated });
    } catch (error) {
        console.error('❌ updateAddress error:', error);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
    }
};

// ──────────────────────────────────────────────────────
// DELETE /api/v1/addresses/:id
// حذف عنوان (soft delete — isActive: false)
// ──────────────────────────────────────────────────────
export const deleteAddress = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.userId;

        const existing = await prisma.address.findFirst({ where: { id, userId } });
        if (!existing) {
            return res.status(404).json({ status: 'error', message: 'العنوان غير موجود' });
        }

        // soft delete بدلاً من الحذف الفعلي لأن Orders قد تشير لهذا العنوان
        await prisma.address.update({
            where: { id },
            data: { isActive: false, isDefault: false },
        });

        return res.json({ status: 'success', message: 'تم الحذف' });
    } catch (error) {
        console.error('❌ deleteAddress error:', error);
        return res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
    }
};
