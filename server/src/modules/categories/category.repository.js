import { query } from '../../config/database.js';

export async function findCategories() {
  const { rows } = await query(
    `SELECT c.id, c.name, c.slug, COUNT(p.id)::int AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.active = true
     GROUP BY c.id ORDER BY c.name`,
  );
  return rows;
}
