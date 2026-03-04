
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';

const prisma = new PrismaClient();

export function setupSocketHandlers(io: Server) {
  // Socket Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    // Access from socket.data
    const userId = socket.data.user?.userId;
    console.log(`🔌 Client connected: ${socket.id} (User: ${userId})`);

    // Join personal room using userId
    if (userId) {
      socket.join(userId);
      console.log(`📍 Socket ${socket.id} joined personal room: ${userId}`);
    }

    // Join specific rooms
    socket.on('join-room', (room: string) => {
      socket.join(room);
      console.log(`📍 Socket ${socket.id} joined room: ${room}`);
    });

    // Admin joins monitoring room
    socket.on('join-admin', () => {
      socket.join('admins');
      console.log(`🛡️ Admin joined monitoring room: ${socket.id}`);
    });

    // Handle order updates (e.g. status change)
    socket.on('order-update', (data) => {
      // Notify specific user or driver involved
      if (data.driverId) io.to(data.driverId).emit('order-status', data);
      if (data.userId) io.to(data.userId).emit('order-status', data);
    });

    // Handle high-frequency location updates from Driver App
    socket.on('location-update', async (data: { driverId: string; lat: number; lng: number }) => {
      try {
        // 1. Update Database (Async, don't block flow)
        // We use distinctId or userId to find driver
        const updated = await prisma.driver.update({
          where: { userId: data.driverId },
          data: {
            currentLat: data.lat,
            currentLng: data.lng
          },
          select: {
            userId: true,
            vehicleType: true,
            user: { select: { fullName: true, phone: true } }
          }
        });

        // 2. Emit to Admins Room ONLY (Secure & Efficient)
        io.to('admins').emit('driver-moved', {
          id: updated.userId,
          lat: data.lat,
          lng: data.lng,
          name: updated.user.fullName,
          phone: updated.user.phone,
          vehicle: updated.vehicleType,
          status: 'ONLINE'
        });

      } catch (error) {
        // Silent fail for high-freq updates
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
}
