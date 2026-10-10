-- Import the committed Olist snapshot once, transactionally, without checkout side effects.
-- PostgreSQL receives ./dataset read-only at /olist-data through docker-compose.yml.
-- Catalog seed: olist-catalog-v1. Synthetic copy/price/stock/rating are not source facts.
-- Source timestamps remain TIMESTAMP. Only legacy created_at assumes UTC for display.
-- Currency assumption: historical Olist values are BRL; no exchange-rate conversion.

CREATE TEMP TABLE olist_customers (
  customer_id VARCHAR(32) PRIMARY KEY, customer_unique_id VARCHAR(32) NOT NULL,
  customer_zip_code_prefix VARCHAR(5) NOT NULL, customer_city TEXT NOT NULL,
  customer_state VARCHAR(2) NOT NULL
) ON COMMIT DROP;
COPY olist_customers FROM '/olist-data/olist_customers_dataset.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

CREATE TEMP TABLE olist_sellers (
  seller_id VARCHAR(32) PRIMARY KEY, seller_zip_code_prefix VARCHAR(5) NOT NULL,
  seller_city TEXT NOT NULL, seller_state VARCHAR(2) NOT NULL
) ON COMMIT DROP;
COPY olist_sellers FROM '/olist-data/olist_sellers_dataset.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

CREATE TEMP TABLE olist_products (
  product_id VARCHAR(32) PRIMARY KEY, product_category_name VARCHAR(80),
  product_name_lenght INTEGER, product_description_lenght INTEGER,
  product_photos_qty INTEGER, product_weight_g INTEGER, product_length_cm INTEGER,
  product_height_cm INTEGER, product_width_cm INTEGER
) ON COMMIT DROP;
COPY olist_products FROM '/olist-data/olist_products_dataset.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

CREATE TEMP TABLE olist_translations (
  product_category_name VARCHAR(80) PRIMARY KEY, product_category_name_english VARCHAR(80) NOT NULL
) ON COMMIT DROP;
COPY olist_translations FROM '/olist-data/product_category_name_translation.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

CREATE TEMP TABLE olist_orders (
  order_id VARCHAR(32) PRIMARY KEY, customer_id VARCHAR(32) NOT NULL REFERENCES olist_customers(customer_id),
  order_status VARCHAR(30) NOT NULL, order_purchase_timestamp TIMESTAMP NOT NULL,
  order_approved_at TIMESTAMP, order_delivered_carrier_date TIMESTAMP,
  order_delivered_customer_date TIMESTAMP, order_estimated_delivery_date TIMESTAMP NOT NULL
) ON COMMIT DROP;
COPY olist_orders FROM '/olist-data/olist_orders_dataset.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

CREATE TEMP TABLE olist_items (
  order_id VARCHAR(32) NOT NULL REFERENCES olist_orders(order_id), order_item_id INTEGER NOT NULL,
  product_id VARCHAR(32) NOT NULL REFERENCES olist_products(product_id),
  seller_id VARCHAR(32) NOT NULL REFERENCES olist_sellers(seller_id),
  shipping_limit_date TIMESTAMP NOT NULL, price NUMERIC(12,2) NOT NULL,
  freight_value NUMERIC(12,2) NOT NULL, PRIMARY KEY (order_id, order_item_id)
) ON COMMIT DROP;
COPY olist_items FROM '/olist-data/olist_order_items_dataset.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

CREATE TEMP TABLE olist_payments (
  order_id VARCHAR(32) NOT NULL REFERENCES olist_orders(order_id), payment_sequential INTEGER NOT NULL,
  payment_type VARCHAR(30) NOT NULL, payment_installments INTEGER NOT NULL,
  payment_value NUMERIC(12,2) NOT NULL, PRIMARY KEY (order_id, payment_sequential)
) ON COMMIT DROP;
COPY olist_payments FROM '/olist-data/olist_order_payments_dataset.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

