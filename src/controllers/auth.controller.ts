import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

import { logger } from '../utils/logger';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { sendSMS } from '../services/sms.service';

const prisma = new PrismaClient();

// Login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, password, fcmToken } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid phone number or password',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'Account is deactivated',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid phone number or password',
      });
    }

    // Check Approval Status for DRIVER and MERCHANT
      if (user.role === 'DRIVER') {
      const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
      let isApproved = driver?.isApproved ?? false;
      let rejectionReason = null;

      if (!isApproved) {
        // Fetch rejection reason
        const notification = await prisma.notification.findFirst({
          where: { userId: user.id, type: 'ACCOUNT_REJECTED' },
          orderBy: { createdAt: 'desc' }
        });
        rejectionReason = notification?.data ? (notification.data as any).reason : null;
      }
      
      (user as any).isApproved = isApproved;
      (user as any).rejectionReason = rejectionReason;

    } else if (user.role === 'MERCHANT' || user.role === 'FAMILY_PRODUCER') {
      const merchant = await prisma.merchant.findUnique({ where: { userId: user.id } });
      let isApproved = merchant?.isApproved ?? false;
      let rejectionReason = null;

      if (!isApproved) {
        // Fetch rejection reason
        const notification = await prisma.notification.findFirst({
          where: { userId: user.id, type: 'ACCOUNT_REJECTED' },
          orderBy: { createdAt: 'desc' }
        });
        rejectionReason = notification?.data ? (notification.data as any).reason : null;
      }
      
      (user as any).isApproved = isApproved;
      (user as any).rejectionReason = rejectionReason;
    } else {
      (user as any).isApproved = true; // Customers are implicitly approved
    }

    // Update FCM token if provided
    if (fcmToken) {
      await prisma.user.update({
        where: { id: user.id },
        data: { fcmToken }
      });
    }

    // Generate tokens
    const tokens = generateTokens(user.id, user.role);

    // Log login
    logger.info(`User logged in: ${user.id}`);

    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          fullName: user.fullName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
          isApproved: (user as any).isApproved,
          rejectionReason: (user as any).rejectionReason,
        },
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Register Customer
export const registerCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, password, fullName, address, lat, lng, building, floor, apartment } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'Phone number already registered',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with customer profile
    const user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        fullName,
        role: 'CUSTOMER',
        customer: {
          create: {
            address,
            lat,
            lng,
            building,
            floor,
            apartment,
          },
        },
      },
      include: {
        customer: true,
      },
    });

    // Generate tokens
    const tokens = generateTokens(user.id, user.role);

    // Send welcome SMS
    await sendSMS(phone, `ظ…ط±ط­ط¨ط§ظ‹ ${fullName}! طھظ… طھط³ط¬ظٹظ„ظƒ ط¨ظ†ط¬ط§ط­ ظپظٹ ظƒط§ط´ ظ„ط§ظٹظ†.`);

    logger.info(`Customer registered: ${user.id}`);

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          fullName: user.fullName,
          role: user.role,
        },
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Register Merchant
export const registerMerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      phone,
      password,
      fullName,
      storeName,
      description,
      address,
      lat,
      lng,
      bankName,
      accountNumber,
      accountName,
      licenseNumber,
      idImageUrl,
      licenseImageUrl,
      type = 'MERCHANT',
    } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'Phone number already registered',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with merchant profile
    const user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        fullName,
        role: type === 'FAMILY_PRODUCER' ? 'FAMILY_PRODUCER' : 'MERCHANT',
        merchant: {
          create: {
            type,
            storeName,
            description,
            address,
            lat,
            lng,
            bankName,
            accountNumber,
            accountName,
            licenseNumber,
            idImageUrl,
            licenseImageUrl,
            commissionRate: type === 'FAMILY_PRODUCER' ? 0.03 : 0.05,
            isApproved: false,
          },
        },
      },
      include: {
        merchant: true,
      },
    });

    logger.info(`Merchant registered (pending approval): ${user.id}`);

    // Generate tokens
    const tokens = generateTokens(user.id, user.role);

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Pending admin approval.',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          fullName: user.fullName,
          role: user.role,
          isApproved: false,
        },
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Register Driver
export const registerDriver = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      phone,
      password,
      fullName,
      vehicleType,
      vehicleNumber,
      bankName,
      accountNumber,
      accountName,
      idImageUrl,
      vehicleImageUrl,   // ✅ صورة المركبة/اللوحة
      licenseImageUrl,   // ✅ صورة الاستمارة
    } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'Phone number already registered',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with driver profile
    const user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        fullName,
        role: 'DRIVER',
        driver: {
          create: {
            vehicleType,
            vehicleNumber,
            bankName,
            accountNumber,
            accountName,
            idImageUrl,
            vehicleImageUrl,   // ✅ حفظ صورة المركبة
            licenseImageUrl,   // ✅ حفظ صورة الاستمارة
            isApproved: false,
            isAvailable: false,
          },
        },
      },
      include: {
        driver: true,
      },
    });

    logger.info(`Driver registered (pending approval): ${user.id}`);

    // ✅ أضف token حتى يتمكن التطبيق من auto-login
    const tokens = generateTokens(user.id, user.role);

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Pending admin approval.',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          fullName: user.fullName,
          role: user.role,
          isApproved: false,
          vehicleType: user.driver?.vehicleType,
          vehicleNumber: user.driver?.vehicleNumber,
          bankName: user.driver?.bankName,
          accountNumber: user.driver?.accountNumber,
          accountName: user.driver?.accountName,
        },
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Verify Phone
export const verifyPhone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code } = req.body;

    // TODO: Implement actual SMS verification
    // For now, accept any 4-digit code
    if (code.length !== 4) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid verification code',
      });
    }

    res.json({
      status: 'success',
      message: 'Phone number verified successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Refresh Token
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token is required',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const tokens = generateTokens(decoded.userId, decoded.role);

    res.json({
      status: 'success',
      data: { tokens },
    });
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid refresh token',
    });
  }
};

