INSERT INTO categories (name, slug) VALUES
  ('Phones', 'phones'),
  ('Audio', 'audio'),
  ('Power', 'power'),
  ('Accessories', 'accessories'),
  ('Smart Home', 'smart-home');

INSERT INTO products
  (category_id, name, slug, description, price, stock, accent, featured, rating, tags)
VALUES
  ((SELECT id FROM categories WHERE slug='phones'), 'Nova X1 Smartphone', 'nova-x1-smartphone', 'Flagship performance, vivid OLED display and an all-day intelligent battery.', 799.00, 24, '#E9562A', true, 4.9, ARRAY['phone','android','oled','5g']),
  ((SELECT id FROM categories WHERE slug='audio'), 'Pulse Pro Headphones', 'pulse-pro-headphones', 'Immersive wireless audio with adaptive noise cancellation and 40-hour battery.', 249.00, 38, '#1D4ED8', true, 4.8, ARRAY['headphones','wireless','noise cancelling']),
  ((SELECT id FROM categories WHERE slug='power'), 'Arc 65W GaN Charger', 'arc-65w-gan-charger', 'Pocket-sized fast charger with dual USB-C ports for phone and laptop.', 59.00, 76, '#7C3AED', true, 4.7, ARRAY['charger','usb-c','fast charging']),
  ((SELECT id FROM categories WHERE slug='accessories'), 'Halo MagSafe Case', 'halo-magsafe-case', 'Slim shock-resistant phone case with a strong magnetic alignment ring.', 39.00, 92, '#DB2777', false, 4.6, ARRAY['phone case','magsafe','protection']),
  ((SELECT id FROM categories WHERE slug='power'), 'Volt 20K Power Bank', 'volt-20k-power-bank', 'High-capacity power bank with a smart charge display and three ports.', 79.00, 51, '#0891B2', false, 4.7, ARRAY['battery','power bank','travel']),
  ((SELECT id FROM categories WHERE slug='audio'), 'Echo Mini Speaker', 'echo-mini-speaker', 'Portable room-filling sound in a water-resistant palm-sized body.', 89.00, 44, '#EA580C', true, 4.5, ARRAY['speaker','bluetooth','portable']),
  ((SELECT id FROM categories WHERE slug='accessories'), 'Weave USB-C Cable', 'weave-usb-c-cable', 'Durable braided 100W charging cable, tested for 30,000 bends.', 24.00, 120, '#475569', false, 4.8, ARRAY['cable','usb-c','charging']),
  ((SELECT id FROM categories WHERE slug='smart-home'), 'Beam Smart Light Bar', 'beam-smart-light-bar', 'Voice-ready ambient lighting with millions of colors and music sync.', 119.00, 33, '#16A34A', false, 4.4, ARRAY['light','smart home','rgb']),
  ((SELECT id FROM categories WHERE slug='accessories'), 'Orbit Wireless Pad', 'orbit-wireless-pad', 'A low-profile 15W wireless charger with temperature protection.', 45.00, 68, '#0F766E', false, 4.5, ARRAY['wireless charger','qi','desk']);

WITH new_order AS (
  INSERT INTO orders (order_number, customer_name, customer_email, subtotal, total, status, created_at)
  VALUES ('SS-A1B2C3','Alex Morgan','alex@example.com',858,858,'paid',NOW()-INTERVAL '2 days')
  RETURNING id
)
INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price)
SELECT new_order.id, products.id, products.name, 1, products.price
FROM new_order CROSS JOIN products
WHERE products.slug IN ('nova-x1-smartphone','arc-65w-gan-charger');

WITH new_order AS (
  INSERT INTO orders (order_number, customer_name, customer_email, subtotal, total, status, created_at)
  VALUES ('SS-D4E5F6','Mina Tran','mina@example.com',338,338,'paid',NOW()-INTERVAL '1 day')
  RETURNING id
)
INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price)
SELECT new_order.id, products.id, products.name, 1, products.price
FROM new_order CROSS JOIN products
WHERE products.slug IN ('pulse-pro-headphones','echo-mini-speaker');

WITH new_order AS (
  INSERT INTO orders (order_number, customer_name, customer_email, subtotal, total, status, created_at)
  VALUES ('SS-G7H8J9','Jamie Lee','jamie@example.com',118,118,'paid',NOW())
  RETURNING id
)
INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price)
SELECT new_order.id, products.id, products.name, 1, products.price
FROM new_order CROSS JOIN products
WHERE products.slug IN ('volt-20k-power-bank','halo-magsafe-case');