CREATE TEMP TABLE olist_reviews (
  review_id VARCHAR(32) NOT NULL, order_id VARCHAR(32) NOT NULL REFERENCES olist_orders(order_id),
  review_score INTEGER NOT NULL, review_comment_title TEXT, review_comment_message TEXT,
  review_creation_date TIMESTAMP NOT NULL, review_answer_timestamp TIMESTAMP NOT NULL,
  PRIMARY KEY (order_id, review_id)
) ON COMMIT DROP;
COPY olist_reviews FROM '/olist-data/olist_order_reviews_dataset.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

CREATE TEMP TABLE olist_geolocations (
  source_row INTEGER GENERATED ALWAYS AS IDENTITY, geolocation_zip_code_prefix VARCHAR(5) NOT NULL,
  geolocation_lat DOUBLE PRECISION NOT NULL, geolocation_lng DOUBLE PRECISION NOT NULL,
  geolocation_city TEXT NOT NULL, geolocation_state VARCHAR(2) NOT NULL
) ON COMMIT DROP;
COPY olist_geolocations (geolocation_zip_code_prefix, geolocation_lat, geolocation_lng, geolocation_city, geolocation_state)
FROM '/olist-data/olist_geolocation_dataset.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- Fail on an incomplete/replaced snapshot instead of marking a partial import successful.
DO $$
BEGIN
  IF (SELECT count(*) FROM olist_customers) <> 99441
    OR (SELECT count(*) FROM olist_sellers) <> 3095
    OR (SELECT count(*) FROM olist_products) <> 32951
    OR (SELECT count(*) FROM olist_translations) <> 71
    OR (SELECT count(*) FROM olist_orders) <> 99441
    OR (SELECT count(*) FROM olist_items) <> 112650
    OR (SELECT count(*) FROM olist_payments) <> 103886
    OR (SELECT count(*) FROM olist_reviews) <> 99224
    OR (SELECT count(*) FROM olist_geolocations) <> 1000163 THEN
    RAISE EXCEPTION 'Olist CSV snapshot differs from the expected local dataset; review a new import migration';
  END IF;
END $$;

CREATE INDEX ON olist_items(product_id);
CREATE INDEX ON olist_items(order_id);
CREATE INDEX ON olist_payments(order_id);
ANALYZE olist_products;
ANALYZE olist_items;
ANALYZE olist_orders;
ANALYZE olist_customers;
ANALYZE olist_payments;
ANALYZE olist_reviews;

INSERT INTO customers (id, name)
SELECT DISTINCT customer_unique_id, customer_unique_id FROM olist_customers
ORDER BY customer_unique_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer_snapshots (id, customer_id, zip_code_prefix, city, state)
SELECT customer_id, customer_unique_id, lpad(customer_zip_code_prefix, 5, '0'), customer_city, customer_state
FROM olist_customers ORDER BY customer_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO sellers (id, zip_code_prefix, city, state)
SELECT seller_id, lpad(seller_zip_code_prefix, 5, '0'), seller_city, seller_state
FROM olist_sellers ORDER BY seller_id
ON CONFLICT (id) DO NOTHING;

-- Extend the existing category entity; retain all 73 categories plus an unknown bucket.
-- Existing demo names/slugs remain intact. Olist slugs always use their own prefix.
WITH source_categories AS (
  SELECT DISTINCT coalesce(product_category_name, '__unknown__') AS code FROM olist_products
  UNION SELECT product_category_name FROM olist_translations
), labels AS (
  SELECT s.code,
    CASE WHEN s.code = '__unknown__' THEN 'Uncategorized'
         WHEN s.code = 'pc_gamer' THEN 'Gaming Computers'
         WHEN s.code = 'portateis_cozinha_e_preparadores_de_alimentos' THEN 'Kitchen And Food Preparation Appliances'
         ELSE initcap(replace(coalesce(t.product_category_name_english, s.code), '_', ' ')) END AS label
  FROM source_categories s LEFT JOIN olist_translations t ON t.product_category_name = s.code
)
INSERT INTO categories (name, slug, data_source, source_category_name)
SELECT CASE WHEN EXISTS (SELECT 1 FROM categories c WHERE c.name = l.label)
            THEN l.label || ' (Olist)' ELSE l.label END,
       'olist-' || replace(l.code, '_', '-'), 'olist', l.code
