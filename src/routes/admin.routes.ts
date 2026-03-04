import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload.middleware';

const router = Router();

// Protect all admin routes
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));


// 1. Approvals & User Details
router.get('/approvals/:id', adminController.getApprovalDetails);
router.get('/merchants/:id/details', adminController.getMerchantDetails);
router.post('/approvals/:id/upload', upload.single('file'), adminController.uploadDriverDocument);

// 2. User Actions
// Generic Users
router.get('/users', adminController.getUsers);

// Actions
router.put('/users/:id/approve', adminController.approveUser);
router.put('/users/:id/reject', adminController.rejectUser);
router.put('/users/:id/suspend', adminController.suspendUser);
router.put('/users/:id/activate', adminController.activateUser);

// Specific Roles Helpers
router.get('/merchants', (req, res, next) => { (req as any).query.role = 'MERCHANT'; next(); }, adminController.getUsers);
router.get('/drivers', (req, res, next) => { (req as any).query.role = 'DRIVER'; next(); }, adminController.getUsers);
router.get('/drivers/live', adminController.getLiveDrivers);

// 3. Orders Management
router.get('/orders', adminController.getAllOrders);

// 4. Finance
router.get('/finance/summary', adminController.getDashboardStats);
router.get('/finance/commissions', adminController.getCommissions);
router.get('/finance/withdrawals', adminController.getWithdrawals);
router.post('/finance/withdrawals/:id/process', adminController.processWithdrawal);


// 5. Reports & Stats
router.get('/stats', adminController.getDashboardStats);

export default router;
