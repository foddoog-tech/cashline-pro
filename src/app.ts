import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import merchantRoutes from './routes/merchant.routes';
import orderRoutes from './routes/order.routes';
import driverRoutes from './routes/driver.routes';
import adminRoutes from './routes/admin.routes';
import notificationRoutes from './routes/notification.routes';
import paymentRoutes from './routes/payment.routes';
import productRoutes from './routes/product.routes';
import uploadRoutes from './routes/upload.routes';
import wishlistRoutes from './routes/wishlist.routes'; // ✅ مفضلة المرحلة 2
import promoRoutes from './routes/promo.routes';     // ✅ كود الخصم المرحلة 3
import addressRoutes from './routes/address.routes'; // ✅ عناوين التوصيل المرحلة 4.5
import { setupSocketHandlers } from './services/socket.service';

import { errorHandler } from './middleware/errorHandler';

// Initialize Express app
export const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.replace(/['"]/g, '').split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Static Files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Static Files Serve (Uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/merchants', merchantRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/wishlist', wishlistRoutes); // ✅ مفضلة المرحلة 2
app.use('/api/v1/promo', promoRoutes);    // ✅ كود الخصم المرحلة 3
app.use('/api/v1/addresses', addressRoutes); // ✅ عناوين التوصيل المرحلة 4.5


// Socket.IO Setup
setupSocketHandlers(io);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

// Professional Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Accessible externally at http://${getIpAddress()}:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1/docs`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  });
}

function getIpAddress() {
  const interfaces = require('os').networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '0.0.0.0';
}

export { io };
export default app;