FROM labels l ORDER BY l.code
ON CONFLICT (data_source, source_category_name) DO NOTHING;

INSERT INTO category_translations (category_id, portuguese_name, english_name)
SELECT c.id, t.product_category_name, t.product_category_name_english
FROM olist_translations t
JOIN categories c ON c.data_source = 'olist' AND c.source_category_name = t.product_category_name
ORDER BY t.product_category_name
ON CONFLICT (category_id) DO NOTHING;

CREATE TEMP TABLE olist_catalog_templates (
  category_code VARCHAR(80) PRIMARY KEY, nouns TEXT[] NOT NULL, use_context TEXT NOT NULL
) ON COMMIT DROP;
INSERT INTO olist_catalog_templates (category_code, nouns, use_context) VALUES
  ('__unknown__', ARRAY['Everyday Product','Utility Accessory','General Collection Item'], 'everyday use'),
  ('agro_industria_e_comercio', ARRAY['Farm Tool Kit','Agricultural Accessory Set','Work Supply Collection'], 'agricultural and trade tasks'),
  ('alimentos', ARRAY['Pantry Selection','Snack Collection','Food Gift Set'], 'pantry selections'),
  ('alimentos_bebidas', ARRAY['Snack Selection','Pantry Gift Set','Food and Drink Collection'], 'pantry and refreshment selections'),
  ('artes', ARRAY['Art Print','Decorative Artwork','Art Display Set'], 'creative home displays'),
  ('artes_e_artesanato', ARRAY['Craft Supply Kit','Painting Accessory Set','Handcraft Collection'], 'arts and crafts projects'),
  ('artigos_de_festas', ARRAY['Party Decoration Kit','Celebration Table Set','Party Favor Collection'], 'celebrations'),
  ('artigos_de_natal', ARRAY['Holiday Decoration Set','Festive Ornament Collection','Christmas Table Kit'], 'seasonal celebrations'),
  ('audio', ARRAY['Headphones','Portable Speaker','Audio Accessory Kit'], 'listening and audio setups'),
  ('automotivo', ARRAY['Car Care Kit','Vehicle Organizer','Seat Accessory Set'], 'vehicle care and organization'),
  ('bebes', ARRAY['Baby Blanket','Nursery Organizer','Baby Care Set'], 'nursery and baby-care routines'),
  ('bebidas', ARRAY['Beverage Selection','Refreshment Collection','Drink Gift Set'], 'refreshment selections'),
  ('beleza_saude', ARRAY['Face Care Kit','Hair Care Set','Grooming Kit'], 'personal care routines'),
  ('brinquedos', ARRAY['Building Blocks','Puzzle Set','Play Activity Kit'], 'creative play'),
  ('cama_mesa_banho', ARRAY['Cotton Sheet Set','Bath Towel Set','Table Linen Set'], 'bed, bath and dining essentials'),
  ('casa_conforto', ARRAY['Throw Blanket','Comfort Cushion','Home Textile Set'], 'comfortable living spaces'),
  ('casa_conforto_2', ARRAY['Home Comfort Set','Soft Throw','Living Space Textile Kit'], 'comfortable home collections'),
  ('casa_construcao', ARRAY['Home Repair Kit','Building Accessory Set','Renovation Supply Kit'], 'home improvement projects'),
  ('cds_dvds_musicais', ARRAY['Music CD Collection','Concert DVD','Album Disc Set'], 'physical music collections'),
  ('cine_foto', ARRAY['Camera Accessory Kit','Photo Stand','Photography Bag'], 'photography and video setups'),
  ('climatizacao', ARRAY['Desk Fan','Cooling Accessory Kit','Ventilation Unit'], 'indoor comfort'),
  ('consoles_games', ARRAY['Game Controller','Gaming Accessory Kit','Console Stand'], 'gaming setups'),
  ('construcao_ferramentas_construcao', ARRAY['Measuring Kit','Hand Tool Set','Construction Accessory Kit'], 'building and repair projects'),
  ('construcao_ferramentas_ferramentas', ARRAY['Screwdriver Set','Socket Kit','Workshop Tool Set'], 'workshop projects'),
  ('construcao_ferramentas_iluminacao', ARRAY['Work Light','Lighting Accessory Kit','Utility Lamp'], 'lighting projects'),
  ('construcao_ferramentas_jardim', ARRAY['Garden Maintenance Kit','Planting Tool Set','Outdoor Tool Kit'], 'outdoor maintenance projects'),
  ('construcao_ferramentas_seguranca', ARRAY['Safety Accessory Kit','Protective Equipment Set','Work Safety Kit'], 'workplace safety collections'),
  ('cool_stuff', ARRAY['Desk Gadget','Creative Gift Kit','Lifestyle Accessory Set'], 'creative everyday use'),
  ('dvds_blu_ray', ARRAY['Film Disc Collection','Blu-Ray Selection','DVD Gift Set'], 'home film collections'),
  ('eletrodomesticos', ARRAY['Kitchen Appliance','Cleaning Appliance','Home Appliance Set'], 'household routines'),
  ('eletrodomesticos_2', ARRAY['Home Appliance','Laundry Accessory Unit','Kitchen Appliance Kit'], 'home appliance collections'),
  ('eletronicos', ARRAY['Electronic Accessory Kit','Digital Adapter','Desktop Gadget'], 'everyday electronic setups'),
  ('eletroportateis', ARRAY['Compact Blender','Handheld Mixer','Electric Kettle'], 'small kitchen tasks'),
  ('esporte_lazer', ARRAY['Exercise Mat','Sports Bag','Training Accessory Kit'], 'fitness and leisure activities'),
  ('fashion_bolsas_e_acessorios', ARRAY['Shoulder Bag','Wallet Set','Fashion Accessory Kit'], 'everyday accessorizing'),
  ('fashion_calcados', ARRAY['Casual Shoes','Walking Shoes','Sandal Pair'], 'everyday footwear'),
  ('fashion_esporte', ARRAY['Training Shirt','Sports Shorts','Activewear Set'], 'active clothing collections'),
  ('fashion_roupa_feminina', ARRAY['Casual Blouse','Everyday Dress','Clothing Collection'], 'everyday clothing collections'),
  ('fashion_roupa_infanto_juvenil', ARRAY['Junior Clothing Set','Kids T-Shirt','Youth Casual Outfit'], 'junior clothing collections'),
  ('fashion_roupa_masculina', ARRAY['Casual Shirt','Cotton T-Shirt','Everyday Shorts'], 'casual clothing collections'),
  ('fashion_underwear_e_moda_praia', ARRAY['Beachwear Set','Swimwear Collection','Everyday Underwear Set'], 'beach and clothing collections'),
  ('ferramentas_jardim', ARRAY['Garden Tool Set','Watering Kit','Pruning Kit'], 'garden care'),
  ('flores', ARRAY['Flower Arrangement','Decorative Bouquet','Floral Gift Set'], 'floral displays and gifting'),
  ('fraldas_higiene', ARRAY['Hygiene Care Kit','Diaper Collection','Personal Care Supply Set'], 'hygiene routines'),
  ('industria_comercio_e_negocios', ARRAY['Workplace Supply Kit','Commercial Storage Set','Business Accessory Kit'], 'workplace organization'),
  ('informatica_acessorios', ARRAY['Keyboard Set','Laptop Stand','USB Hub'], 'a practical computer workspace'),
  ('instrumentos_musicais', ARRAY['Instrument Accessory Kit','Practice Instrument','Music Stand'], 'music practice'),
  ('la_cuisine', ARRAY['Cookware Set','Kitchen Utensil Kit','Dining Preparation Set'], 'cooking and dining routines'),
  ('livros_importados', ARRAY['Imported Book','International Reading Collection','Imported Reference Guide'], 'international reading selections'),
  ('livros_interesse_geral', ARRAY['Reading Collection','General Interest Book','Everyday Reader'], 'leisure reading'),
  ('livros_tecnicos', ARRAY['Technical Handbook','Study Reference Book','Practical Guide'], 'technical reading and study'),
  ('malas_acessorios', ARRAY['Travel Bag','Luggage Organizer','Suitcase Accessory Set'], 'travel organization'),
  ('market_place', ARRAY['Everyday Accessory Kit','Storage Set','Gift Selection'], 'general household collections'),
  ('moveis_colchao_e_estofado', ARRAY['Mattress','Upholstered Seat','Seat Cushion Set'], 'rest and seating spaces'),
  ('moveis_cozinha_area_de_servico_jantar_e_jardim', ARRAY['Dining Chair','Kitchen Shelf','Garden Side Table'], 'kitchen, dining and garden spaces'),
  ('moveis_decoracao', ARRAY['Decorative Shelf','Accent Table','Decor Cushion Set'], 'comfortable home styling'),
  ('moveis_escritorio', ARRAY['Office Chair','Work Desk','Office Storage Shelf'], 'office spaces'),
  ('moveis_quarto', ARRAY['Bedside Table','Bedroom Shelf','Bedroom Storage Unit'], 'bedroom spaces'),
  ('moveis_sala', ARRAY['Living Room Shelf','Coffee Table','Accent Chair'], 'living room spaces'),
  ('musica', ARRAY['Music Collection','Album Selection','Listening Gift Set'], 'music collections'),
  ('papelaria', ARRAY['Notebook Set','Desk Organizer','Writing Kit'], 'study and desk organization'),
  ('pc_gamer', ARRAY['Gaming PC','Gaming Desktop','Gaming Computer Set'], 'computer gaming setups'),
  ('pcs', ARRAY['Desktop Computer','Compact PC','Computer Workstation'], 'computing workspaces'),
  ('perfumaria', ARRAY['Fragrance Set','Body Mist','Perfume Collection'], 'daily fragrance routines'),
  ('pet_shop', ARRAY['Pet Bed','Pet Toy Set','Feeding Accessory Kit'], 'pet-care routines'),
  ('portateis_casa_forno_e_cafe', ARRAY['Coffee Maker','Compact Oven','Breakfast Appliance Set'], 'home coffee and cooking routines'),
  ('portateis_cozinha_e_preparadores_de_alimentos', ARRAY['Food Processor','Compact Kitchen Appliance','Food Preparation Kit'], 'food preparation routines'),
  ('relogios_presentes', ARRAY['Wristwatch','Gift Collection','Watch Gift Set'], 'accessorizing and thoughtful gifting'),
  ('seguros_e_servicos', ARRAY['Service Package','Support Service Plan','Care Service Collection'], 'service selections'),
  ('sinalizacao_e_seguranca', ARRAY['Signage Kit','Reflective Marker Set','Safety Sign Collection'], 'clear signage and organization'),
  ('tablets_impressao_imagem', ARRAY['Tablet Stand','Printer Accessory Kit','Image Print Set'], 'tablet and print workspaces'),
  ('telefonia', ARRAY['Mobile Phone','Phone Accessory Kit','Charging Dock'], 'everyday mobile communication'),
  ('telefonia_fixa', ARRAY['Desk Phone','Cordless Phone','Telephone Accessory Kit'], 'home and office communication'),
  ('utilidades_domesticas', ARRAY['Storage Container Set','Kitchen Organizer','Cleaning Accessory Kit'], 'everyday household tasks');

