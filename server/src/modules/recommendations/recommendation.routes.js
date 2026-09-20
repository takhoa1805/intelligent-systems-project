import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { list } from './recommendation.controller.js';

export const recommendationRouter = Router();
recommendationRouter.get('/', asyncHandler(list));
