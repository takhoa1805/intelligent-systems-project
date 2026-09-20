import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { create } from './event.controller.js';

export const eventRouter = Router();
eventRouter.post('/', asyncHandler(create));
