import { Router } from 'express';
import * as merchantController from '../controllers/merchant.controller';
import * as customerController from '../controllers/customer.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Profile
router.get('/profile', merchantController.getMerchantProfile);
router.put('/profile', merchantController.updateMerchantProfile);

// Products
router.get('/products', merchantController.getMerchantProducts);
router.post('/products', merchantController.addProduct);
router.put('/products/:id', merchantController.updateProduct);
router.delete('/products/:id', merchantController.deleteProduct);

// Orders
router.get('/orders', merchantController.getMerchantOrders);
router.put('/orders/:id/status', merchantController.updateOrderStatus);

// Finance
router.get('/finance/summary', merchantController.getFinanceSummary);
router.post('/withdrawals', merchantController.requestWithdrawal);

// Customer Routes (Public for authenticated users)
router.get('/all-products', customerController.getAllProducts);
router.get('/', customerController.getMerchants);
router.get('/:merchantId/products', customerController.getMerchantProducts);

export default router;
