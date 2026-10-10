import { z } from 'zod';
import { parseDto } from '../../shared/dto/validation.js';

export interface ProductDto {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  image_url: string | null;
  accent: string;
  featured: boolean;
  active: boolean;
  rating: number;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  category?: string;
  category_slug?: string;
}

export interface ProductWriteDto {
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: number;
  tags: string[];
  accent: string;
  featured: boolean;
}

export interface ProductCreateRecord extends ProductWriteDto {
  slug: string;
}

export interface ProductFilterDto {
  search: string;
  category: string;
  featured: boolean;
  page: number;
  pageSize: number;
  sort: 'featured' | 'low' | 'high' | 'rating';
}

export interface ProductPageDto {
  items: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductQueryDto {
  search?: string;
  category?: string;
  featured?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
}

export interface IdParamsDto {
  id: string;
}

const productWriteSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1),
  price: z.coerce.number().positive(),
  stock: z.coerce.number().int().nonnegative(),
  categoryId: z.coerce.number().int().positive(),
  tags: z.array(z.string().trim().min(1)),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  featured: z.boolean(),
});

export function parseProductWriteDto(input: unknown): ProductWriteDto {
  return parseDto(productWriteSchema, input);
}

export function parseProductId(value: unknown): number {
  return parseDto(z.coerce.number().int().positive(), value);
}

const productFilterSchema = z.object({
  search: z.string().trim().max(200).default(''),
  category: z.string().trim().max(80).default(''),
  featured: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  sort: z.enum(['featured', 'low', 'high', 'rating']).default('featured'),
});

export function parseProductFilters(query: ProductQueryDto): ProductFilterDto {
  return parseDto(productFilterSchema, query);
}
