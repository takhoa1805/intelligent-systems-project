import { findPlaceholderRecommendations } from './recommendation.repository.js';
import {
  parseRecommendationQuery,
  type RecommendationQueryDto,
  type RecommendationResponseDto,
} from './recommendation.dto.js';

export async function getRecommendations(query: RecommendationQueryDto): Promise<RecommendationResponseDto> {
  const { productId, limit } = parseRecommendationQuery(query);
  return {
    model: 'hybrid-placeholder-v0',
    strategy: productId ? 'category-affinity-placeholder' : 'popular-placeholder',
    note: 'Replace this module with ARM and word-embedding candidate ranking later.',
    items: await findPlaceholderRecommendations(productId, limit),
  };
}
