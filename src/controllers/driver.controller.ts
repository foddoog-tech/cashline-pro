import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { WalletService } from '../services/wallet.service';
import { NotificationService } from '../services/notification.service';

const notificationService = new NotificationService();


// Get Driver Profile
export const getDriverProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const driver = await prisma.driver.findUnique({
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

        if (!driver) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„ظ…ظ†ط¯ظˆط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        res.json({
            status: 'success',
            data: driver
        });
    } catch (error) {
        console.error('Error getting driver profile:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ في جلب البيانات'
        });
    }
};

// Update Driver Profile
export const updateDriverProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { vehicleType, vehicleNumber, bankName, accountNumber, accountName } = req.body;

        const driver = await prisma.driver.findUnique({ where: { userId } });
        if (!driver) return res.status(404).json({ status: 'error', message: 'المندوب غير موجود' });

        const updated = await prisma.driver.update({
            where: { userId },
            data: {
                ...(vehicleType !== undefined && { vehicleType }),
                ...(vehicleNumber !== undefined && { vehicleNumber }),
                ...(bankName !== undefined && { bankName }),
                ...(accountNumber !== undefined && { accountNumber }),
                ...(accountName !== undefined && { accountName }),
            },
            include: { user: { select: { fullName: true, phone: true } } }
        });

        res.json({ status: 'success', data: updated });
    } catch (error) {
        console.error('Error updating driver profile:', error);
        res.status(500).json({ status: 'error', message: 'حدث خطأ في تحديث البيانات' });
    }
};

// Resubmit Application
export const resubmitApplication = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { 
            fullName, 
            vehicleType, 
            vehicleNumber, 
            bankName, 
            accountNumber, 
            accountName, 
            idImageUrl, 
            drivingLicenseUrl,
            vehicleImageUrl 
        } = req.body;

        // Update User Profile
        if (fullName) {
            await prisma.user.update({
                where: { id: userId },
                data: { fullName }
            });
        }

        // Update Driver Profile
        const driver = await prisma.driver.update({
            where: { userId },
            data: {
                ...(vehicleType !== undefined && { vehicleType }),
                ...(vehicleNumber !== undefined && { vehicleNumber }),
                ...(bankName !== undefined && { bankName }),
                ...(accountNumber !== undefined && { accountNumber }),
                ...(accountName !== undefined && { accountName }),
                ...(idImageUrl && { idImageUrl }),
                ...(drivingLicenseUrl && { drivingLicenseUrl }),
                ...(vehicleImageUrl && { vehicleImageUrl }),
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
            data: driver
        });
    } catch (error) {
        console.error('Error resubmitting driver application:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ أثناء إعادة تقديم الطلب'
        });
    }
};

// Update Driver Location
export const updateLocation = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { lat, lng } = req.body;

        const driver = await prisma.driver.update({
            where: { userId },
            data: {
                currentLat: lat,
                currentLng: lng,
                lastLocationAt: new Date()
            }
        });

        res.json({
            status: 'success',
            message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„ظ…ظˆظ‚ط¹ ط¨ظ†ط¬ط§ط­',
            data: {
                lat: driver.currentLat,
                lng: driver.currentLng
            }
        });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ طھط­ط¯ظٹط« ط§ظ„ظ…ظˆظ‚ط¹'
        });
    }
};

// Toggle Availability
export const toggleAvailability = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { isAvailable } = req.body;

        const driver = await prisma.driver.update({
            where: { userId },
            data: { isAvailable }
        });

        res.json({
            status: 'success',
            message: `طھظ… ${isAvailable ? 'طھظپط¹ظٹظ„' : 'طھط¹ط·ظٹظ„'} ظˆط¶ط¹ ط§ظ„ط¹ظ…ظ„`,
            data: {
                isAvailable: driver.isAvailable
            }
        });
    } catch (error) {
        console.error('Error toggling availability:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ طھط­ط¯ظٹط« ط§ظ„ط­ط§ظ„ط©'
        });
    }
};

