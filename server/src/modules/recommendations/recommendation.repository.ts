import { db } from '../../config/database.js';
import { toProductDto } from '../../shared/mappers/product.mapper.js';
import type { RecommendationItemDto } from './recommendation.dto.js';

export async function findPlaceholderRecommendations(
  productId: number,
  limit: number,
): Promise<RecommendationItemDto[]> {
  const source = productId
    ? await db.product.findFirst({ where: { id: productId, active: true }, select: { categoryId: true } })
    : null;
  const [categoryMatches, fallback] = await Promise.all([
    source ? db.product.findMany({
      where: { active: true, id: { not: productId }, categoryId: source.categoryId },
      include: { category: true },
      orderBy: [{ rating: 'desc' }, { id: 'asc' }],
      take: limit,
    }) : [],
    db.product.findMany({
      where: {
        active: true,
        ...(productId ? { id: { not: productId } } : {}),
        ...(source ? { categoryId: { not: source.categoryId } } : {}),
      },
      include: { category: true },
      orderBy: [{ featured: 'desc' }, { rating: 'desc' }, { id: 'asc' }],
      take: limit,
    }),
  ]);

  return [...categoryMatches, ...fallback].slice(0, limit)
    .map((product) => ({
      ...toProductDto(product),
      score: source && product.categoryId === source.categoryId
        ? 0.91
        : product.featured ? 0.78 : 0.62,
    }));
}
