import prisma from '../lib/prisma';

export interface AuditLogData {
    tx?: any; // Prisma transaction client
    tableName: string;
    recordId: string;
    action: string;
    oldData?: any;
    newData?: any;
    performedBy?: string;
    ipAddress?: string;
    userAgent?: string;
}

export class AuditService {
    static async log(data: AuditLogData) {
        const client = data.tx || prisma;

        // Sanitize data (remove passwords, etc)
        const sanitize = (obj: any) => {
            if (!obj) return obj;
            const sanitized = { ...obj };
            delete sanitized.passwordHash;
            delete sanitized.password;
            return sanitized;
        };

        return client.auditLog.create({
            data: {
                tableName: data.tableName,
                recordId: data.recordId,
                action: data.action,
                oldData: sanitize(data.oldData),
                newData: sanitize(data.newData),
                performedBy: data.performedBy,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent
            }
        });
    }
}
