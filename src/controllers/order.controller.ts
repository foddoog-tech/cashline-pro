import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { io } from '../app'; // Import Socket.IO instance if needed for notifications
import { NotificationService } from '../services/notification.service';
import { WalletService } from '../services/wallet.service';

const notificationService = new NotificationService();

// Create New Order
export const createOrder = async (req: Request, res: Response) => {
    try {
        const customerId = (req as any).user.userId; // âœ… JWT payload ظٹط­طھظˆظٹ userId ظˆظ„ظٹط³ id
        const { merchantId, items, deliveryAddress, deliveryLat, deliveryLng, paymentMethod } = req.body;

        // 1. Validate Merchant
        const merchant = await prisma.merchant.findUnique({
            where: { userId: merchantId },
            include: { user: true }
        });

        if (!merchant) {
            return res.status(404).json({ status: 'error', message: 'Merchant not found' });
        }

        // 2. Calculate Totals & Validate Products
        let subtotal = 0;
        const orderItemsData: {
            productId: string;
            quantity: number;
            unitPrice: any;
            total: number;
        }[] = [];

        for (const item of items) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } });
            if (!product) {
                return res.status(400).json({ status: 'error', message: `Product ${item.productId} not found` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ status: 'error', message: `Insufficient stock for product ${product.name}` });
            }

            const itemTotal = Number(product.price) * item.quantity;
            subtotal += itemTotal;

            orderItemsData.push({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price,
                total: itemTotal
            });
        }

        // 3. Calculate Fees
        const platformFeePercentage = merchant.commissionRate; // e.g. 0.05
        const platformFee = subtotal * platformFeePercentage;

        // Delivery Fee Calculation (Basic Logic - can be enhanced with Google Maps Distance Matrix)
        const deliveryFee = 500; // Fixed base fee for now in YER

        const totalAmount = subtotal + deliveryFee;

        // 4. Create Order Transaction
        console.log('ًں“‌ Order Data:', {
            customerId,
            merchantId,
            subtotal,
            totalAmount,
            itemsCount: items.length
        });

        const result = await prisma.$transaction(async (tx) => {
            console.log('Creating Order Record...');
            const order = await (tx.order as any).create({
                data: {
                    customerId,          // âœ… @id ظپظٹ Customer
                    merchantId,          // âœ… @id ظپظٹ Merchant
                    subtotal,
                    deliveryFee,
                    platformFee,
                    totalAmount,
                    paymentMethod,
                    deliveryAddress,
                    deliveryLat: Number(deliveryLat),
                    deliveryLng: Number(deliveryLng),
                    status: 'PENDING',
                    items: {
                        create: orderItemsData.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            total: item.total,
                        }))
                    }
                },
                include: {
                    items: true
                }
            });

            // Update Stock
            console.log('Updating Stock...');
            for (const item of items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                });
            }

            // Create Initial Payment Record (Moved before Hold to ensure record exists)
            console.log('Creating Payment Record...');
            const merchantNet = subtotal - platformFee;
            await tx.payment.create({
                data: {
                    orderId: order.id,
                    totalAmount: totalAmount,
                    driverFee: deliveryFee,
                    platformFee: platformFee,
                    merchantNet: merchantNet,
                    status: 'PENDING'
                }
            });

            // Escrow: Hold Funds (if not Cash)
            if (paymentMethod !== 'CASH_ON_DELIVERY') {
                console.log('Holding Funds...');
                await WalletService.hold(
                    customerId,
                    totalAmount,
                    `Hold for Order #${order.id}`,
                    {
                        tx,
                        referenceType: 'ORDER',
                        referenceId: order.id
                    }
                );
            }

            return order;
        }, {
            maxWait: 5000, // default: 2000
            timeout: 15000 // default: 5000
        });

        // 5. Notify Merchant (Socket.IO or Push)
        // Send Push Notification in background (do not await)
        notificationService.notifyNewOrder(result.id).catch(err => {
            console.error('Failed to send background notification:', err);
        });

        console.log('✅ Order created! Sending response to client...');
        res.status(201).json({
            status: 'success',
            message: 'Order created successfully',
            data: result
        });

    } catch (error: any) {
        console.error('❌ Create Order Error FULL:', error?.message || error);
        console.error('❌ Stack:', error?.stack?.split('\n').slice(0, 5).join('\n'));
        res.status(500).json({ status: 'error', message: 'Internal server error processing order', detail: error?.message });
    }
};

