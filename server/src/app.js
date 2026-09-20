import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { db } from './config/database.js';
import { asyncHandler } from './shared/asyncHandler.js';
import { productRouter } from './modules/products/product.routes.js';
import { categoryRouter } from './modules/categories/category.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { eventRouter } from './modules/events/event.routes.js';
import { recommendationRouter } from './modules/recommendations/recommendation.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', asyncHandler(async (_req, res) => {
  await db.category.count();
  res.json({ status: 'ok', service: 'signal-shop-api' });
}));

app.use('/api/products', productRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/orders', orderRouter);
app.use('/api/events', eventRouter);
app.use('/api/recommendations', recommendationRouter);
app.use('/api/admin', adminRouter);

app.use(notFound);
app.use(errorHandler);
