export function toProductDto(product) {
  return {
    id: product.id,
    category_id: product.categoryId,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    stock: product.stock,
    image_url: product.imageUrl,
    accent: product.accent,
    featured: product.featured,
    active: product.active,
    rating: Number(product.rating),
    tags: product.tags,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
    category: product.category?.name,
    category_slug: product.category?.slug,
  };
}
