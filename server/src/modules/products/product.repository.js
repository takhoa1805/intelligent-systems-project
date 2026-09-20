import { query } from '../../config/database.js';

const productSelect = `
  SELECT p.id, p.category_id, p.name, p.slug, p.description, p.price::float, p.stock,
         p.image_url, p.accent, p.featured, p.rating::float, p.tags,
         c.name AS category, c.slug AS category_slug
  FROM products p
  JOIN categories c ON c.id = p.category_id`;

export async function findProducts({ search, category, featured }) {
  const values = [];
  const filters = ['p.active = true'];

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    filters.push(`(p.name ILIKE $${index} OR p.description ILIKE $${index} OR p.tags::text ILIKE $${index})`);
  }
  if (category && category !== 'all') {
    values.push(category);
    filters.push(`c.slug = $${values.length}`);
  }
  if (featured) filters.push('p.featured = true');

  const { rows } = await query(
    `${productSelect} WHERE ${filters.join(' AND ')}
     ORDER BY p.featured DESC, p.created_at DESC`,
    values,
  );
  return rows;
}

export async function findAdminProducts() {
  const { rows } = await query(
    `${productSelect} WHERE p.active = true ORDER BY p.updated_at DESC, p.created_at DESC`,
  );
  return rows;
}

export async function findProductById(id) {
  const { rows } = await query(`${productSelect} WHERE p.id = $1 AND p.active = true`, [id]);
  return rows[0] ?? null;
}

export async function insertProduct(product) {
  const { rows } = await query(
    `INSERT INTO products
       (name, slug, description, price, stock, category_id, tags, accent, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, name, slug, description, price::float, stock, category_id,
               tags, accent, featured, active, rating::float, created_at`,
    [
      product.name, product.slug, product.description, product.price,
      product.stock, product.categoryId, product.tags, product.accent,
      product.featured,
    ],
  );
  return rows[0];
}

export async function updateProduct(id, product) {
  const { rows } = await query(
    `UPDATE products SET
       name = $2, description = $3, price = $4, stock = $5,
       category_id = $6, tags = $7, accent = $8, featured = $9,
       updated_at = NOW()
     WHERE id = $1 AND active = true
     RETURNING id, name, slug, description, price::float, stock, category_id,
               tags, accent, featured, active, rating::float, created_at, updated_at`,
    [
      id, product.name, product.description, product.price, product.stock,
      product.categoryId, product.tags, product.accent, product.featured,
    ],
  );
  return rows[0] ?? null;
}

export async function deactivateProduct(id) {
  const { rows } = await query(
    `UPDATE products SET active = false, featured = false, updated_at = NOW()
     WHERE id = $1 AND active = true RETURNING id`,
    [id],
  );
  return rows[0] ?? null;
}
