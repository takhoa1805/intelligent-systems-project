import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { list } from './category.controller.js';

export const categoryRouter = Router();
categoryRouter.get('/', asyncHandler(list));
