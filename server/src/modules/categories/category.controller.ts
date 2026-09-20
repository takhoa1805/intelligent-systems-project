import { findCategories } from './category.repository.js';
import type { Request, Response } from 'express';
import type { CategoryDto } from './category.dto.js';

export async function list(_req: Request, res: Response<CategoryDto[]>): Promise<void> {
  res.json(await findCategories());
}
