import { Router } from 'express';
import * as driverController from '../controllers/driver.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Profile
router.get('/profile', driverController.getDriverProfile);

// Location
router.put('/location', driverController.updateLocation);

// Availability
router.put('/availability', driverController.toggleAvailability);

// Orders
router.get('/orders/available', driverController.getAvailableOrders);
router.get('/orders/active', driverController.getActiveOrder);
router.get('/orders/history', driverController.getOrderHistory);
router.post('/orders/:id/accept', driverController.acceptOrder);
router.post('/orders/:id/reject', driverController.rejectOrder);
router.post('/orders/:id/cancel', driverController.cancelOrder);
router.put('/orders/:id/pickup', driverController.confirmPickup);
router.put('/orders/:id/deliver', driverController.confirmDelivery);

// Earnings
router.get('/earnings/summary', driverController.getEarningsSummary);
router.post('/withdrawals', driverController.requestWithdrawal);

export default router;
