
import prisma from '../lib/prisma';
import { notificationService } from './notification.service';
import { io } from '../app';

export class DispatchService {
    private static readonly ASSIGNMENT_TIMEOUT = 45000; // 45 seconds

    // 1. Assign Driver to Order (Smart Logic)
    static async assignOrder(orderId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { merchant: true }
        });

        if (!order) throw new Error('Order not found');

        // Allow reassignment if status is READY
        if (order.status !== 'READY') {
            console.log(`Order ${orderId} is not READY (Status: ${order.status}), skipping assignment.`);
            return null;
        }

        // Get Merchant Location
        const merchantLat = order.merchant?.lat || 0;
        const merchantLng = order.merchant?.lng || 0;

        // Find Available Drivers NOT in Rejected List
        const drivers = await prisma.driver.findMany({
            where: {
                isAvailable: true,
                currentLat: { not: null },
                currentLng: { not: null },
                // @ts-ignore: Prisma types update pending
                userId: { notIn: (order as any).rejectedDriverIds || [] }
            }
        });

        if (drivers.length === 0) {
            console.log(`⚠️ No available drivers found for Order #${orderId}`);
            // Notify Admin?
            return null;
        }

        // Sort by Distance
        const sortedDrivers = drivers.sort((a, b) => {
            const distA = this.calculateDistance(merchantLat, merchantLng, a.currentLat || 0, a.currentLng || 0);
            const distB = this.calculateDistance(merchantLat, merchantLng, b.currentLat || 0, b.currentLng || 0);
            return distA - distB;
        });

        const selectedDriver = sortedDrivers[0];

        // Assign Order
        await prisma.order.update({
            where: { id: orderId },
            data: {
                // @ts-ignore: Prisma types update pending
                assignedDriverId: selectedDriver.userId,
                // @ts-ignore: Prisma types update pending
                assignmentExpiresAt: new Date(Date.now() + this.ASSIGNMENT_TIMEOUT),
            }
        });

        // Notify Driver via Push
        try {
            await notificationService.notifyDriverAssignment(selectedDriver.userId, orderId);

            // Notify Driver via Socket (Real-time)
            io.to(selectedDriver.userId).emit('order:assigned', {
                orderId: order.id,
                merchantName: order.merchant?.storeName,
                totalAmount: order.totalAmount,
                deliveryFee: order.deliveryFee
            });

        } catch (e: any) {
            console.error(`Failed to notify driver ${selectedDriver.userId}:`, e.message);
        }
        console.log(`✅ Order #${orderId} assigned to Driver ${selectedDriver.userId}`);

        // Schedule Reassignment Check (Simple Timeout for now)
        setTimeout(() => {
            this.checkAssignmentStatus(orderId, selectedDriver.userId);
        }, this.ASSIGNMENT_TIMEOUT + 2000); // Add buffer

        return selectedDriver;
    }

    // 2. Handle Rejection / Timeout
    static async handleRejection(orderId: string, driverId: string) {
        console.log(`🚫 Driver ${driverId} rejected/timed out Order #${orderId}`);

        // Add to Rejected List and Clean Assignment
        await prisma.order.update({
            where: { id: orderId },
            data: {
                // @ts-ignore: Prisma types update pending
                assignedDriverId: null,
                // @ts-ignore: Prisma types update pending
                assignmentExpiresAt: null,
                // @ts-ignore: Prisma types update pending
                rejectedDriverIds: { push: driverId }
            }
        });

        // Notify Driver (Cancel/Hide Order)
        io.to(driverId).emit('order:cancelled', { orderId, reason: 'timeout_or_rejected' });

        // Try Next Driver
        // Use setImmediate to avoid stack overflow in recursion scenarios or blocking
        setImmediate(() => {
            this.assignOrder(orderId);
        });
    }

    // 3. Helper: Distance Calculation (Haversine)
    private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d;
    }

    private static deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    // 4. Background Check (Called by timeout)
    private static async checkAssignmentStatus(orderId: string, assignedDriverId: string) {
        try {
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            // Check if still assigned to SAME driver AND status is still READY (not accepted)
            // @ts-ignore: Prisma types update pending
            if (order && order.assignedDriverId === assignedDriverId && order.status === 'READY') {
                console.log(`⏰ Assignment expired for Order #${orderId}. Reassigning...`);
                await this.handleRejection(orderId, assignedDriverId);
            }
        } catch (err) {
            console.error("Error in checkAssignmentStatus:", err);
        }
    }
}
