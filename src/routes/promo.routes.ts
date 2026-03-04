import { Router } from 'express';
import { validatePromoCode, applyPromoCode } from '../controllers/promo.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// POST /api/v1/promo/validate — التحقق من الكود (العميل فقط)
router.post('/validate', authenticate, authorize('CUSTOMER'), validatePromoCode);

// POST /api/v1/promo/apply — تطبيق الكود بعد الطلب (العميل فقط)
router.post('/apply', authenticate, authorize('CUSTOMER'), applyPromoCode);

export default router;
