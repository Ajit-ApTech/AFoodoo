import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import { requestMetrics, getMetricsSummary } from './middleware/metrics';
import { logger } from './logger';
import userRoutes from './routes/users';
import mealSlotRoutes from './routes/mealSlots';
import menuItemRoutes from './routes/menuItems';
import orderRoutes from './routes/orders';
import subscriptionRoutes from './routes/subscriptions';
import walletRoutes from './routes/wallet';
import adminRoutes from './routes/admin';
import paymentRoutes from './routes/payments';

dotenv.config();

const app = express();

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // allow Swagger UI inline assets
  })
);

// CORS Whitelist Configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS whitelist policy'));
      }
    },
    credentials: true,
  })
);

// Rate Limiting (100 requests per 15 min window per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use(limiter);

// Request Parsing & Structured Metrics Middleware
app.use(express.json());
app.use(requestMetrics);

// Swagger Documentation Route
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health & Metrics Endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/metrics', (_req: Request, res: Response) => {
  res.json(getMetricsSummary());
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/meal-slots', mealSlotRoutes);
app.use('/api/menu-items', menuItemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled Application Error', { error: err.message, stack: err.stack });
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    logger.info(`🚀 Production-hardened server listening on port ${PORT}`);
    logger.info(`📖 OpenAPI Swagger docs available at http://localhost:${PORT}/docs`);
  });
}

export default app;
