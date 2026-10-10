# Olist models and import migrations

This implements the agreed data layer only: Prisma entities, additive Flyway migrations, CSV import, and generated demo catalog data. No new API routes, services, application features, or frontend views are added. V1–V3 and the original demo records are retained.

## Entities

The existing category table is extended rather than replaced with a second catalog taxonomy. Import creates 73 named Olist categories plus an uncategorized bucket, with 71 original category-translation records. The two missing translations receive curated English display labels, while their original Portuguese category codes remain available.

`Customer` has just two stored fields: `id` and `name`. Both use Olist's persistent `customer_unique_id`. Prisma relationship fields are navigation properties, not extra columns. `CustomerSnapshot` preserves each order-specific source `customer_id`, its persistent-customer FK, ZIP prefix, city, and state. This imports 96,096 customers and 99,441 snapshots without losing repeat-customer identity or historical locations.

Other new entities are `Seller`, `OrderPayment`, `OrderReview`, `Geolocation`, and `CategoryTranslation`. Product, order, and order-item models receive the source fields and relationships needed to represent all nine CSVs. Geolocation retains all observations, including duplicates; ZIP prefixes are indexed but not unique or mandatory foreign keys.

## Generated product catalog

There is one product per original `product_id`, for all 32,951 products. Internal numeric product IDs and the existing storefront product shape are retained.

Generated catalog fields use **English** and seed **`olist-catalog-v1`**. Hash-based draws depend on source product ID and field name, so generation is stable across runs and independent of row ordering:

- Each category has three appropriate product templates and a use context. Brand/style/template draws produce names and descriptions; slugs include the complete source ID.
- Price starts with that product's median historical unit price and varies by up to **10%**, rounded to cents. Category median and then 50 are fallback references if future source products have no price observations.
- Stock is a simulated integer from 5–200; rating is simulated from 3.5–5.0. Accent and tags are generated; imported products are active but not featured by default.
- No image URL is fabricated. Photo count, name/description lengths, weight and dimensions remain their original nullable numeric attributes.

`synthetic_catalog = true` and `catalog_seed` identify generated copy, price, stock, rating, tags and accent. These are demonstration values, not recovered Olist facts. Product rating is not calculated from order reviews. Synthetic copy should not be presented as an authentic product-text corpus in the course report.

## Historical records

Original orders, purchased-unit lines, payments and reviews are imported independently of checkout. Import never decrements catalog stock or reprices historical items.

- Customer display name equals the persistent customer ID. Imported customer email is null.
- One source item row becomes quantity 1, retaining its sequence, seller, original unit price, freight and shipping deadline.
- Order subtotal is the sum of original unit prices; shipping total is the sum of freight; total is their sum. Payment total is independent. All 576 observed payment discrepancies remain available.
- The 775 itemless orders retain null merchandise/shipping/total values. The one order without payments retains null payment total.
- Review IDs may recur across orders. Only `(order_id, source_review_id)` is unique; multiple reviews on an order are retained.
- Source statuses, including `canceled`, are retained exactly.
- Original source dates are `TIMESTAMP` fields with no timezone. The legacy `created_at` display field treats source purchase time as UTC explicitly; that is an import convention, not verified source timezone metadata.
- Imported product/order currency is `BRL`, an explicit assumption for this Brazilian dataset; native/demo currency defaults to `USD`, matching the existing demo price convention. There is no currency conversion.

## Migration files

- `V4__expand_olist_data_model.sql`: adds entities/relationships, source provenance, product attributes, lifecycle dates and appropriate keys/checks/indexes. It makes imported email and missing merchandise totals nullable while preserving existing native insert shapes.
- `V5__import_olist_dataset.sql`: reads the nine CSVs into transaction-local typed staging tables, checks expected counts and parent references, imports entities, generates catalog fields, and reconciles destination counts. Unique source keys make seed insertion repeatable without overwriting existing catalog edits. Flyway normally runs V5 once.

The database service mounts `./dataset` read-only at `/olist-data`. PostgreSQL's server-side `COPY` reads those paths; Flyway continues owning the migration sequence. The migration assumes the repository's current CSV snapshot and fails if counts differ. Dataset checksums are recorded in `OLIST_DATA_PROFILE.json`; changed snapshots need a reviewed new import migration rather than editing an already-applied V5.

**The import has not been applied to the existing development database.** When ready, recreate the database container configuration without removing its volume so it receives the new CSV mount, then apply pending migrations:

```bash
npm run db:start
npm run prisma:generate -w server
```

`db:start` brings the existing database service up with its configured mounts and runs Flyway. V5 imports approximately 1.55 million source rows; its first execution will take longer than the previous demo-only startup. Do not remove the database volume to apply these changes.

Prisma validation/generation commands need `DATABASE_URL` available in the environment when run from the server workspace. The root development configuration is already loaded by the application, but Prisma's CLI should not be assumed to load a parent-directory `.env` automatically.

## Validation and application scope

`server/db/tests/olist_import_assertions.sql` is a database integration check for the fixed source snapshot. It verifies entity counts, generated-field bounds, original amounts, statuses/dates, customer normalization, payment/review multiplicity, missing data, source-key constraints, and native insert compatibility. Its fixture writes are rolled back. Run it against an isolated database after V1–V5, not a development database with unrelated records.

With Docker running, `npm run db:test` creates a separate temporary PostgreSQL 16/Flyway test
project, executes V1–V5 and the assertions, and cleans up that project's containers afterward.
It publishes no ports and does not mount the development database volume.

During implementation, Docker's daemon was unavailable. All five migrations and all nine full
CSVs were instead exercised in an isolated PGlite PostgreSQL runtime, substituting its blob
input for server-side CSV file access. The import and assertion suite passed twice; replay
kept the same catalog digest and record counts. Prisma scalar columns/nullability matched the
migrated schema; Prisma validation/generation and the complete application build passed.
The Docker Compose configurations were validated, but the PostgreSQL 16/Flyway container
test itself remains to be run when Docker is available.

Existing catalog, checkout, analytics, and recommendation views are intentionally unchanged. They still use the original presentation assumptions: all-product loading, `$` formatting, email-based customer counts, the seven-day window, and `cancelled` filtering. The model/import preserves Olist facts; these screens are not yet an accurate historical marketplace dashboard. Frontend pagination, currency-aware display, historical analytics and new-entity screens remain separate future work.
