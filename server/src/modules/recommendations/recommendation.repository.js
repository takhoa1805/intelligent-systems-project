import { query } from '../../config/database.js';

export async function findPlaceholderRecommendations(productId, limit) {
  const { rows } = await query(
    `SELECT p.id, p.name, p.slug, p.description, p.price::float, p.stock,
            p.image_url, p.accent, p.featured, p.rating::float, p.tags,
            c.name AS category, c.slug AS category_slug,
            CASE
              WHEN p.category_id = source.category_id THEN 0.91
              WHEN p.featured THEN 0.78
              ELSE 0.62
            END::float AS score
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN products source ON source.id = $1
     WHERE p.active = true AND p.id <> $1
     ORDER BY score DESC, p.rating DESC LIMIT $2`,
    [productId, limit],
  );
  return rows;
}
