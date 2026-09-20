import * as repository from './product.repository.js';
import { AppError } from '../../shared/AppError.js';
import { createUniqueSlug } from '../../shared/slug.js';

export function listProducts(filters) {
  return repository.findProducts({
    search: String(filters.search || '').trim(),
    category: String(filters.category || '').trim(),
    featured: filters.featured === 'true',
  });
}

export function listAdminProducts() {
  return repository.findAdminProducts();
}

export async function getProduct(id) {
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId < 1) throw new AppError('Invalid product id', 400);
  const product = await repository.findProductById(productId);
  if (!product) throw new AppError('Product not found', 404);
  return product;
}

function normalizeProduct(input) {
  const { name, description, categoryId } = input;
  const price = Number(input.price);
  const stock = Number(input.stock || 0);
  if (!name?.trim() || !description?.trim() || !categoryId || !Number.isFinite(price) || price <= 0) {
    throw new AppError('Name, description, positive price and category are required', 400);
  }
  if (!Number.isInteger(stock) || stock < 0) throw new AppError('Stock must be a non-negative integer', 400);

  return {
    name: name.trim(),
    description: description.trim(),
    price,
    stock,
    categoryId: Number(categoryId),
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
    accent: input.accent || '#FF6B35',
    featured: Boolean(input.featured),
  };
}

export function createProduct(input) {
  const product = normalizeProduct(input);
  return repository.insertProduct({ ...product, slug: createUniqueSlug(product.name) });
}

export async function updateProduct(id, input) {
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId < 1) throw new AppError('Invalid product id', 400);
  const updated = await repository.updateProduct(productId, normalizeProduct(input));
  if (!updated) throw new AppError('Product not found', 404);
  return updated;
}

export async function removeProduct(id) {
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId < 1) throw new AppError('Invalid product id', 400);
  const removed = await repository.deactivateProduct(productId);
  if (!removed) throw new AppError('Product not found', 404);
}