// Get Available Orders
export const getAvailableOrders = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        // Get driver location
        const driver = await prisma.driver.findUnique({
            where: { userId }
        });

        if (!driver || !driver.currentLat || !driver.currentLng) {
            return res.status(400).json({
                status: 'error',
                message: 'ظٹط±ط¬ظ‰ طھظپط¹ظٹظ„ ط®ط¯ظ…ط§طھ ط§ظ„ظ…ظˆظ‚ط¹'
            });
        }

        // Get orders that are ready for pickup and don't have a driver yet
        // Filter: Assigned to me OR Unassigned, AND Not rejected by me
        const orders = await prisma.order.findMany({
            where: {
                status: 'READY',
                driverId: null,
                OR: [
                    { assignedDriverId: userId }, // Assigned to me
                    { assignedDriverId: null }    // Open Pool
                ],
                NOT: {
                    rejectedDriverIds: { has: userId } // I haven't rejected it
                }
            },
            include: {
                merchant: {
                    include: {
                        user: {
                            select: {
                                fullName: true,
                                phone: true
                            }
                        }
                    }
                },
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
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        // TODO: Calculate distance from driver location
        // TODO: Sort by distance

        res.json({
            status: 'success',
            data: orders
        });
    } catch (error) {
        console.error('Error getting available orders:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط·ظ„ط¨ط§طھ'
        });
    }
};



// Accept Order
export const acceptOrder = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { id } = req.params;

        // Check if order is still available
        const order = await prisma.order.findUnique({
            where: { id }
        });

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }



        // Security Check: Is this order actually assigned to this driver?
        // @ts-ignore: Prisma types update pending
        if (order.assignedDriverId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'ظ‡ط°ط§ ط§ظ„ط·ظ„ط¨ ظ„ظ… ظٹط¹ط¯ ظ…طھط§ط­ط§ظ‹ ظ„ظƒ (ط±ط¨ظ…ط§ طھظ… طھط¹ظٹظٹظ†ظ‡ ظ„ط³ط§ط¦ظ‚ ط¢ط®ط± ط£ظˆ ط§ظ†طھظ‡طھ ط§ظ„ظ…ظ‡ظ„ط©)'
            });
        }

        if (order.driverId) {
            return res.status(400).json({
                status: 'error',
                message: 'طھظ… ظ‚ط¨ظˆظ„ ط§ظ„ط·ظ„ط¨ ظ…ظ† ظ‚ط¨ظ„ ظ…ظ†ط¯ظˆط¨ ط¢ط®ط±'
            });
        }

        if (order.status !== 'READY') {
            return res.status(400).json({
                status: 'error',
                message: 'ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ط¬ط§ظ‡ط² ظ„ظ„ط§ط³طھظ„ط§ظ…'
            });
        }

        // Check if driver is available
        const driver = await prisma.driver.findUnique({
            where: { userId }
        });

        if (!driver?.isAvailable) {
            return res.status(400).json({
                status: 'error',
                message: 'ظٹط¬ط¨ طھظپط¹ظٹظ„ ظˆط¶ط¹ ط§ظ„ط¹ظ…ظ„ ط£ظˆظ„ط§ظ‹'
            });
        }

        // Accept the order
        const updatedOrder = await prisma.order.update({
            where: { id },
            data: {
                driverId: userId,
                // @ts-ignore: Prisma types update pending
                assignedDriverId: null,      // Clear temporary assignment
                // @ts-ignore: Prisma types update pending
                assignmentExpiresAt: null,   // Clear timeout
                status: 'PICKED_UP'          // Moves to active state (In future consider ACCEPTED -> IN_TRANSIT)
            },
            include: {
                merchant: {
                    include: {
                        user: {
                            select: {
                                fullName: true,
                                phone: true
                            }
                        }
                    }
                },
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
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        res.json({
            status: 'success',
            message: 'طھظ… ظ‚ط¨ظˆظ„ ط§ظ„ط·ظ„ط¨ ط¨ظ†ط¬ط§ط­',
            data: updatedOrder
        });
    } catch (error) {
        console.error('Error accepting order:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ظ‚ط¨ظˆظ„ ط§ظ„ط·ظ„ط¨'
        });
    }
};

