import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { create } from './order.controller.js';

export const orderRouter = Router();
orderRouter.post('/', asyncHandler(create));
