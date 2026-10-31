import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { listOrders, inspectOrder } from './admin-orders.controller.js';
import * as controller from './admin.controller.js';

export const adminRouter = Router();
adminRouter.get('/orders', asyncHandler(listOrders));
adminRouter.get('/orders/:id', asyncHandler(inspectOrder));
adminRouter.get('/overview', asyncHandler(controller.overview));
adminRouter.get('/products', asyncHandler(controller.products));
adminRouter.post('/products', asyncHandler(controller.createProductForAdmin));
adminRouter.put('/products/:id', asyncHandler(controller.updateProductForAdmin));
adminRouter.delete('/products/:id', asyncHandler(controller.removeProductForAdmin));