// Get Order Details
export const getOrderDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.userId;

        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                items: { include: { product: true } },
                merchant: { select: { storeName: true, user: { select: { phone: true } } } },
                driver: { select: { user: { select: { fullName: true, phone: true } } } },
                customer: { select: { user: { select: { fullName: true, phone: true } } } }
            }
        });

        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Order not found' });
        }

        // Security Check: Ensure requester is part of the order (Customer, Merchant, Driver, or Admin)
        // For simplicity allow if user is related. In production, check roles strictly.
        if (order.customerId !== userId && order.merchantId !== userId && order.driverId !== userId) {
            // Check if Admin
            const admin = await prisma.admin.findUnique({ where: { userId } });
            if (!admin) {
                return res.status(403).json({ status: 'error', message: 'Unauthorized access to this order' });
            }
        }

        res.json({ status: 'success', data: order });

    } catch (error) {
        console.error('Get Order Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

// Update Order Status (For Merchant/Driver/System)
export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, proofImageUrl, deliverySignature } = req.body;
        const userId = (req as any).user.userId;

        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

        // Enforce Proof of Delivery
        if (status === 'DELIVERED' && !proofImageUrl) {
            return res.status(400).json({
                status: 'error',
                message: 'Proof of Delivery (Image) is required to complete the order.'
            });
        }

        const updatedOrder = await prisma.order.update({
            where: { id },
            data: {
                status,
                proofImageUrl,     // Update if provided
                deliverySignature, // Update if provided
                // Update timestamps based on status
                ...(status === 'ACCEPTED' && { acceptedAt: new Date() }),
                ...(status === 'READY' && { preparedAt: new Date() }),
                ...(status === 'PICKED_UP' && { pickedUpAt: new Date() }),
                ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
                ...(status === 'CANCELLED' && { cancelledAt: new Date() }),
            }
        });

        // Trigger Driver Assignment if updated to READY
        if (status === 'READY') {
            const { DispatchService } = require('../services/dispatch.service');
            // Run in background, don't block response
            DispatchService.assignOrder(id).catch((err: any) => console.error('Dispatch Error:', err));
        }

        // Trigger Payment Distribution if DELIVERED
        if (status === 'DELIVERED') {
            const { paymentService } = require('../services/payment.service');
            paymentService.distributePayment(id).catch((err: any) => console.error('Distribute Payment Error:', err));
        }

        res.json({ status: 'success', message: 'Order status updated', data: updatedOrder });

    } catch (error) {
        console.error('Update Order Status Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

// Cancel Order (User or Merchant)
export const cancelOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = (req as any).user.userId;

        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

        if (['DELIVERED', 'IN_TRANSIT', 'PICKED_UP'].includes(order.status)) {
            return res.status(400).json({ status: 'error', message: 'Cannot cancel order at this stage' });
        }

        // Restore Stock
        const transaction = await prisma.$transaction(async (tx) => {
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancelReason: reason
                }
            });

            // Get items to return stock
            const orderItems = await tx.orderItem.findMany({ where: { orderId: id } });

            // Restore Stock
            for (const item of orderItems) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } }
                });
            }

            // Release Held Funds (if applicable)
            if (order.paymentMethod !== 'CASH_ON_DELIVERY') {
                // We assume there was a hold
                await WalletService.release(
                    order.customerId,
                    order.totalAmount,
                    `Refund for Cancelled Order #${order.id}`,
                    {
                        tx,
                        referenceType: 'ORDER',
                        referenceId: order.id
                    }
                );
            }

            return updatedOrder;
        });

        res.json({ status: 'success', message: 'Order cancelled successfully', data: transaction });

    } catch (error) {
        console.error('Cancel Order Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

// Get Customer Orders (My Orders)
export const getMyOrders = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { page = 1, limit = 10, status } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { customerId: userId };
        if (status) where.status = status;

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    merchant: { select: { storeName: true, idImageUrl: true } },
                    items: {
                        select: {
                            product: {
                                // ✅ إضافة الصورة في الـ response لعرضها في بطاقة الطلب
                                select: { name: true, imageUrl: true }
                            },
                            quantity: true
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
        console.error('Get My Orders Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

// ✅ إعادة الطلب - Reorder All Items from a Previous Order
// POST /orders/:id/reorder
export const reorderOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const customerId = (req as any).user.userId; // ✅ يتوافق مع JWT الموجود

        // 1. جلب الطلب الأصلي مع منتجاته
        const originalOrder = await prisma.order.findFirst({
            where: { id, customerId },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });

        if (!originalOrder) {
            return res.status(404).json({
                status: 'error',
                message: 'الطلب غير موجود أو لا ينتمي لهذا الحساب'
            });
        }

        // 2. التحقق من إمكانية إعادة الطلب
        if (!['DELIVERED', 'CANCELLED'].includes(originalOrder.status)) {
            return res.status(400).json({
                status: 'error',
                message: 'لا يمكن إعادة الطلب إلا بعد اكتماله أو إلغائه'
            });
        }

        // 3. التحقق من توفر المنتجات بالأسعار الحالية
        const validItems: Array<{
            productId: string;
            quantity: number;
            price: number;
        }> = [];
        const unavailableItems: string[] = [];

        for (const item of originalOrder.items) {
            const product = await prisma.product.findUnique({
                where: { id: item.productId }
            });

            if (!product || product.stock < item.quantity) {
                unavailableItems.push(
                    product
                        ? `${product.name} (المتوفر: ${product.stock})`
                        : item.productId
                );
                continue;
            }

            validItems.push({
                productId: item.productId,
                quantity: item.quantity,
                price: Number(product.price) // ✅ السعر الحالي وليس القديم
            });
        }

        if (unavailableItems.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'بعض المنتجات غير متوفرة بالكمية المطلوبة',
                unavailableItems
            });
        }

        if (validItems.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'لا توجد منتجات متاحة لإعادة الطلب'
            });
        }

        // 4. إيجاد أو إنشاء سلة نشطة
        let cart = await (prisma as any).cart.findFirst({
            where: { customerId, status: 'ACTIVE' }
        });

        if (!cart) {
            cart = await (prisma as any).cart.create({
                data: { customerId, status: 'ACTIVE' }
            });
        }

        // 5. إضافة المنتجات للسلة (upsert لتجنب التكرار)
        await prisma.$transaction(
            validItems.map(item =>
                (prisma as any).cartItem.upsert({
                    where: {
                        cartId_productId: {
                            cartId: cart.id,
                            productId: item.productId
                        }
                    },
                    update: {
                        quantity: { increment: item.quantity }
                    },
                    create: {
                        cartId: cart.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price
                    }
                })
            )
        );

        // 6. حساب الإجمالي الجديد
        const newTotal = validItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        res.json({
            status: 'success',
            message: `تمت إضافة ${validItems.length} منتجات للسلة بنجاح`,
            data: {
                itemsAdded: validItems.length,
                cartTotal: newTotal,
                cartId: cart.id
            }
        });

    } catch (error: any) {
        console.error('❌ Reorder Error:', error?.message || error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ في الخادم أثناء إعادة الطلب',
            detail: error?.message
        });
    }
};

