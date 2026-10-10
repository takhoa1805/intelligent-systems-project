-- Match bounded storefront and recommendation sort orders at imported catalog scale.
CREATE INDEX idx_products_active_featured_created_id
ON products(active, featured DESC, created_at DESC, id DESC);

CREATE INDEX idx_products_active_price_id
ON products(active, price, id);

CREATE INDEX idx_products_active_featured_rating_id
ON products(active, featured DESC, rating DESC, id);

CREATE INDEX idx_products_category_active_rating_id
ON products(category_id, active, rating DESC, id);

CREATE INDEX idx_products_active_rating_id
ON products(active, rating DESC, id);
