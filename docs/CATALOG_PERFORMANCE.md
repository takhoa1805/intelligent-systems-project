# Catalog performance with the Olist dataset

The development database contains 32,960 active products (32,951 Olist products plus the
original demo catalog). Previously both Shop and Admin downloaded the entire catalog and
rendered every product. Admin also fetched all order items and customer identities into
Node.js to calculate its dashboard. These costs caused slow navigation after the import.

## Changes

- Shop and Admin fetch and render 24 products at a time. Counts, category/search filters and
  price/rating sorting apply inside PostgreSQL to the complete active catalog.
- Both catalog APIs return `{ items, total, page, pageSize, totalPages }`. Defaults are page 1
  and 24 items, with a maximum page size of 60. Invalid pagination/filter inputs return 400.
  An empty result has zero total pages; out-of-range pages return an empty item list with
  the actual total. The UI offers a return to the first page.
- Sorts include deterministic product-ID tie breakers, preventing duplicate or missing
  products between adjacent pages when records are unchanged. Shop preserves search,
  category, sort and page in the URL. Admin preserves search, category and page; its default
  order is most recently updated, then created date, then ID (descending).
- Admin's overview and catalog load independently. Changing a catalog page/filter only
  requests the catalog. Saving/removing a product refreshes both the overview and current
  catalog page, plus the storefront's small shared product list. Errors have retry controls;
  superseded requests are cancelled so old responses cannot overwrite newer filters.
- Admin summary, customer count, daily revenue, category revenue and product performance
  are computed by parameterized Prisma SQL queries inside PostgreSQL. Only seven daily
  points, five categories, five top products and six recent orders reach the browser.
  Customer counts now use the persistent imported customer ID, with email as the fallback
  for original demo/checkouts; missing email no longer collapses imported customers into
  one identity. Money aggregates use PostgreSQL decimal arithmetic.
- Recommendation queries fetch at most twice the requested limit rather than sorting the
  whole catalog in Node.js. Same-category priority and existing placeholder scores remain.
- Admin/Recharts is loaded in a separate JavaScript chunk when opening Admin, reducing
  initial storefront JavaScript. V6/V7 add indexes for catalog sort orders, recommendations,
  Admin's updated-date order and recent orders. Prisma declares the same indexes.

## Measurements and verification

Measured locally against the imported PostgreSQL database on 2026-10-10:

| Request | Previous response | Current response | Current median time |
| --- | ---: | ---: | ---: |
| Shop catalog, default page | 20,176,608 bytes | 13,913 bytes | 11 ms |
| Admin catalog, default page | 20,176,608 bytes | 14,745 bytes | 9 ms |
| Admin overview | 5,895 bytes | 1,810 bytes | 92 ms |
| Recommendations, limit 4 | — | 1,970 bytes | 2 ms |

Current medians are five sequential local requests including response-body reading, with
warm database caches. Previous requests took approximately 0.70 seconds for either catalog
and 0.75 seconds for the overview (single samples). These are API measurements, not browser
render timings or a controlled hardware benchmark. The catalog now renders 24 rows/cards
rather than 32,960, and transfers approximately 99.93% fewer catalog bytes.

`npm run build` and Prisma schema validation/generation pass. V6 and V7 were successfully
applied to the running local database. Browser checks cover Shop and Admin pagination,
category/search filtering, sort/reset behavior, and opening an existing product's edit form.

Run the read-only integration suite with the seeded database and API running:

```bash
npm run test:catalog -w server
```

The six tests cover both endpoints' page limits, adjacent-page ordering/uniqueness, counts,
filters, invalid inputs, empty/out-of-range pages, recommendation priority, and Admin
aggregates. A row-based oracle in the test reconciles historical line-item values and
customer identities without adding that work back to the API. No products/orders are changed.
Set `CATALOG_TEST_URL` to target a different local API; its database must match `DATABASE_URL`.

## Existing reporting assumptions

This update improves performance; the dashboard still uses its original reporting rules:
summary and trend exclude only `cancelled`, while category/product totals include all order
items. It still combines source currencies and displays dollar labels, and week-change
percentages are demo values. The seven-day chart reflects the current date, so a dataset
from 2016–2018 has no recent historical sales. Currency/status/date-aware reporting remains
separate work. No seller, review, payment or geolocation application screens were added.
