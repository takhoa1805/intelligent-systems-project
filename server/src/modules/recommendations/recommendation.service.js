import { findPlaceholderRecommendations } from './recommendation.repository.js';

export async function getRecommendations(query) {
  const parsedProductId = Number(query.productId || 0);
  const parsedLimit = Number(query.limit || 4);
  const productId = Number.isInteger(parsedProductId) && parsedProductId > 0 ? parsedProductId : 0;
  const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 12)) : 4;
  return {
    model: 'hybrid-placeholder-v0',
    strategy: productId ? 'category-affinity-placeholder' : 'popular-placeholder',
    note: 'Replace this module with ARM and word-embedding candidate ranking later.',
    items: await findPlaceholderRecommendations(productId, limit),
  };
}