-- Hash-based draws are stable regardless of SELECT order, session state or reruns.
CREATE FUNCTION pg_temp.catalog_draw(product_id TEXT, field_name TEXT, choices INTEGER)
RETURNS INTEGER LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT ((('x' || substr(md5('olist-catalog-v1:' || product_id || ':' || field_name), 1, 8))::bit(32)::bigint) % choices)::integer
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM olist_products p
             LEFT JOIN olist_catalog_templates t ON t.category_code = coalesce(p.product_category_name, '__unknown__')
             WHERE t.category_code IS NULL) THEN
    RAISE EXCEPTION 'Missing synthetic catalog template for an Olist category';
  END IF;
END $$;

WITH product_prices AS (
  SELECT product_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_price
  FROM olist_items GROUP BY product_id
), category_prices AS (
  SELECT coalesce(p.product_category_name, '__unknown__') AS code,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY i.price)::numeric AS median_price
  FROM olist_items i JOIN olist_products p ON p.product_id = i.product_id
  GROUP BY coalesce(p.product_category_name, '__unknown__')
), catalog AS (
  SELECT p.*, c.id AS category_id, c.name AS category_label, t.use_context,
    t.nouns[1 + pg_temp.catalog_draw(p.product_id, 'noun', array_length(t.nouns, 1))] AS noun,
    (ARRAY['Classic','Everyday','Essential','Modern','Signature','Versatile'])[1 + pg_temp.catalog_draw(p.product_id, 'style', 6)] AS style,
    (ARRAY['Nova','Atlas','Luma','Forma','Viva','Terra'])[1 + pg_temp.catalog_draw(p.product_id, 'brand', 6)] AS brand,
    coalesce(pp.median_price, cp.median_price, 50::numeric) AS reference_price
  FROM olist_products p
  JOIN categories c ON c.data_source = 'olist' AND c.source_category_name = coalesce(p.product_category_name, '__unknown__')
  JOIN olist_catalog_templates t ON t.category_code = coalesce(p.product_category_name, '__unknown__')
  LEFT JOIN product_prices pp ON pp.product_id = p.product_id
  LEFT JOIN category_prices cp ON cp.code = coalesce(p.product_category_name, '__unknown__')
)
INSERT INTO products (
  category_id, name, slug, description, price, currency, stock, accent, featured, active, rating, tags,
  data_source, source_id, synthetic_catalog, catalog_seed, source_name_length,
  source_description_length, photos_quantity, weight_g, length_cm, height_cm, width_cm
)
SELECT category_id, brand || ' ' || style || ' ' || noun || ' ' || substr(product_id, 1, 8),
  'olist-' || product_id,
  'A ' || lower(style) || ' ' || lower(noun) || ', selected for ' || use_context || '. '
    || 'A practical addition to the ' || category_label || ' collection, with a straightforward everyday design.',
  greatest(0.01::numeric, round(reference_price * (0.90::numeric + pg_temp.catalog_draw(product_id, 'price', 1001)::numeric * 0.0002), 2)),
  'BRL', 5 + pg_temp.catalog_draw(product_id, 'stock', 196),
  (ARRAY['#E9562A','#1D4ED8','#7C3AED','#DB2777','#0891B2','#EA580C','#475569','#16A34A'])[1 + pg_temp.catalog_draw(product_id, 'accent', 8)],
  false, true, (3.5::numeric + pg_temp.catalog_draw(product_id, 'rating', 16)::numeric / 10),
  ARRAY[lower(noun), lower(style), replace(coalesce(product_category_name, 'uncategorized'), '_', ' ')],
  'olist', product_id, true, 'olist-catalog-v1', product_name_lenght, product_description_lenght,
  product_photos_qty, product_weight_g, product_length_cm, product_height_cm, product_width_cm
