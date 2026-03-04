import { Router } from 'express';
import { body } from 'express-validator';
import {
  login,
  registerCustomer,
  registerMerchant,
  registerDriver,
  logout,
  refreshToken,
  verifyPhone,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  getProfile,
  updateFcmToken,
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

const router = Router();

// Change Password
router.put(
  '/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters'),
    validate,
  ],
  changePassword
);

// Update Profile
router.put(
  '/profile',
  authenticate,
  [
    body('fullName').optional().isLength({ min: 3 }),
    body('email').optional().isEmail(),
    validate,
  ],
  updateProfile
);

// Get Profile
router.get('/profile', authenticate, getProfile);

// Update FCM Token
router.put(
  '/fcm-token',
  authenticate,
  [
    body('fcmToken').notEmpty().withMessage('fcmToken is required'),
    validate,
  ],
  updateFcmToken
);



// Login
router.post(
  '/login',
  [
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^\+?[0-9]{9,15}$/)
      .withMessage('Invalid phone number format'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    validate,
  ],
  login
);

// Register Customer
router.post(
  '/register/customer',
  [
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^\+?[0-9]{9,15}$/)
      .withMessage('Invalid phone number format'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('fullName')
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Full name must be between 3 and 100 characters'),
    body('address')
      .notEmpty()
      .withMessage('Address is required'),
    validate,
  ],
  registerCustomer
);

// Register Merchant
router.post(
  '/register/merchant',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('storeName').notEmpty().withMessage('Store name is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('bankName').notEmpty().withMessage('Bank name is required'),
    body('accountNumber').notEmpty().withMessage('Account number is required'),
    body('accountName').notEmpty().withMessage('Account name is required'),
    validate,
  ],
  registerMerchant
);

// Register Driver
router.post(
  '/register/driver',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('vehicleType')
      .notEmpty()
      .withMessage('Vehicle type is required')
      .isIn(['motorcycle', 'car', 'bicycle'])
      .withMessage('Invalid vehicle type'),
    body('bankName').notEmpty().withMessage('Bank name is required'),
    body('accountNumber').notEmpty().withMessage('Account number is required'),
    body('accountName').notEmpty().withMessage('Account name is required'),
    validate,
  ],
  registerDriver
);

// Verify Phone
router.post(
  '/verify-phone',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('code')
      .notEmpty()
      .withMessage('Verification code is required')
      .isLength({ min: 4, max: 6 })
      .withMessage('Invalid verification code'),
    validate,
  ],
  verifyPhone
);

// Refresh Token
router.post('/refresh', refreshToken);

// Logout
router.post('/logout', logout);

// Forgot Password
router.post(
  '/forgot-password',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    validate,
  ],
  forgotPassword
);

// Reset Password
router.post(
  '/reset-password',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('code').notEmpty().withMessage('Reset code is required'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    validate,
  ],
  resetPassword
);

export default router;
