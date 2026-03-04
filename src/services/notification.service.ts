import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Initialize Firebase Admin (if not already initialized)
let firebaseApp: admin.app.App;

try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
        const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);

        if (fs.existsSync(resolvedPath)) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const serviceAccount = require(resolvedPath);
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('✅ Firebase initialized successfully');
        } else {
            console.warn(`⚠️ Firebase key file not found at: ${resolvedPath}`);
        }
    } else {
        console.warn('⚠️ Firebase service account path not found in .env');
    }
} catch (error) {
    console.warn('Firebase initialization failed:', error);
}

export class NotificationService {
    /**
     * إرسال إشعار Push لمستخدم واحد
     */
    async sendPushNotification(
        userId: string,
        title: string,
        body: string,
        data?: Record<string, any>
    ): Promise<void> {
        try {
            // حفظ الإشعار في قاعدة البيانات
            await this.saveNotification(userId, title, body, data?.type || 'system', data);

            // إرسال Push Notification عبر FCM
            if (firebaseApp) {
                // الحصول على FCM token من المستخدم (يجب حفظه عند تسجيل الدخول)
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                });

                const fcmToken = user?.fcmToken;

                if (fcmToken) {
                    await admin.messaging().send({
                        token: fcmToken,
                        notification: { title, body },
                        data: data || {},
                    });
                    console.log(`📲 Push sent to ${userId}`);
                } else {
                    console.log(`⚠️ No FCM token for user ${userId}`);
                }

                console.log(`Push notification sent to user ${userId}: ${title}`);
            }
        } catch (error) {
            console.error('Error sending push notification:', error);
            throw error;
        }
    }

    /**
     * إرسال إشعار لسائق تم تعيين طلب له
     */
    async notifyDriverAssignment(driverId: string, orderId: string): Promise<void> {
        await this.sendPushNotification(
            driverId,
            '🚖 طلب جديد بانتظارك!',
            'تم تعيين طلب جديد لك. اضغط للقبول قبل انتهاء الوقت!',
            { type: 'NEW_ORDER_ASSIGNMENT', orderId }
        );
    }

    /**
     * إرسال إشعار لمجموعة من المستخدمين
     */
    async sendToMultiple(
        userIds: string[],
        title: string,
        body: string,
        data?: Record<string, any>
    ): Promise<void> {
        try {
            const promises = userIds.map(userId =>
                this.sendPushNotification(userId, title, body, data)
            );
            await Promise.all(promises);
        } catch (error) {
            console.error('Error sending multiple notifications:', error);
            throw error;
        }
    }

    /**
     * إرسال إشعار لجميع المستخدمين من نوع معين
     */
    async sendToRole(
        role: string,
        title: string,
        body: string,
        data?: Record<string, any>
    ): Promise<void> {
        try {
            const users = await prisma.user.findMany({
                where: { role: role as any },
                select: { id: true },
            });

            const userIds = users.map(u => u.id);
            await this.sendToMultiple(userIds, title, body, data);
        } catch (error) {
            console.error('Error sending notifications to role:', error);
            throw error;
        }
    }

    /**
     * حفظ الإشعار في قاعدة البيانات
     */
    async saveNotification(
        userId: string,
        title: string,
        body: string,
        type: string,
        data?: Record<string, any>
    ): Promise<void> {
        try {
            await prisma.notification.create({
                data: {
                    userId,
                    title,
                    body,
                    type,
                    data: data || {},
                    isRead: false,
                },
            });
        } catch (error) {
            console.error('Error saving notification:', error);
            throw error;
        }
    }

    /**
     * جلب إشعارات المستخدم
     */
    async getUserNotifications(userId: string, limit: number = 20) {
        try {
            return await prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
        } catch (error) {
            console.error('Error getting user notifications:', error);
            throw error;
        }
    }

    /**
     * تحديد الإشعار كمقروء
     */
    async markAsRead(notificationId: string): Promise<void> {
        try {
            await prisma.notification.update({
                where: { id: notificationId },
                data: { isRead: true },
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * تحديد جميع إشعارات المستخدم كمقروءة
     */
    async markAllAsRead(userId: string): Promise<void> {
        try {
            await prisma.notification.updateMany({
                where: { userId, isRead: false },
                data: { isRead: true },
            });
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    /**
     * حذف الإشعارات القديمة
     */
    async deleteOldNotifications(days: number = 30): Promise<void> {
        try {
            const date = new Date();
            date.setDate(date.getDate() - days);

            await prisma.notification.deleteMany({
                where: {
                    createdAt: { lt: date },
                    isRead: true,
                },
            });
        } catch (error) {
            console.error('Error deleting old notifications:', error);
            throw error;
        }
    }

    /**
     * إشعارات خاصة بالطلبات
     */
    async notifyNewOrder(orderId: string): Promise<void> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    customer: { include: { user: true } },
                    merchant: { include: { user: true } },
                },
            });

            if (!order) return;

            // إشعار للتاجر
            await this.sendPushNotification(
                order.merchantId,
                'طلب جديد',
                `طلب جديد #${orderId.slice(0, 8)} بقيمة ${order.totalAmount} ر.ي`,
                { type: 'order', orderId }
            );

            // إشعار للإدارة
            const admins = await prisma.user.findMany({
                where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
                select: { id: true },
            });

            for (const admin of admins) {
                await this.sendPushNotification(
                    admin.id,
                    'طلب جديد في النظام',
                    `طلب جديد #${orderId.slice(0, 8)}`,
                    { type: 'order', orderId }
                );
            }
        } catch (error) {
            console.error('Error notifying new order:', error);
        }
    }

    /**
     * إشعار عند قبول الطلب
     */
    async notifyOrderAccepted(orderId: string): Promise<void> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { merchant: { include: { user: true } } },
            });

            if (!order) return;

            await this.sendPushNotification(
                order.customerId,
                'تم قبول طلبك',
                `تم قبول طلبك #${orderId.slice(0, 8)} من ${order.merchant.storeName}`,
                { type: 'order', orderId }
            );
        } catch (error) {
            console.error('Error notifying order accepted:', error);
        }
    }

    /**
     * إشعار عند جاهزية الطلب
     */
    async notifyOrderReady(orderId: string): Promise<void> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
            });

            if (!order) return;

            // إشعار للمناديب المتاحين
            const drivers = await prisma.driver.findMany({
                where: { isAvailable: true, isApproved: true },
                select: { userId: true },
            });

            for (const driver of drivers) {
                await this.sendPushNotification(
                    driver.userId,
                    'طلب جاهز للاستلام',
                    `طلب #${orderId.slice(0, 8)} جاهز للتوصيل`,
                    { type: 'order', orderId }
                );
            }
        } catch (error) {
            console.error('Error notifying order ready:', error);
        }
    }

    /**
     * إشعار عند استلام المندوب للطلب
     */
    async notifyOrderPickedUp(orderId: string): Promise<void> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { driver: { include: { user: true } } },
            });

            if (!order || !order.driver) return;

            await this.sendPushNotification(
                order.customerId,
                'المندوب في الطريق',
                `المندوب ${order.driver.user.fullName} في طريقه إليك`,
                { type: 'order', orderId }
            );
        } catch (error) {
            console.error('Error notifying order picked up:', error);
        }
    }

    /**
     * إشعار عند تسليم الطلب
     */
    async notifyOrderDelivered(orderId: string): Promise<void> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
            });

            if (!order) return;

            // إشعار للزبون
            await this.sendPushNotification(
                order.customerId,
                'تم تسليم طلبك',
                `تم تسليم طلبك #${orderId.slice(0, 8)} بنجاح`,
                { type: 'order', orderId }
            );

            // إشعار للتاجر
            await this.sendPushNotification(
                order.merchantId,
                'تم تسليم الطلب',
                `تم تسليم الطلب #${orderId.slice(0, 8)}`,
                { type: 'order', orderId }
            );

            // إشعار للمندوب
            if (order.driverId) {
                await this.sendPushNotification(
                    order.driverId,
                    'تم تسليم الطلب',
                    `تم تسليم الطلب #${orderId.slice(0, 8)} بنجاح`,
                    { type: 'order', orderId }
                );
            }
        } catch (error) {
            console.error('Error notifying order delivered:', error);
        }
    }

    /**
     * إشعار عند الموافقة على التسجيل
     */
    async notifyUserApproved(userId: string, userType: string): Promise<void> {
        try {
            await this.sendPushNotification(
                userId,
                'تمت الموافقة على حسابك',
                `تمت الموافقة على تسجيلك كـ ${userType}. يمكنك البدء الآن!`,
                { type: 'system' }
            );
        } catch (error) {
            console.error('Error notifying user approved:', error);
        }
    }

    /**
     * إشعار عند رفض التسجيل
     */
    async notifyUserRejected(userId: string, reason?: string): Promise<void> {
        try {
            await this.sendPushNotification(
                userId,
                'تم رفض طلب التسجيل',
                reason || 'تم رفض طلب التسجيل. يرجى التواصل مع الإدارة.',
                { type: 'system' }
            );
        } catch (error) {
            console.error('Error notifying user rejected:', error);
        }
    }
}

// Export singleton instance
export const notificationService = new NotificationService();
