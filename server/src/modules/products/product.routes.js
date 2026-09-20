import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import * as controller from './product.controller.js';

export const productRouter = Router();
productRouter.get('/', asyncHandler(controller.list));
productRouter.get('/:id', asyncHandler(controller.getById));