// Reject Order
export const rejectOrder = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { id } = req.params;

        const order = await prisma.order.findUnique({ where: { id } });

        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Order not found' });
        }

        // Only allow rejection if currently assigned
        // @ts-ignore: Prisma types update pending
        if (order.assignedDriverId !== userId) {
            return res.status(400).json({ status: 'error', message: 'Order is not assigned to you' });
        }

        // Call DispatchService to handle rejection and reassignment
        const { DispatchService } = require('../services/dispatch.service');
        // We do not await this to prevent blocking, OR we await if we want to confirm status
        await DispatchService.handleRejection(id, userId);

        res.json({
            status: 'success',
            message: 'طھظ… ط±ظپط¶ ط§ظ„ط·ظ„ط¨طŒ ط³ظٹطھظ… ط§ظ„ط¨ط­ط« ط¹ظ† ط³ط§ط¦ظ‚ ط¢ط®ط±'
        });

    } catch (error) {
        console.error('Error rejecting order:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

// Get Active Order
export const getActiveOrder = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const order = await prisma.order.findFirst({
            where: {
                driverId: userId,
                status: {
                    in: ['PICKED_UP', 'IN_TRANSIT']
                }
            },
            include: {
                merchant: {
                    include: {
                        user: {
                            select: {
                                fullName: true,
                                phone: true
                            }
                        }
                    }
                },
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
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        res.json({
            status: 'success',
            data: order
        });
    } catch (error) {
        console.error('Error getting active order:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط·ظ„ط¨'
        });
    }
};

// Confirm Pickup
export const confirmPickup = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { id } = req.params;

        const order = await prisma.order.findFirst({
            where: {
                id,
                driverId: userId
            }
        });

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

        const updatedOrder = await prisma.order.update({
            where: { id },
            data: {
                status: 'IN_TRANSIT',
                pickedUpAt: new Date(),
                deliveryOtp
            }
        });

        // Notify Customer with OTP
        await notificationService.sendPushNotification(
            order.customerId,
            'ط§ظ„ظ…ظ†ط¯ظˆط¨ ظپظٹ ط§ظ„ط·ط±ظٹظ‚! ًںڑ™',
            `ط±ظ…ط² طھط£ظƒظٹط¯ ط§ظ„ط§ط³طھظ„ط§ظ… (OTP) ظ„ط·ظ„ط¨ظƒ ظ‡ظˆ: ${deliveryOtp}. ظٹط±ط¬ظ‰ ط¥ط¹ط·ط§ط¦ظ‡ ظ„ظ„ظ…ظ†ط¯ظˆط¨ ط¹ظ†ط¯ ط§ط³طھظ„ط§ظ…ظƒ ظ„ظ„ط·ظ„ط¨.`
        ).catch(err => console.error('Failed to notify customer with OTP:', err));

        res.json({
            status: 'success',
            message: 'طھظ… طھط£ظƒظٹط¯ ط§ظ„ط§ط³طھظ„ط§ظ…طŒ طھظˆط¬ظ‡ ظ„ظ„ط²ط¨ظˆظ† ط§ظ„ط¢ظ†',
            data: updatedOrder
        });
    } catch (error) {
        console.error('Error confirming pickup:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ طھط£ظƒظٹط¯ ط§ظ„ط§ط³طھظ„ط§ظ…'
        });
    }
};

