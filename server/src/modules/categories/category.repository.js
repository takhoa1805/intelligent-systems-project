import { db } from '../../config/database.js';

export async function findCategories() {
  const categories = await db.category.findMany({
    include: {
      _count: { select: { products: { where: { active: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  return categories.map(({ _count, ...category }) => ({
    ...category,
    product_count: _count.products,
  }));
}
