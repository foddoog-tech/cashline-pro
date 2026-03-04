import { PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from '../middleware/prisma-soft-delete';

const prisma = new PrismaClient({
    log: [
        { emit: 'stdout', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
    ],
});
softDeleteMiddleware(prisma);

export default prisma;