// Cancel Order (Driver Emergency / Issues)
export const cancelOrder = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ status: 'error', message: 'ط³ط¨ط¨ ط§ظ„ط¥ظ„ط؛ط§ط، ظ…ط·ظ„ظˆط¨' });
        }

        const order = await prisma.order.findFirst({
            where: {
                id,
                driverId: userId,
                status: {
                    in: ['ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'IN_TRANSIT']
                }
            },
            include: {
                driver: { include: { user: true } }
            }
        });

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ ط£ظˆ ط؛ظٹط± ظ‚ط§ط¨ظ„ ظ„ظ„ط¥ظ„ط؛ط§ط،'
            });
        }

        const updatedOrder = await prisma.order.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                cancelReason: `ظ…ظ†ط¯ظˆط¨ (${order.driver?.user?.fullName}): ${reason}`
            }
        });

        // Notify Admins
        await notificationService.sendToRole(
            'ADMIN',
            'ط¥ظ„ط؛ط§ط، ط·ط§ط±ط¦ ظ„ط·ظ„ط¨ ًںڑ¨',
            `ظ‚ط§ظ… ط§ظ„ظ…ظ†ط¯ظˆط¨ ط¨ط¥ظ„ط؛ط§ط، ط§ظ„ط·ظ„ط¨ ${id} ط¨ط³ط¨ط¨: ${reason}`,
            { type: 'ORDER_CANCELLED', orderId: id }
        ).catch(err => console.error('Failed to notify admins of cancellation:', err));

        // Notify Customer if applicable
        await notificationService.sendPushNotification(
            order.customerId,
            'ط¹ط°ط±ط§ظ‹طŒ طھظ… ط¥ظ„ط؛ط§ط، ط·ظ„ط¨ظƒ',
            `ظ†ط£ط³ظپ ظ„ط¥ط¨ظ„ط§ط؛ظƒ ط¨ط£ظ†ظ‡ طھظ… ط¥ظ„ط؛ط§ط، ط·ظ„ط¨ظƒ ط¨ط³ط¨ط¨: ${reason}. ظٹط±ط¬ظ‰ ط§ظ„طھظˆط§طµظ„ ظ…ط¹ ط§ظ„ط¯ط¹ظ….`,
            { type: 'ORDER_CANCELLED', orderId: id }
        ).catch(err => console.error('Failed to notify customer of cancellation:', err));

        res.json({
            status: 'success',
            message: 'طھظ… ط¥ظ„ط؛ط§ط، ط§ظ„ط·ظ„ط¨ ظˆط¥ط±ط³ط§ظ„ طھظ‚ط±ظٹط± ظ„ظ„ط¥ط¯ط§ط±ط©',
            data: updatedOrder
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¥ظ„ط؛ط§ط، ط§ظ„ط·ظ„ط¨'
        });
    }
};

// Confirm Delivery
export const confirmDelivery = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { id } = req.params;
        const { otp } = req.body;

        const order = await prisma.order.findFirst({
            where: {
                id,
                driverId: userId
            }
        });

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯'
            });
        }

        if (order.deliveryOtp && order.deliveryOtp !== otp) {
            return res.status(400).json({
                status: 'error',
                message: 'ط±ظ…ط² ط§ظ„ط§ط³طھظ„ط§ظ… (OTP) ط؛ظٹط± طµط­ظٹط­'
            });
        }

        // Calculate driver fee (example: 500 YER base + distance-based)
        const driverFee = new Prisma.Decimal(500); // TODO: Calculate based on distance

        const result = await prisma.$transaction(async (tx) => {
            // Update order status
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    status: 'DELIVERED',
                    deliveredAt: new Date(),
                    isPaid: true,
                    paidAt: new Date()
                }
            });

            // Create payment record
            await tx.payment.create({
                data: {
                    orderId: id,
                    totalAmount: order.totalAmount,
                    platformFee: order.platformFee,
                    driverFee,
                    merchantNet: order.totalAmount.minus(order.platformFee).minus(driverFee),
                    status: 'completed'
                }
            });

            // Credit Driver Wallet
            await WalletService.credit(userId, driverFee, {
                tx,
                description: `Earnings for order ${id}`,
                referenceType: 'ORDER_DELIVERY',
                referenceId: id
            });

            // Credit Merchant Wallet
            const merchantNet = order.totalAmount.minus(order.platformFee).minus(driverFee);
            await WalletService.credit(order.merchantId, merchantNet, {
                tx,
                description: `Net earnings for order ${id}`,
                referenceType: 'ORDER_SALES',
                referenceId: id
            });

            return updatedOrder;
        });

        res.json({
            status: 'success',
            message: 'طھظ… طھط³ظ„ظٹظ… ط§ظ„ط·ظ„ط¨ ط¨ظ†ط¬ط§ط­',
            data: {
                order: result,
                earnings: Number(driverFee)
            }
        });
    } catch (error) {
        console.error('Error confirming delivery:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ طھط£ظƒظٹط¯ ط§ظ„طھط³ظ„ظٹظ…'
        });
    }
};

