# Current data model

This document describes all **12 Prisma entities** and their **11 foreign-key relationships** in
[`server/prisma/schema.prisma`](../server/prisma/schema.prisma), including the Olist extensions.
It documents the code-defined model; it does not inspect which migrations a particular running
PostgreSQL database has applied. Entity and field names below match Prisma. The table mapping is
listed after the diagrams.

## Relationship overview

The overview shows primary keys and foreign keys. Geolocation's ZIP prefix is also shown to
make its optional enrichment role visible. The complete diagram below includes every stored field.

```mermaid
erDiagram
    Category ||..o| CategoryTranslation : "has translation"
    Category ||..o{ Product : "classifies"
    Customer ||..o{ CustomerSnapshot : "has location snapshots"
    Customer o|..o{ Order : "places"
    CustomerSnapshot o|..o| Order : "records source customer location"
    Order ||..o{ OrderItem : "contains"
    Product o|..o{ OrderItem : "identifies purchased product"
    Seller o|..o{ OrderItem : "fulfills"
    Order ||..o{ OrderPayment : "has payment records"
    Order ||..o{ OrderReview : "has purchase reviews"
    Product o|..o{ UserEvent : "is event subject"

    Category {
        Int id PK
    }

    CategoryTranslation {
        Int id PK
        Int categoryId FK, UK
    }

    Customer {
        String id PK
    }

    CustomerSnapshot {
        String id PK
        String customerId FK
    }

    Seller {
        String id PK
    }

    Geolocation {
        BigInt id PK
        String zipCodePrefix
    }

    Product {
        Int id PK
        Int categoryId FK
    }

    Order {
        BigInt id PK
        String customerId FK "nullable"
        String customerSnapshotId FK, UK "nullable"
    }

    OrderItem {
        BigInt id PK
        BigInt orderId FK
        Int productId FK "nullable"
        String sellerId FK "nullable"
    }

    OrderPayment {
        BigInt id PK
        BigInt orderId FK
    }

    OrderReview {
        BigInt id PK
        BigInt orderId FK
    }

    UserEvent {
        BigInt id PK
        Int productId FK "nullable"
    }
```

## Reading the diagrams

- `PK`: primary key; `FK`: foreign key; `UK`: individually unique field.
- `||`: exactly one; `o|`: zero or one; `o{`: zero or many. Read the symbol next to an entity
  as the number of that entity allowed for one record on the opposite side.
- Dashed lines are actual, non-identifying foreign-key relationships: each child has its own
  independent primary key. They do not represent inferred ZIP-code joins.
- `nullable` means the stored column can be null. Relationship navigation fields such as
  `Product.orderItems` are represented by the lines rather than duplicated as stored columns.
- `StringArray` is Prisma `String[]`. Source lifecycle/review/deadline fields use PostgreSQL
  `TIMESTAMP`; native record timestamps use `TIMESTAMPTZ`. Decimal precision is shown where relevant.
- Composite unique keys are listed separately; their individual components are not marked `UK`.

## Complete entity and field diagram

```mermaid
erDiagram
    Category ||..o| CategoryTranslation : "has translation"
    Category ||..o{ Product : "classifies"
    Customer ||..o{ CustomerSnapshot : "has location snapshots"
    Customer o|..o{ Order : "places"
    CustomerSnapshot o|..o| Order : "records source customer location"
    Order ||..o{ OrderItem : "contains"
    Product o|..o{ OrderItem : "identifies purchased product"
    Seller o|..o{ OrderItem : "fulfills"
    Order ||..o{ OrderPayment : "has payment records"
    Order ||..o{ OrderReview : "has purchase reviews"
    Product o|..o{ UserEvent : "is event subject"

    Category {
        Int id PK
        String name UK
        String slug UK
        String dataSource
        String sourceCategoryName "nullable"
    }

    CategoryTranslation {
        Int id PK
        Int categoryId FK, UK
        String portugueseName UK
        String englishName
    }

    Customer {
        String id PK
        String name
    }

    CustomerSnapshot {
        String id PK
        String customerId FK
        String zipCodePrefix
        String city
        String state
    }

    Seller {
        String id PK
        String zipCodePrefix
        String city
        String state
    }

    Geolocation {
        BigInt id PK
        Int sourceRow UK
        String zipCodePrefix
        Float latitude
        Float longitude
        String city
        String state
    }

    Product {
        Int id PK
        Int categoryId FK
        String name
        String slug UK
        String description
        Decimal price "numeric(12,2)"
        String currency
        Int stock
        String imageUrl "nullable"
        String accent
        Boolean featured
        Boolean active
        Decimal rating "numeric(2,1)"
        StringArray tags
        timestamptz createdAt
        timestamptz updatedAt
        String dataSource
        String sourceId "nullable"
        Boolean syntheticCatalog
        String catalogSeed "nullable"
        Int sourceNameLength "nullable"
        Int sourceDescriptionLength "nullable"
        Int photosQuantity "nullable"
        Int weightG "nullable"
        Int lengthCm "nullable"
        Int heightCm "nullable"
        Int widthCm "nullable"
    }

    Order {
        BigInt id PK
        String orderNumber UK
        String customerName
        String customerEmail "nullable"
        Decimal subtotal "nullable; numeric(12,2)"
        Decimal total "nullable; numeric(12,2)"
        String status
        timestamptz createdAt
        String dataSource
        String sourceId "nullable"
        String customerId FK "nullable"
        String customerSnapshotId FK, UK "nullable"
        String currency
        Decimal shippingTotal "nullable; numeric(12,2)"
        Decimal paymentTotal "nullable; numeric(12,2)"
        timestamp purchasedAt "nullable"
        timestamp approvedAt "nullable"
        timestamp deliveredCarrierAt "nullable"
        timestamp deliveredCustomerAt "nullable"
        timestamp estimatedDeliveryAt "nullable"
    }

    OrderItem {
        BigInt id PK
        BigInt orderId FK
        Int productId FK "nullable"
        String productName
        Int quantity
        Decimal unitPrice "numeric(12,2)"
        Int sourceItemSequence "nullable"
        String sellerId FK "nullable"
        Decimal freightValue "nullable; numeric(12,2)"
        timestamp shippingLimitAt "nullable"
    }

    OrderPayment {
        BigInt id PK
        BigInt orderId FK
        Int sequence
        String type
        Int installments
        Decimal value "numeric(12,2)"
    }

    OrderReview {
        BigInt id PK
        BigInt orderId FK
        String sourceReviewId
        Int score
        String commentTitle "nullable"
        String commentMessage "nullable"
        timestamp reviewCreatedAt
        timestamp answeredAt
    }

    UserEvent {
        BigInt id PK
        String sessionId
        String eventType
        Int productId FK "nullable"
        Json metadata
        timestamptz createdAt
    }
```

