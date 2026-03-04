import { Router } from 'express';
import {
    createOrder,
    getOrderDetails,
    updateOrderStatus,
    cancelOrder,
    getMyOrders,
    reorderOrder // ✅ إعادة الطلب
} from '../controllers/order.controller';
import { rateOrder } from '../controllers/customer.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Protect all order routes
router.use(authenticate);

// Customer Routes
router.post('/', authorize('CUSTOMER'), createOrder);
router.get('/', authorize('CUSTOMER'), getMyOrders);
router.get('/my-orders', authorize('CUSTOMER'), getMyOrders);
router.post('/:id/cancel', authorize('CUSTOMER', 'MERCHANT', 'ADMIN'), cancelOrder);
router.post('/:id/reorder', authorize('CUSTOMER'), reorderOrder); // ✅ جديد

// Shared/General Routes
router.get('/:id', getOrderDetails);
router.post('/:id/rate', authorize('CUSTOMER'), rateOrder);

// Merchant/Driver/Admin Routes
router.put('/:id/status', authorize('MERCHANT', 'DRIVER', 'ADMIN'), updateOrderStatus);

export default router;

