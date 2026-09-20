import * as repository from './product.repository.js';
import { AppError } from '../../shared/AppError.js';
import { createUniqueSlug } from '../../shared/slug.js';
import {
  parseProductFilters,
  parseProductId,
  parseProductWriteDto,
  type ProductDto,
  type ProductQueryDto,
  type ProductWriteDto,
} from './product.dto.js';

export function listProducts(filters: ProductQueryDto): Promise<ProductDto[]> {
  return repository.findProducts(parseProductFilters(filters));
}

export function listAdminProducts(): Promise<ProductDto[]> {
  return repository.findAdminProducts();
}

export async function getProduct(id: unknown): Promise<ProductDto> {
  const productId = parseProductId(id);
  const product = await repository.findProductById(productId);
  if (!product) throw new AppError('Product not found', 404);
  return product;
}

function normalizeProduct(input: unknown): ProductWriteDto {
  return parseProductWriteDto(input);
}

export function createProduct(input: unknown): Promise<ProductDto> {
  const product = normalizeProduct(input);
  return repository.insertProduct({ ...product, slug: createUniqueSlug(product.name) });
}

export async function updateProduct(id: unknown, input: unknown): Promise<ProductDto> {
  const productId = parseProductId(id);
  const updated = await repository.updateProduct(productId, normalizeProduct(input));
  if (!updated) throw new AppError('Product not found', 404);
  return updated;
}

export async function removeProduct(id: unknown): Promise<void> {
  const productId = parseProductId(id);
  const removed = await repository.deactivateProduct(productId);
  if (!removed) throw new AppError('Product not found', 404);
}