// Get Earnings Summary
export const getEarningsSummary = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { period = 'today' } = req.query;

        let startDate = new Date();

        if (period === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'week') {
            startDate.setDate(startDate.getDate() - 7);
        } else if (period === 'month') {
            startDate.setMonth(startDate.getMonth() - 1);
        }

        const deliveredOrders = await prisma.order.findMany({
            where: {
                driverId: userId,
                status: 'DELIVERED',
                deliveredAt: {
                    gte: startDate
                }
            },
            include: {
                payment: true
            }
        });

        const totalEarnings = deliveredOrders.reduce((sum, order) => {
            return sum + (order.payment ? Number(order.payment.driverFee) : 0);
        }, 0);

        const totalOrders = deliveredOrders.length;

        res.json({
            status: 'success',
            data: {
                period,
                totalEarnings,
                totalOrders,
                averagePerOrder: totalOrders > 0 ? totalEarnings / totalOrders : 0
            }
        });
    } catch (error) {
        console.error('Error getting earnings summary:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط£ط±ط¨ط§ط­'
        });
    }
};

// Request Withdrawal
export const requestWithdrawal = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { amount, bankAccountId } = req.body;
        const idempotencyKey = req.headers['idempotency-key'] as string;

        // Perform withdrawal logic through WalletService
        const withdrawal = await WalletService.createWithdrawal({
            driverId: userId,
            amount: new Prisma.Decimal(amount),
            bankAccountId,
            idempotencyKey
        });

        // Notify Admins
        await notificationService.sendToRole(
            'ADMIN',
            'ط·ظ„ط¨ ط³ط­ط¨ ط¬ط¯ظٹط¯',
            `ط·ظ„ط¨ ط³ط­ط¨ ط¨ظ‚ظٹظ…ط© ${amount} ظ…ظ† ط§ظ„ظ…ظ†ط¯ظˆط¨`,
            { type: 'withdrawal', withdrawalId: withdrawal.id }
        ).catch(err => console.error('Failed to notify admins:', err));

        res.json({
            status: 'success',
            message: 'طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط³ط­ط¨ ط¨ظ†ط¬ط§ط­',
            data: withdrawal
        });
    } catch (error: any) {
        // Handle idempotency conflict (P2002 Unique constraint failed on idempotency_key)
        if (error.code === 'P2002' && error.meta?.target?.includes('idempotency_key')) {
            const idempotencyKey = req.headers['idempotency-key'] as string;
            const existing = await prisma.withdrawal.findFirst({
                where: { idempotencyKey }
            });
            return res.json({
                status: 'success',
                message: 'ط·ظ„ط¨ ظ…ظƒط±ط± - طھظ… ط§ط³طھط±ط¬ط§ط¹ ط§ظ„ط·ظ„ط¨ ط§ظ„ط³ط§ط¨ظ‚',
                data: existing
            });
        }

        console.error('Error requesting withdrawal:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط·ظ„ط¨ ط§ظ„ط³ط­ط¨'
        });
    }
};

// Get Order History
export const getOrderHistory = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { page = 1, limit = 10 } = req.query;

        const skip = (Number(page) - 1) * Number(limit);

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: {
                    driverId: userId,
                    status: 'DELIVERED'
                },
                skip,
                take: Number(limit),
                include: {
                    merchant: {
                        include: {
                            user: {
                                select: {
                                    fullName: true
                                }
                            }
                        }
                    },
                    customer: {
                        include: {
                            user: {
                                select: {
                                    fullName: true
                                }
                            }
                        }
                    },
                    payment: true
                },
                orderBy: { deliveredAt: 'desc' }
            }),
            prisma.order.count({
                where: {
                    driverId: userId,
                    status: 'DELIVERED'
                }
            })
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
        console.error('Error getting order history:', error);
        res.status(500).json({
            status: 'error',
            message: 'ط­ط¯ط« ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط³ط¬ظ„'
        });
    }
};