// Logout
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Invalidate token in Redis
    res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Forgot Password
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // TODO: Generate and send reset code via SMS
    const resetCode = Math.floor(1000 + Math.random() * 9000).toString();

    await sendSMS(phone, `ط±ظ…ط² ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±: ${resetCode}`);

    res.json({
      status: 'success',
      message: 'Reset code sent to your phone',
    });
  } catch (error) {
    next(error);
  }
};

// Reset Password
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code, newPassword } = req.body;

    // TODO: Verify reset code
    // For now, accept any 4-digit code
    if (code.length !== 4) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid reset code',
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { phone },
      data: { passwordHash },
    });

    res.json({
      status: 'success',
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Change Password (Authenticated)
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Incorrect current password',
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};
// Update Profile
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, email } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        email
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true
      }
    });

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    next(error);
  }
};

// Get Profile
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true
      }
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Check Approval Status for DRIVER and MERCHANT
    let isApproved = true;
    let rejectionReason = null;

    if (user.role === 'DRIVER') {
      const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
      isApproved = driver?.isApproved ?? false;

      if (!isApproved) {
        // Fetch rejection reason
        const notification = await prisma.notification.findFirst({
          where: { userId: user.id, type: 'ACCOUNT_REJECTED' },
          orderBy: { createdAt: 'desc' }
        });
        rejectionReason = notification?.data ? (notification.data as any).reason : null;
      }

    } else if (user.role === 'MERCHANT' || user.role === 'FAMILY_PRODUCER') {
      const merchant = await prisma.merchant.findUnique({ where: { userId: user.id } });
      isApproved = merchant?.isApproved ?? false;

      if (!isApproved) {
        // Fetch rejection reason
        const notification = await prisma.notification.findFirst({
          where: { userId: user.id, type: 'ACCOUNT_REJECTED' },
          orderBy: { createdAt: 'desc' }
        });
        rejectionReason = notification?.data ? (notification.data as any).reason : null;
      }
    }

    res.json({
      status: 'success',
      data: {
        user: {
          ...user,
          isApproved,
          rejectionReason,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update FCM Token
export const updateFcmToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { fcmToken } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    if (!fcmToken) {
      return res.status(400).json({
        status: 'error',
        message: 'fcmToken is required',
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });

    res.json({
      status: 'success',
      message: 'FCM token updated successfully',
    });
  } catch (error) {
    next(error);
  }
};


