-- Run after V1-V5 in an isolated database. Fixture changes roll back.
BEGIN;

DO $$
DECLARE
  imported_order BIGINT;
  imported_product INTEGER;
  native_order BIGINT;
  native_product INTEGER;
  existing_review TEXT;
BEGIN
  IF (SELECT count(*) FROM customers WHERE name = id) <> 96096
    OR (SELECT count(*) FROM customer_snapshots) <> 99441
    OR (SELECT count(*) FROM sellers) <> 3095
    OR (SELECT count(*) FROM categories WHERE data_source = 'olist') <> 74
    OR (SELECT count(*) FROM category_translations) <> 71
    OR (SELECT count(*) FROM products WHERE data_source = 'olist') <> 32951
    OR (SELECT count(*) FROM orders WHERE data_source = 'olist') <> 99441
    OR (SELECT count(*) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.data_source = 'olist') <> 112650
    OR (SELECT count(*) FROM order_payments) <> 103886
    OR (SELECT count(*) FROM order_reviews) <> 99224
    OR (SELECT count(*) FROM geolocations) <> 1000163 THEN
    RAISE EXCEPTION 'Imported entity counts do not match the CSV snapshot';
  END IF;

  IF EXISTS (SELECT 1 FROM products WHERE data_source = 'olist'
             AND (NOT synthetic_catalog OR catalog_seed <> 'olist-catalog-v1'
               OR stock NOT BETWEEN 5 AND 200 OR rating NOT BETWEEN 3.5 AND 5
               OR price <= 0 OR currency <> 'BRL' OR image_url IS NOT NULL)) THEN
    RAISE EXCEPTION 'Synthetic catalog provenance/ranges are invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM products p
    JOIN (SELECT product_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY unit_price)::numeric AS median_price
          FROM order_items i JOIN orders o ON o.id = i.order_id
          WHERE o.data_source = 'olist' GROUP BY product_id) history ON history.product_id = p.id
    WHERE p.data_source = 'olist'
      AND (p.price < greatest(0.01, round(history.median_price * 0.90, 2))
           OR p.price > greatest(0.01, round(history.median_price * 1.10, 2)))
  ) THEN
    RAISE EXCEPTION 'Generated price deviates by more than 10 percent from historical median';
  END IF;
  IF (SELECT count(DISTINCT name) FROM products WHERE data_source = 'olist') < 32000
    OR EXISTS (SELECT 1 FROM products p JOIN categories c ON c.id = p.category_id
               WHERE p.data_source = 'olist' AND c.data_source <> 'olist') THEN
    RAISE EXCEPTION 'Catalog identity/category mapping is invalid';
  END IF;

  IF (SELECT sum(i.unit_price) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.data_source = 'olist') <> 13591643.70
    OR (SELECT sum(i.freight_value) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.data_source = 'olist') <> 2251909.54
    OR (SELECT sum(value) FROM order_payments) <> 16008872.12
    OR EXISTS (SELECT 1 FROM order_items i JOIN orders o ON o.id = i.order_id
               WHERE o.data_source = 'olist' AND (quantity <> 1 OR seller_id IS NULL OR source_item_sequence IS NULL)) THEN
    RAISE EXCEPTION 'Historical line/payment values or item grain were changed';
  END IF;
  IF (SELECT count(*) FROM orders WHERE data_source = 'olist' AND subtotal IS NULL AND total IS NULL) <> 775
    OR (SELECT count(*) FROM orders WHERE data_source = 'olist' AND payment_total IS NULL) <> 1
    OR (SELECT count(*) FROM orders WHERE data_source = 'olist' AND customer_email IS NOT NULL) <> 0
    OR (SELECT count(*) FROM orders WHERE data_source = 'olist' AND total IS NOT NULL AND payment_total IS NOT NULL AND total <> payment_total) <> 576
    OR EXISTS (SELECT 1 FROM orders WHERE data_source = 'olist'
               AND (customer_name <> customer_id OR created_at <> purchased_at AT TIME ZONE 'UTC'
                 OR total IS DISTINCT FROM subtotal + shipping_total)) THEN
    RAISE EXCEPTION 'Order identity, nulls, dates or financial reconciliation is invalid';
  END IF;
  IF (SELECT count(*) FROM orders WHERE data_source = 'olist' AND status = 'delivered') <> 96478
    OR (SELECT count(*) FROM orders WHERE data_source = 'olist' AND status = 'canceled') <> 625
    OR (SELECT min(purchased_at) FROM orders WHERE data_source = 'olist') <> TIMESTAMP '2016-09-04 21:15:19'
    OR (SELECT max(purchased_at) FROM orders WHERE data_source = 'olist') <> TIMESTAMP '2018-10-17 17:30:18' THEN
    RAISE EXCEPTION 'Original statuses or purchase dates were changed';
  END IF;
  IF (SELECT count(*) FROM (SELECT order_id FROM order_payments GROUP BY order_id HAVING count(*) > 1) p) <> 2961
    OR (SELECT count(*) FROM (SELECT order_id FROM order_reviews GROUP BY order_id HAVING count(*) > 1) r) <> 547
    OR (SELECT count(*) FROM (SELECT source_review_id FROM order_reviews GROUP BY source_review_id HAVING count(DISTINCT order_id) > 1) r) <> 789
    OR (SELECT count(*) FROM order_reviews WHERE comment_message IS NOT NULL) <> 40977 THEN
    RAISE EXCEPTION 'Payments/reviews were incorrectly collapsed or text was lost';
  END IF;
  IF (SELECT count(*) FROM products WHERE data_source = 'olist' AND source_name_length IS NULL) <> 610
    OR (SELECT count(*) FROM products WHERE data_source = 'olist' AND weight_g IS NULL) <> 2
    OR (SELECT count(*) FROM customer_snapshots c WHERE NOT EXISTS
         (SELECT 1 FROM geolocations g WHERE g.zip_code_prefix = c.zip_code_prefix)) <> 278
    OR (SELECT count(DISTINCT zip_code_prefix) FROM geolocations) <> 19015 THEN
    RAISE EXCEPTION 'Optional source attributes or ZIP-prefix normalization is invalid';
  END IF;

  -- The original native demo remains intact; imported orders do not consume stock.
  IF (SELECT count(*) FROM products WHERE data_source = 'signal_shop') <> 9
    OR (SELECT count(*) FROM orders WHERE data_source = 'signal_shop') <> 3
    OR (SELECT stock FROM products WHERE slug = 'nova-x1-smartphone') <> 24
    OR (SELECT price FROM products WHERE slug = 'nova-x1-smartphone') <> 799.00 THEN
    RAISE EXCEPTION 'Original demo records were overwritten';
  END IF;

  SELECT order_id, source_review_id INTO imported_order, existing_review FROM order_reviews ORDER BY id LIMIT 1;
  SELECT id INTO imported_product FROM products WHERE data_source = 'olist' ORDER BY id LIMIT 1;

  -- Repeated review IDs are legal across orders, but duplicates on one order are not.
  BEGIN
    INSERT INTO order_reviews (order_id, source_review_id, score, review_created_at, answered_at)
    VALUES (imported_order, existing_review, 5, now(), now());
    RAISE EXCEPTION 'Duplicate review association was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO order_reviews (order_id, source_review_id, score, review_created_at, answered_at)
    VALUES (imported_order, repeat('x', 32), 0, now(), now());
    RAISE EXCEPTION 'Invalid review score was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, freight_value)
    VALUES (imported_order, imported_product, 'Invalid freight fixture', 1, 1, -1);
    RAISE EXCEPTION 'Negative freight was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Original native insert shapes remain valid without new sellers/customer FKs.
  INSERT INTO products (category_id, name, slug, description, price, stock)
  SELECT id, 'Native compatibility fixture', 'native-compatibility-fixture', 'Fixture', 10, 20
  FROM categories WHERE slug = 'phones' RETURNING id INTO native_product;
  INSERT INTO orders (customer_name, customer_email, subtotal, total, status)
  VALUES ('Native customer', 'native-fixture@example.com', 20, 20, 'paid') RETURNING id INTO native_order;
  INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
  VALUES (native_order, native_product, 'Native compatibility fixture', 2, 10);
  UPDATE products SET stock = stock - 2 WHERE id = native_product AND stock >= 2;
  IF (SELECT stock FROM products WHERE id = native_product) <> 18
    OR (SELECT data_source FROM orders WHERE id = native_order) <> 'signal_shop'
    OR (SELECT currency FROM orders WHERE id = native_order) <> 'USD' THEN
    RAISE EXCEPTION 'Native checkout compatibility fixture failed';
  END IF;
END $$;

ROLLBACK;
