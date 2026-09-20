# Signal Shop

Signal Shop is a full-stack digital electronics storefront built for the Intelligent Systems course lab. Customers can browse and search products, open detailed product pages, receive contextual recommendations, manage a persistent cart, and complete a demo checkout. Administrators can view sales analytics and create, edit, or soft-delete catalog products.

The project also prepares the data boundary for a hybrid recommender system. Purchases are stored as transaction baskets for Association Rule Mining (ARM), product text and tags are available for word embeddings, and interaction events are captured for later ranking/evaluation.

## Assignment alignment

The assignment requires two essays (minimum 1,000 words each), one lab containing a problem statement, documented dataset, source code and output explanation, four weekly learning journals, and analysis of results. This repository is the implementation foundation for a lab combining:

1. **Association Rule Mining** — learn frequently co-purchased items and generate explainable “bought together” candidates.
2. **Word Embeddings** — rank semantically similar products from names, descriptions, categories and tags.

The current `/api/recommendations` route is explicitly a placeholder. Replace its ranking query with the trained hybrid pipeline later; the React interface does not need to change.

## Stack

- React 19 + Vite
- Express 4 + strict TypeScript + Prisma ORM
- PostgreSQL 16 in Docker
- Recharts for admin analytics
- Plain CSS design system (responsive, no image assets required)

## Run locally

Requirements: Node.js 20+, npm, Docker Desktop (or Docker Engine with Compose).

```bash
cp .env.example .env
npm install
npm run db:start
npm run dev
```

Open:

- Storefront: http://localhost:5173
- Admin dashboard: http://localhost:5173/admin
- API health: http://localhost:4000/api/health

`npm run db:start` starts PostgreSQL, waits for it to become healthy, and applies every pending Flyway migration. To recreate the sample data from scratch, run `docker compose down -v` and then `npm run db:start` (this permanently removes the local database volume).

If the API is not running, the storefront automatically enters preview mode with a local mock catalog. Orders and added products are not persisted in preview mode.

## Useful scripts

```bash
npm run dev       # run API and web app together
npm run build     # production client build
npm run start     # API only
npm run db:start  # start PostgreSQL
npm run db:migrate # apply pending Flyway migrations
npm run db:info    # inspect Flyway migration status
npm run db:stop   # stop containers
```

## Backend structure

The API is organized by feature under `server/src/modules`. Each feature keeps HTTP controllers, business rules, and Prisma repositories separate. Shared configuration, error handling, and transaction helpers live outside the feature modules.

```text
server/
├── db/migrations/          # versioned Flyway SQL (V1, V2, ...)
├── prisma/schema.prisma    # ORM models mapped to the Flyway schema
└── src/
    ├── config/             # environment and PostgreSQL pool
    ├── middleware/         # HTTP error and 404 handling
    ├── modules/            # products, orders, events, admin, ...
    │   └── *.dto.ts        # validated request and stable response contracts
    ├── shared/             # reusable server utilities
    ├── app.js              # Express composition
    └── server.js           # process lifecycle
```

When schema or seed data changes, add a new migration; do not edit a migration that has already been applied. Examples: `V3__add_customer_profiles.sql` or `V4__seed_more_orders.sql`.

Flyway remains the only schema migration tool. After applying a migration that changes tables or columns, update `server/prisma/schema.prisma` and run `npm run prisma:generate -w server`. The application repositories use Prisma Client exclusively and contain no raw SQL.

The backend compiles with TypeScript `strict` mode. Zod validates untrusted request bodies and query parameters at runtime, DTO interfaces define service/controller contracts, and mappers keep Prisma-specific `Decimal`, `BigInt`, relations, and column naming out of the API layer.

## Data prepared for the recommender

| Table | Future use |
| --- | --- |
| `orders`, `order_items` | Market baskets for Apriori / FP-Growth rules |
| `products` | Embedding corpus: name, description, category and tags |
| `user_events` | Views, cart additions and recommendation clicks for offline evaluation |

Suggested future pipeline:

1. Export completed order baskets and learn rules using support, confidence and lift.
2. Encode product text using Word2Vec, FastText or a sentence-transformer.
3. Retrieve candidates from both models, normalize their scores, and blend them.
4. Log the strategy and rank in `user_events.metadata`.
5. Evaluate precision@K, recall@K, coverage, click-through rate and add-to-cart rate.

## API map

- `GET /api/products?search=&category=`
- `GET /api/categories`
- `GET /api/recommendations?productId=&limit=4`
- `POST /api/events`
- `POST /api/orders`
- `GET /api/admin/overview`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id` (soft delete)

This is a course prototype, so the admin route has no authentication and checkout intentionally collects no payment information. Add authentication, authorization, migrations, validation and a payment provider before considering production use.
