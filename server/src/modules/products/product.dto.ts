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
}

export interface ProductQueryDto {
  search?: string;
  category?: string;
  featured?: string;
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

export function parseProductFilters(query: ProductQueryDto): ProductFilterDto {
  return {
    search: String(query.search || '').trim(),
    category: String(query.category || '').trim(),
    featured: query.featured === 'true',
  };
}
