ALTER TABLE products
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX idx_products_active_updated_at
ON products(active, updated_at DESC);
