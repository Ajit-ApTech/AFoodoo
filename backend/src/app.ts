import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { firebaseApp } from './firebase';
import userRoutes from './routes/users';
import mealSlotRoutes from './routes/mealSlots';
import menuItemRoutes from './routes/menuItems';
import orderRoutes from './routes/orders';
import subscriptionRoutes from './routes/subscriptions';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Simple health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/meal-slots', mealSlotRoutes);
app.use('/api/menu-items', menuItemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });
}

export default app;