FROM catalog ORDER BY product_id
ON CONFLICT (data_source, source_id) DO NOTHING;

-- Aggregate child tables independently: payment multiplicity must not inflate item totals.
WITH item_totals AS (
  SELECT order_id, sum(price) AS subtotal, sum(freight_value) AS shipping_total
  FROM olist_items GROUP BY order_id
), payment_totals AS (
  SELECT order_id, sum(payment_value) AS payment_total FROM olist_payments GROUP BY order_id
)
INSERT INTO orders (
  order_number, customer_name, customer_email, subtotal, total, status, created_at,
  data_source, source_id, customer_id, customer_snapshot_id, currency, shipping_total,
  payment_total, purchased_at, approved_at, delivered_carrier_at, delivered_customer_at, estimated_delivery_at
)
SELECT 'OLIST-' || o.order_id, c.customer_unique_id, NULL, it.subtotal, it.subtotal + it.shipping_total,
  o.order_status, o.order_purchase_timestamp AT TIME ZONE 'UTC',
  'olist', o.order_id, c.customer_unique_id, o.customer_id, 'BRL', it.shipping_total, pt.payment_total,
  o.order_purchase_timestamp, o.order_approved_at, o.order_delivered_carrier_date,
  o.order_delivered_customer_date, o.order_estimated_delivery_date