## Entity-to-table mapping

| Prisma entity | PostgreSQL table | Purpose |
| --- | --- | --- |
| `Category` | `categories` | Catalog classification, including original Olist category codes. |
| `CategoryTranslation` | `category_translations` | Original Portuguese-to-English category mapping; optional one-to-one translation per category. |
| `Customer` | `customers` | Persistent customer identity; imported name equals its source unique customer ID. |
| `CustomerSnapshot` | `customer_snapshots` | Order-specific source customer ID and delivery-location snapshot. |
| `Seller` | `sellers` | Seller identity and location; attached to individual purchased items. |
| `Geolocation` | `geolocations` | ZIP-prefix coordinate observations, including repeated prefixes and duplicate observations. |
| `Product` | `products` | Storefront catalog, generated-field provenance, and original physical/text-length metadata. |
| `Order` | `orders` | Customer references, monetary aggregates, status, provenance, and delivery lifecycle. |
| `OrderItem` | `order_items` | Purchased product/name/price snapshot, quantity, seller, freight, and shipping deadline. |
| `OrderPayment` | `order_payments` | Payment sequence, method, installments, and value; an order can have several. |
| `OrderReview` | `order_reviews` | Purchase-experience review, score, optional comments, and source dates. |
| `UserEvent` | `user_events` | Session interaction log with optional product and JSON metadata. |

## Composite unique keys

These enforce uniqueness of a combination of fields, not each field separately.

| Entity | Unique field combination |
| --- | --- |
| `Category` | `dataSource`, `sourceCategoryName` |
| `Product` | `dataSource`, `sourceId` |
| `Order` | `dataSource`, `sourceId` |
| `OrderItem` | `orderId`, `sourceItemSequence` |
| `OrderPayment` | `orderId`, `sequence` |
| `OrderReview` | `orderId`, `sourceReviewId` |

## Relationship details worth reviewing

- A category has zero or one translation; every translation belongs to exactly one category.
- Every product belongs to a category. Product references on historical order items and user
  events are nullable, so those records can exist without a product association.
- Every customer snapshot belongs to a persistent customer. An order's persistent customer and
  snapshot references are independently optional; a snapshot can be linked to at most one order.
  The schema does not enforce that `Order.customerId` equals the referenced snapshot's
  `customerId`; import logic supplies matching values.
- Every order item belongs to an order. Seller references are optional for native/demo checkout.
  Orders can contain items from multiple sellers; there is no single order-level seller relation.
- Order items, payments, and reviews are separate one-to-many children. The schema allows an order
  without any of them, accommodating itemless source orders and native demo orders without payment records.
- External review IDs are unique only together with their order, not across the entire review table.
- Deleting an order cascades to its items, payments, and reviews. Other foreign keys use `NoAction`
  for deletion; all modeled foreign keys use `NoAction` for updates.
- **Geolocation has no foreign-key relationships.** Its ZIP prefix is not unique. Customer snapshots
  and sellers can be enriched by matching ZIP prefixes, but raw observations must first be reduced
  to the intended lookup grain to avoid multiplying joined rows. Missing prefixes remain valid.

Indexes and defaults remain documented in the Prisma schema and the Flyway migration files.
When the model changes, update both diagrams and the composite-key table in this document.
