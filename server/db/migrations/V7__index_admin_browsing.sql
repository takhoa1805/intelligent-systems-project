-- Stable, bounded Admin catalog pages and recent-order retrieval.
CREATE INDEX idx_products_active_updated_created_id
ON products(active, updated_at DESC, created_at DESC, id DESC);

CREATE INDEX idx_orders_created_id
ON orders(created_at DESC, id DESC);
