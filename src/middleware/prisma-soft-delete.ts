import { PrismaClient } from '@prisma/client';

export const softDeleteMiddleware = (prisma: PrismaClient) => {
    prisma.$use(async (params, next) => {
        const modelsWithSoftDelete = ['User', 'Customer', 'Merchant', 'Driver', 'Product', 'Order'];

        if (modelsWithSoftDelete.includes(params.model || '')) {
            console.log(`[SOFT-DELETE] Intercepting ${params.model} ${params.action}`);
            if (params.action === 'findUnique' || params.action === 'findFirst') {
                params.action = 'findFirst';
                params.args.where = { ...params.args.where, deletedAt: null };
            }
            if (params.action === 'findMany') {
                if (!params.args.where) params.args.where = {};
                if (!params.args.where.deletedAt) {
                    params.args.where.deletedAt = null;
                }
            }
            if (params.action === 'delete') {
                params.action = 'update';
                params.args.data = { deletedAt: new Date() };
            }
        }

        return next(params);
    });
};