FROM olist_orders o JOIN olist_customers c ON c.customer_id = o.customer_id
LEFT JOIN item_totals it ON it.order_id = o.order_id
LEFT JOIN payment_totals pt ON pt.order_id = o.order_id
ORDER BY o.order_id
ON CONFLICT (data_source, source_id) DO NOTHING;

INSERT INTO order_items (
  order_id, product_id, product_name, quantity, unit_price,
  source_item_sequence, seller_id, freight_value, shipping_limit_at
)
SELECT o.id, p.id, p.name, 1, i.price, i.order_item_id, i.seller_id, i.freight_value, i.shipping_limit_date
FROM olist_items i
JOIN orders o ON o.data_source = 'olist' AND o.source_id = i.order_id
JOIN products p ON p.data_source = 'olist' AND p.source_id = i.product_id
ORDER BY i.order_id, i.order_item_id
ON CONFLICT (order_id, source_item_sequence) DO NOTHING;

INSERT INTO order_payments (order_id, sequence, type, installments, value)
SELECT o.id, p.payment_sequential, p.payment_type, p.payment_installments, p.payment_value
FROM olist_payments p JOIN orders o ON o.data_source = 'olist' AND o.source_id = p.order_id
ORDER BY p.order_id, p.payment_sequential
ON CONFLICT (order_id, sequence) DO NOTHING;

