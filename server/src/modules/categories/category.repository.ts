import { db } from '../../config/database.js';
import type { CategoryDto } from './category.dto.js';

export async function findCategories(): Promise<CategoryDto[]> {
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
