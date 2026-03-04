import { NotificationService } from '../../../src/services/notification.service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => {
    const mockPrisma = {
        notification: {
            create: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
        order: {
            findUnique: jest.fn(),
        },
    };

    return {
        PrismaClient: jest.fn(() => mockPrisma),
    };
});

describe('NotificationService', () => {
    let notificationService: NotificationService;
    let prisma: any;

    beforeEach(() => {
        notificationService = new NotificationService();
        prisma = new PrismaClient();
        jest.clearAllMocks();
    });

    describe('saveNotification', () => {
        it('should save notification to database', async () => {
            const userId = 'user-123';
            const title = 'Test Notification';
            const body = 'Test Body';
            const type = 'system';

            prisma.notification.create.mockResolvedValue({
                id: 'notif-123',
                userId,
                title,
                body,
                type,
                isRead: false,
                createdAt: new Date(),
            });

            await notificationService.saveNotification(userId, title, body, type);

            expect(prisma.notification.create).toHaveBeenCalledWith({
                data: {
                    userId,
                    title,
                    body,
                    type,
                    data: {},
                    isRead: false,
                },
            });
        });

        it('should handle errors when saving notification', async () => {
            const userId = 'user-123';
            const title = 'Test Notification';
            const body = 'Test Body';
            const type = 'system';

            prisma.notification.create.mockRejectedValue(new Error('Database error'));

            await expect(
                notificationService.saveNotification(userId, title, body, type)
            ).rejects.toThrow('Database error');
        });
    });

    describe('getUserNotifications', () => {
        it('should get user notifications with default limit', async () => {
            const userId = 'user-123';
            const mockNotifications = [
                { id: '1', title: 'Notif 1', body: 'Body 1', isRead: false },
                { id: '2', title: 'Notif 2', body: 'Body 2', isRead: true },
            ];

            prisma.notification.findMany.mockResolvedValue(mockNotifications);

            const result = await notificationService.getUserNotifications(userId);

            expect(prisma.notification.findMany).toHaveBeenCalledWith({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 20,
            });
            expect(result).toEqual(mockNotifications);
        });

        it('should get user notifications with custom limit', async () => {
            const userId = 'user-123';
            const limit = 10;

            prisma.notification.findMany.mockResolvedValue([]);

            await notificationService.getUserNotifications(userId, limit);

            expect(prisma.notification.findMany).toHaveBeenCalledWith({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
        });
    });

    describe('markAsRead', () => {
        it('should mark notification as read', async () => {
            const notificationId = 'notif-123';

            prisma.notification.update.mockResolvedValue({
                id: notificationId,
                isRead: true,
            });

            await notificationService.markAsRead(notificationId);

            expect(prisma.notification.update).toHaveBeenCalledWith({
                where: { id: notificationId },
                data: { isRead: true },
            });
        });
    });

    describe('markAllAsRead', () => {
        it('should mark all user notifications as read', async () => {
            const userId = 'user-123';

            prisma.notification.updateMany.mockResolvedValue({ count: 5 });

            await notificationService.markAllAsRead(userId);

            expect(prisma.notification.updateMany).toHaveBeenCalledWith({
                where: { userId, isRead: false },
                data: { isRead: true },
            });
        });
    });

    describe('deleteOldNotifications', () => {
        it('should delete old read notifications', async () => {
            const days = 30;

            prisma.notification.deleteMany.mockResolvedValue({ count: 10 });

            await notificationService.deleteOldNotifications(days);

            expect(prisma.notification.deleteMany).toHaveBeenCalled();
            const callArgs = prisma.notification.deleteMany.mock.calls[0][0];
            expect(callArgs.where.isRead).toBe(true);
            expect(callArgs.where.createdAt.lt).toBeInstanceOf(Date);
        });
    });
});
