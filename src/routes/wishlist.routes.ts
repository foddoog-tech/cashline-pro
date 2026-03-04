import { Router } from 'express';
import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    moveToCart
} from '../controllers/wishlist.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// جميع مسارات المفضلة تتطلب مصادقة + صلاحية CUSTOMER
router.use(authenticate, authorize('CUSTOMER'));

router.get('/', getWishlist);                       // جلب المفضلة
router.post('/', addToWishlist);                    // إضافة منتج
router.delete('/:productId', removeFromWishlist);   // حذف منتج
router.post('/move-to-cart', moveToCart);           // نقل للسلة

export default router;
