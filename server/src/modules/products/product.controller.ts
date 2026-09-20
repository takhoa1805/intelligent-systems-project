import * as productService from './product.service.js';
import type { Request, Response } from 'express';
import type { ProductDto, ProductQueryDto } from './product.dto.js';

export async function list(
  req: Request<Record<string, never>, ProductDto[], unknown, ProductQueryDto>,
  res: Response<ProductDto[]>,
): Promise<void> {
  res.json(await productService.listProducts(req.query));
}

export async function getById(req: Request, res: Response<ProductDto>): Promise<void> {
  res.json(await productService.getProduct(req.params.id));
}

export async function create(req: Request, res: Response<ProductDto>): Promise<void> {
  res.status(201).json(await productService.createProduct(req.body));
}
