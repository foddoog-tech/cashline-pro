import { Router } from 'express';
import {
    getAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
} from '../controllers/address.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// جميع مسارات العناوين تتطلب CUSTOMER
router.use(authenticate, authorize('CUSTOMER'));

router.get('/', getAddresses);    // جلب الكل
router.post('/', createAddress);   // إضافة
router.put('/:id', updateAddress);   // تحديث
router.delete('/:id', deleteAddress);  // حذف

export default router;
