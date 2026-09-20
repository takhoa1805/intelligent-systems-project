import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import * as controller from './admin.controller.js';

export const adminRouter = Router();
adminRouter.get('/overview', asyncHandler(controller.overview));
adminRouter.get('/products', asyncHandler(controller.products));
adminRouter.post('/products', asyncHandler(controller.createProductForAdmin));
adminRouter.put('/products/:id', asyncHandler(controller.updateProductForAdmin));
adminRouter.delete('/products/:id', asyncHandler(controller.removeProductForAdmin));