INSERT INTO order_reviews (
  order_id, source_review_id, score, comment_title, comment_message, review_created_at, answered_at
)
SELECT o.id, r.review_id, r.review_score, r.review_comment_title, r.review_comment_message,
  r.review_creation_date, r.review_answer_timestamp
FROM olist_reviews r JOIN orders o ON o.data_source = 'olist' AND o.source_id = r.order_id
ORDER BY r.order_id, r.review_id
ON CONFLICT (order_id, source_review_id) DO NOTHING;

-- Preserve every observation, including exact duplicates; never collapse to a ZIP PK.
INSERT INTO geolocations (source_row, zip_code_prefix, latitude, longitude, city, state)
SELECT source_row, lpad(geolocation_zip_code_prefix, 5, '0'), geolocation_lat, geolocation_lng,
  geolocation_city, geolocation_state
FROM olist_geolocations ORDER BY source_row
ON CONFLICT (source_row) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM categories WHERE data_source = 'olist') <> 74
    OR (SELECT count(*) FROM category_translations) <> 71
    OR (SELECT count(*) FROM customers) <> 96096
    OR (SELECT count(*) FROM customer_snapshots) <> 99441
    OR (SELECT count(*) FROM sellers) <> 3095
    OR (SELECT count(*) FROM products WHERE data_source = 'olist') <> 32951
    OR (SELECT count(*) FROM orders WHERE data_source = 'olist') <> 99441
    OR (SELECT count(*) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.data_source = 'olist') <> 112650
    OR (SELECT count(*) FROM order_payments p JOIN orders o ON o.id = p.order_id WHERE o.data_source = 'olist') <> 103886
    OR (SELECT count(*) FROM order_reviews r JOIN orders o ON o.id = r.order_id WHERE o.data_source = 'olist') <> 99224
    OR (SELECT count(*) FROM geolocations) <> 1000163 THEN
    RAISE EXCEPTION 'Olist import reconciliation failed; transaction will roll back';
  END IF;
END $$;

DROP FUNCTION pg_temp.catalog_draw(TEXT, TEXT, INTEGER);
ANALYZE categories;
ANALYZE products;
ANALYZE customers;
ANALYZE customer_snapshots;
ANALYZE sellers;
ANALYZE orders;
ANALYZE order_items;
ANALYZE order_payments;
ANALYZE order_reviews;
ANALYZE geolocations;
