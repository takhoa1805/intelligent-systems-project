import { getOverview } from './admin.repository.js';
import {
  createProduct,
  listAdminProducts,
  removeProduct,
  updateProduct,
} from '../products/product.service.js';
import type { Request, Response } from 'express';
import type { AdminOverviewDto } from './admin.dto.js';
import type { ProductDto } from '../products/product.dto.js';

export async function overview(_req: Request, res: Response<AdminOverviewDto>): Promise<void> {
  res.json(await getOverview());
}

export async function createProductForAdmin(req: Request, res: Response<ProductDto>): Promise<void> {
  res.status(201).json(await createProduct(req.body));
}

export async function products(_req: Request, res: Response<ProductDto[]>): Promise<void> {
  res.json(await listAdminProducts());
}

export async function updateProductForAdmin(req: Request, res: Response<ProductDto>): Promise<void> {
  res.json(await updateProduct(req.params.id, req.body));
}

export async function removeProductForAdmin(req: Request, res: Response): Promise<void> {
  await removeProduct(req.params.id);
  res.status(204).end();
}
