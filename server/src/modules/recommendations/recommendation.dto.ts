import { z } from 'zod';
import { parseDto } from '../../shared/dto/validation.js';
import type { ProductDto } from '../products/product.dto.js';

export interface RecommendationQueryDto {
  productId?: string;
  limit?: string;
}

export interface RecommendationItemDto extends ProductDto {
  score: number;
}

export interface RecommendationResponseDto {
  model: string;
  strategy: string;
  note: string;
  items: RecommendationItemDto[];
}

export function parseRecommendationQuery(query: RecommendationQueryDto): { productId: number; limit: number } {
  const schema = z.object({
    productId: z.coerce.number().int().nonnegative().optional(),
    limit: z.coerce.number().int().min(1).max(12).optional(),
  });
  const parsed = parseDto(schema, query);
  return { productId: parsed.productId ?? 0, limit: parsed.limit ?? 4 };
}
