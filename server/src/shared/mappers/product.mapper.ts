import type { Prisma } from '@prisma/client';
import type { ProductDto } from '../../modules/products/product.dto.js';

type ProductWithCategory = Prisma.ProductGetPayload<{ include: { category: true } }>;

export function toProductDto(product: ProductWithCategory): ProductDto {
  return {
    id: product.id,
    category_id: product.categoryId,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    stock: product.stock,
    image_url: product.imageUrl,
    accent: product.accent,
    featured: product.featured,
    active: product.active,
    rating: Number(product.rating),
    tags: product.tags,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
    ...(product.category ? {
      category: product.category.name,
      category_slug: product.category.slug,
    } : {}),
  };
}
