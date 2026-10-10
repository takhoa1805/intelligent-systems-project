import { db } from '../../config/database.js';
import { toProductDto } from '../../shared/mappers/product.mapper.js';
import type { Prisma } from '@prisma/client';
import type { ProductCreateRecord, ProductDto, ProductFilterDto, ProductPageDto, ProductWriteDto } from './product.dto.js';

const withCategory = { category: true };

export async function findProducts({ search, category, featured, page, pageSize, sort }: ProductFilterDto, admin = false): Promise<ProductPageDto> {
  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(category && category !== 'all' ? { category: { slug: category } } : {}),
    ...(featured ? { featured: true } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ],
    } : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = sort === 'low'
    ? [{ price: 'asc' }, { id: 'asc' }]
    : sort === 'high' ? [{ price: 'desc' }, { id: 'desc' }]
    : sort === 'rating' ? [{ rating: 'desc' }, { id: 'asc' }]
    : admin ? [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    : [{ featured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
  const [products, total] = await db.$transaction([
    db.product.findMany({
      where, include: withCategory, orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.product.count({ where }),
  ]);
  return {
    items: products.map(toProductDto), total, page, pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function findAdminProducts(filters: ProductFilterDto): Promise<ProductPageDto> {
  return findProducts(filters, true);
}

export async function findProductById(id: number): Promise<ProductDto | null> {
  const product = await db.product.findFirst({
    where: { id, active: true },
    include: withCategory,
  });
  return product ? toProductDto(product) : null;
}

export async function insertProduct(product: ProductCreateRecord): Promise<ProductDto> {
  const created = await db.product.create({
    data: {
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      stock: product.stock,
      categoryId: product.categoryId,
      tags: product.tags,
      accent: product.accent,
      featured: product.featured,
    },
    include: withCategory,
  });
  return toProductDto(created);
}

export async function updateProduct(id: number, product: ProductWriteDto): Promise<ProductDto | null> {
  const result = await db.product.updateMany({
    where: { id, active: true },
    data: {
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      categoryId: product.categoryId,
      tags: product.tags,
      accent: product.accent,
      featured: product.featured,
      updatedAt: new Date(),
    },
  });
  return result.count ? findProductById(id) : null;
}

export async function deactivateProduct(id: number): Promise<{ id: number } | null> {
  const result = await db.product.updateMany({
    where: { id, active: true },
    data: { active: false, featured: false, updatedAt: new Date() },
  });
  return result.count ? { id } : null;
}
