import { getRecommendations } from './recommendation.service.js';

export async function list(req, res) {
  res.json(await getRecommendations(req.query));
}
