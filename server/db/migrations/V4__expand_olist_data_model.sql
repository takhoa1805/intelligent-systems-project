-- Add historical marketplace entities without changing the storefront workflows.
ALTER TABLE categories
  ADD COLUMN data_source VARCHAR(30) NOT NULL DEFAULT 'signal_shop',
  ADD COLUMN source_category_name VARCHAR(80),
  ADD CONSTRAINT uq_categories_source_name UNIQUE (data_source, source_category_name);

CREATE TABLE category_translations (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL UNIQUE REFERENCES categories(id),
  portuguese_name VARCHAR(80) NOT NULL UNIQUE,
  english_name VARCHAR(80) NOT NULL
);

CREATE TABLE customers (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(120) NOT NULL
);

CREATE TABLE customer_snapshots (
  id VARCHAR(32) PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL REFERENCES customers(id),
  zip_code_prefix VARCHAR(5) NOT NULL CHECK (zip_code_prefix ~ '^[0-9]{5}$'),
  city VARCHAR(120) NOT NULL,
  state VARCHAR(2) NOT NULL
);
CREATE INDEX idx_customer_snapshots_customer ON customer_snapshots(customer_id);
CREATE INDEX idx_customer_snapshots_zip ON customer_snapshots(zip_code_prefix);

CREATE TABLE sellers (
  id VARCHAR(32) PRIMARY KEY,
  zip_code_prefix VARCHAR(5) NOT NULL CHECK (zip_code_prefix ~ '^[0-9]{5}$'),
  city VARCHAR(120) NOT NULL,
  state VARCHAR(2) NOT NULL
);
CREATE INDEX idx_sellers_zip ON sellers(zip_code_prefix);

CREATE TABLE geolocations (
  id BIGSERIAL PRIMARY KEY,
  source_row INTEGER NOT NULL UNIQUE CHECK (source_row > 0),
  zip_code_prefix VARCHAR(5) NOT NULL CHECK (zip_code_prefix ~ '^[0-9]{5}$'),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  city VARCHAR(120) NOT NULL,
  state VARCHAR(2) NOT NULL
);
-- ZIP prefixes are neither unique nor foreign keys for customers/sellers.
CREATE INDEX idx_geolocations_zip ON geolocations(zip_code_prefix);

ALTER TABLE products
  ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN data_source VARCHAR(30) NOT NULL DEFAULT 'signal_shop',
  ADD COLUMN source_id VARCHAR(32),
  ADD COLUMN synthetic_catalog BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN catalog_seed VARCHAR(80),
  ADD COLUMN source_name_length INTEGER CHECK (source_name_length >= 0),
  ADD COLUMN source_description_length INTEGER CHECK (source_description_length >= 0),
  ADD COLUMN photos_quantity INTEGER CHECK (photos_quantity >= 0),
  ADD COLUMN weight_g INTEGER CHECK (weight_g >= 0),
  ADD COLUMN length_cm INTEGER CHECK (length_cm >= 0),
  ADD COLUMN height_cm INTEGER CHECK (height_cm >= 0),
  ADD COLUMN width_cm INTEGER CHECK (width_cm >= 0),
  ADD CONSTRAINT uq_products_source_id UNIQUE (data_source, source_id);

ALTER TABLE orders
  ALTER COLUMN customer_email DROP NOT NULL,
  ALTER COLUMN subtotal DROP NOT NULL,
  ALTER COLUMN total DROP NOT NULL,
  ADD COLUMN data_source VARCHAR(30) NOT NULL DEFAULT 'signal_shop',
  ADD COLUMN source_id VARCHAR(32),
  ADD COLUMN customer_id VARCHAR(32) REFERENCES customers(id),
  ADD COLUMN customer_snapshot_id VARCHAR(32) UNIQUE REFERENCES customer_snapshots(id),
  ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN shipping_total NUMERIC(12,2) CHECK (shipping_total >= 0),
  ADD COLUMN payment_total NUMERIC(12,2) CHECK (payment_total >= 0),
  ADD COLUMN purchased_at TIMESTAMP,
  ADD COLUMN approved_at TIMESTAMP,
  ADD COLUMN delivered_carrier_at TIMESTAMP,
  ADD COLUMN delivered_customer_at TIMESTAMP,
  ADD COLUMN estimated_delivery_at TIMESTAMP,
  ADD CONSTRAINT uq_orders_source_id UNIQUE (data_source, source_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_source_status_purchase ON orders(data_source, status, purchased_at);

ALTER TABLE order_items
  ADD COLUMN source_item_sequence INTEGER CHECK (source_item_sequence > 0),
  ADD COLUMN seller_id VARCHAR(32) REFERENCES sellers(id),
  ADD COLUMN freight_value NUMERIC(12,2) CHECK (freight_value >= 0),
  ADD COLUMN shipping_limit_at TIMESTAMP,
  ADD CONSTRAINT uq_order_items_source_sequence UNIQUE (order_id, source_item_sequence);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_seller ON order_items(seller_id);

CREATE TABLE order_payments (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  type VARCHAR(30) NOT NULL,
  installments INTEGER NOT NULL CHECK (installments >= 0),
  value NUMERIC(12,2) NOT NULL CHECK (value >= 0),
  CONSTRAINT uq_order_payments_sequence UNIQUE (order_id, sequence)
);

CREATE TABLE order_reviews (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  source_review_id VARCHAR(32) NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment_title TEXT,
  comment_message TEXT,
  review_created_at TIMESTAMP NOT NULL,
  answered_at TIMESTAMP NOT NULL,
  CONSTRAINT uq_order_reviews_source_id UNIQUE (order_id, source_review_id)
);
CREATE INDEX idx_order_reviews_source_id ON order_reviews(source_review_id);
