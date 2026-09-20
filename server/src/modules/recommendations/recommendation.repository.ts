import { db } from '../../config/database.js';
import { toProductDto } from '../../shared/mappers/product.mapper.js';
import type { RecommendationItemDto } from './recommendation.dto.js';

export async function findPlaceholderRecommendations(
  productId: number,
  limit: number,
): Promise<RecommendationItemDto[]> {
  const [source, candidates] = await Promise.all([
    productId ? db.product.findFirst({ where: { id: productId, active: true } }) : null,
    db.product.findMany({
      where: { active: true, ...(productId ? { id: { not: productId } } : {}) },
      include: { category: true },
    }),
  ]);

  return candidates
    .map((product) => ({
      ...toProductDto(product),
      score: source && product.categoryId === source.categoryId
        ? 0.91
        : product.featured ? 0.78 : 0.62,
    }))
    .sort((a, b) => b.score - a.score || b.rating - a.rating)
    .slice(0, limit);
}
