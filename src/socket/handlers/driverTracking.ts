import { Server, Socket } from 'socket.io';
import prisma from '../../lib/prisma';

export const handleDriverTracking = (io: Server, socket: Socket) => {
    // Join admin room
    socket.on('join_admin_room', () => {
        if (socket.data.user?.role === 'ADMIN') {
            socket.join('admins');
            console.log(`🛡️ Admin ${socket.data.user.id} joined tracking room`);
        }
    });

    // Join order tracking room (for Customers)
    socket.on('join_order_tracking', async (data: { orderId: string }) => {
        try {
            const { orderId } = data;
            const userId = socket.data.user?.id;

            // Verify order belongs to user or user is admin
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                select: { customerId: true }
            });

            if (order && (order.customerId === userId || socket.data.user?.role === 'ADMIN')) {
                socket.join(`order_${orderId}`);
                console.log(`📦 User ${userId} joined tracking room for order ${orderId}`);
            } else {
                socket.emit('error', { message: 'Unauthorized to track this order' });
            }
        } catch (error) {
            console.error('Error joining order tracking:', error);
        }
    });

    // Leave order tracking room
    socket.on('leave_order_tracking', (data: { orderId: string }) => {
        socket.leave(`order_${data.orderId}`);
        console.log(`👋 User left tracking room for order ${data.orderId}`);
    });

    // Handle Location Updates (from Drivers)
    socket.on('driver_location_update', async (data: {
        lat: number;
        lng: number;
        accuracy?: number;
        speed?: number;
        timestamp?: string;
    }) => {
        try {
            const driverId = socket.data.user?.id;
            const { lat, lng } = data;

            if (!driverId || socket.data.user?.role !== 'DRIVER') return;

            // Update DB
            const updatedDriver = await prisma.driver.update({
                where: { userId: driverId },
                data: {
                    currentLat: lat,
                    currentLng: lng,
                    // lastLocationAt: new Date()
                },
                include: { user: { select: { fullName: true, phone: true } } }
            });

            console.log(`📍 Driver ${driverId} location updated: ${lat}, ${lng}`);

            const locationUpdate = {
                driverId: driverId,
                location: {
                    lat: lat,
                    lng: lng,
                    accuracy: data.accuracy || 0,
                    speed: data.speed || 0,
                    timestamp: data.timestamp || new Date().toISOString()
                },
                driverInfo: {
                    name: updatedDriver.user.fullName.split(' ')[0], // Only first name for privacy
                    vehicleType: updatedDriver.vehicleType,
                }
            };

            // 1. Broadcast to admins
            io.to('admins').emit('driver_location_update', {
                ...locationUpdate,
                name: updatedDriver.user.fullName // Full name for admins
            });

            // 2. Broadcast to specific order rooms
            // Find active orders for this driver
            const activeOrders = await prisma.order.findMany({
                where: {
                    driverId: driverId,
                    status: { in: ['PICKED_UP', 'IN_TRANSIT'] }
                },
                select: { id: true }
            });

            activeOrders.forEach(order => {
                io.to(`order_${order.id}`).emit('driver_location', {
                    ...locationUpdate,
                    orderId: order.id,
                    estimatedArrival: "Calculating..." // Would integrate with Google Maps API here
                });
            });

            console.log(`📍 Location update from driver ${driverId} sent to ${activeOrders.length} order rooms`);

        } catch (error) {
            console.error('Error in driver_location_update:', error);
        }
    });

    socket.on('disconnect', () => {
        if (socket.data.user?.role === 'DRIVER') {
            const driverId = socket.data.user.id;
            io.to('admins').emit('driver_offline', { driverId });

            // Notify customers in order rooms
            // (Note: This is simplified, ideally we'd track which rooms the driver was in)
            io.emit('driver_offline_for_order', { driverId });
        }
    });
};
