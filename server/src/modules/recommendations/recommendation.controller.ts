import { getRecommendations } from './recommendation.service.js';
import type { Request, Response } from 'express';
import type { RecommendationQueryDto, RecommendationResponseDto } from './recommendation.dto.js';

export async function list(
  req: Request<Record<string, never>, RecommendationResponseDto, unknown, RecommendationQueryDto>,
  res: Response<RecommendationResponseDto>,
): Promise<void> {
  res.json(await getRecommendations(req.query));
}
