# ProStock Entity Schema Specification

> Complete field-level schema for all 10 Firestore collections. Use this to create matching Base44 native entities.

## Collection: `items`

The core inventory entity. Supports both simple items (direct stock) and composite items (recipes made from other items).

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Item name |
| `description` | string | No | `""` | Item description |
| `categoryId` | string (FK → categories.id) | Yes | — | Primary category |
| `subcategoryId` | string\|null (FK → subcategories.id) | No | `null` | Subcategory within category |
| `stationId` | string (FK → stations.id) | No | `""` | Kitchen/bar station assignment |
| `sku` | string | No | `""` | Stock keeping unit code |
| `barcode` | string | No | `""` | GTIN/UPC barcode |
| `isSellable` | boolean | Yes | `false` | Whether item appears on POS sales terminal |
| `saleType` | `'dine-in'\|'take-away'\|null` | No | `null` | Only set if `isSellable` is true |
| `itemType` | `'food'\|'beverage'\|'packaging'\|null` | No | `null` | Used by KDS/Bar display to filter items |
| `beverageSize` | string\|null | No | `null` | Only set if `itemType` is `'beverage'` |
| `soldBy` | `'each'\|'volume'` | Yes | — | Unit type: `each` = units, `volume` = g/ml |
| `price` | number | No | `0` | Selling price (for POS) |
| `cost` | number | Yes | `0` | Calculated unit cost (auto-computed, see Business Logic) |
| `marketPrice` | number | No | `0` | Purchase price for a pack/case (simple items only) |
| `purchaseQuantity` | number | No | `0` | Units per pack/case (simple items only) |
| `inventoryType` | `'simple'\|'composite'` | Yes | — | `simple` = direct stock tracking; `composite` = recipe of other items |
| `trackStock` | boolean | Yes | — | Whether stock is auto-deducted on sale. Always `false` for composite items. |
| `stockBatches` | StockBatch[] | Yes | `[]` | Array of stock batches (see below). Empty for composite items. |
| `lowStockThreshold` | number | No | `0` | Alert threshold. Only meaningful if `trackStock` is true. |
| `components` | ItemComponent[] | Yes | `[]` | Recipe ingredients. Only for composite items. |
| `yield` | number\|undefined | No | `1` | Total batch yield for composite recipes. Used to calculate per-unit cost. |
| `tags` | string[] | No | `[]` | Free-form tags for grouping/filtering |
| `taxIds` | string[] (FK → taxes.id) | No | `[]` | Taxes applied to this item for cost calculation |
| `posRepresentationType` | `'color'\|'image'` | No | `'color'` | How item appears on POS grid |
| `posColor` | string | No | `'#cccccc'` | Hex color for POS display |
| `posShape` | string | No | `'square'` | POS tile shape |
| `imageUrl` | string | No | `""` | Firebase Storage URL or empty string |

### Sub-type: StockBatch

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique batch ID (format: `batch-{timestamp}-{random}`) |
| `quantity` | number | Yes | Current quantity in this batch |
| `purchaseDate` | string | No | ISO date string `YYYY-MM-DD` |
| `expiryDate` | string | No | ISO date string `YYYY-MM-DD` |
| `roastDate` | string | No | ISO date string `YYYY-MM-DD` (coffee-specific) |

### Sub-type: ItemComponent

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `itemId` | string (FK → items.id) | Yes | Reference to a simple item |
| `quantity` | number | Yes | Quantity used per recipe batch |

---

## Collection: `categories`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Category name (e.g., "Ingredient", "Packaging", "Product") |
| `itemCount` | number | No | `0` | Cached count of items in this category |
| `color` | string | Yes | — | Hex color for UI display |

**Special categories by name (used in business logic):**
- `"ingredient"` or `"ingredients"` → Ingredient category (used for movement analysis)
- `"packaging"` → Packaging category (used for movement analysis)
- `"product"` or `"products"` → Product category (used for waste filtering)

---

## Collection: `subcategories`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Subcategory name |
| `categoryId` | string (FK → categories.id) | Yes | Parent category |

---

## Collection: `stations`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Station name (e.g., "Kitchen", "Bar") |

---

## Collection: `taxes`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Tax name |
| `rate` | number | Yes | — | Percentage rate (e.g., `8.5` for 8.5%) |
| `taxType` | `'additive'\|'compounded'` | No | `'additive'` | How tax is applied (see Business Logic) |

---

## Collection: `users`

Managed by Firebase Auth + Firestore. Created automatically on first login.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Firebase Auth UID (document ID) |
| `name` | string\|null | No | Display name |
| `email` | string\|null | No | Email address |
| `photoURL` | string\|null | No | Profile photo URL |
| `role` | `'admin'\|'manager'\|'user'\|'stock-manager'` | Yes | App role |

**Auto-creation logic:**
- New users default to role `'user'`
- Email `admin@beanespress.com` → role `'admin'` (also creates a marker doc in `roles_admin` collection)
- Email `stockman@beanespress.com` or `poc@beanespress.com` → role `'stock-manager'`

---

## Collection: `sales`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `date` | Firestore Timestamp | Yes | — | Sale date/time |
| `total` | number | Yes | — | Final total after discounts + delivery |
| `subtotal` | number | No | — | Gross subtotal before discounts |
| `deliveryFee` | number\|undefined | No | — | Delivery fee if applicable |
| `discount` | object\|undefined | No | — | Overall sale discount (see below) |
| `userId` | string\|undefined | No | — | Firebase Auth UID of cashier |
| `status` | `'pending'\|'preparing'\|'completed'\|'cancelled'` | No | `'pending'` | Order status for KDS |
| `ticketNumber` | string | No | random 3-digit | Display ticket number |
| `completedAt` | Firestore Timestamp\|undefined | No | — | When order was completed |
| `items` | SaleItem[] | Yes | — | Line items (see below) |

### Sub-type: Sale Discount

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'percent'\|'fixed'` | Discount type |
| `value` | number | Percentage or fixed amount |
| `amount` | number | Calculated discount amount |

### Sub-type: SaleItem

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `itemId` | string (FK → items.id) | Yes | Reference to item sold |
| `quantity` | number | Yes | Quantity sold |
| `refundedQuantity` | number | No | Refunded portion (default 0) |
| `price` | number | Yes | Unit price at time of sale |
| `discount` | SaleDiscount\|undefined | No | Item-level discount |

---

## Collection: `wasteEvents`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `date` | Firestore Timestamp | Yes | When the waste was recorded |
| `itemId` | string (FK → items.id) | Yes | Item that was wasted |
| `itemName` | string | Yes | Item name (denormalized snapshot) |
| `quantity` | number | Yes | Amount wasted |
| `cost` | number | Yes | Total cost of wasted items (`item.cost * quantity`) |
| `unit` | `'units'\|'g/ml'` | Yes | Unit type |
| `userId` | string | Yes | Firebase Auth UID of recorder |
| `recordedByName` | string | Yes | Staff member name (free text) |
| `batchId` | string\|undefined | No | Specific batch affected (simple items only) |
| `reason` | string | Yes | Explanation for the waste |
| `eventType` | `'waste'\|'pull-out'` | Yes | Type of reduction |

---

## Collection: `stockReceipts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `date` | Firestore Timestamp | Yes | When stock was received |
| `userId` | string | Yes | Firebase Auth UID of receiver |
| `itemId` | string (FK → items.id) | Yes | Item received |
| `itemName` | string | Yes | Item name (denormalized) |
| `quantity` | number | Yes | Amount received |
| `unit` | `'units'\|'g/ml'` | Yes | Unit type |
| `batchId` | string | Yes | Batch ID created (matches a batch in item.stockBatches) |
| `batchDetails` | object | No | Shelf life info (see below) |

### Sub-type: BatchDetails

| Field | Type | Description |
|-------|------|-------------|
| `date` | string\|undefined | ISO date `YYYY-MM-DD` |
| `dateType` | `'expiry'\|'roast'\|undefined` | Type of date |

---

## Collection: `staff`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Staff member name |
| `role` | string | Yes | Staff role/title (e.g., "Barista") |

---

## Collection: `settings` (singleton document)

Document ID: `pos`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `defaultSaleType` | `'dine-in'\|'take-away'` | No | `'dine-in'` | Default POS tab |
| `currency` | string | No | `'USD'` | Currency code for display |

---

## Relationship Diagram

```
┌──────────┐     categoryId     ┌──────────────┐
│          │───────────────────→│  categories   │
│          │     subcategoryId  ├──────────────┤
│          │───────────────────→│ subcategories │
│          │                    └──────────────┘
│          │     stationId      ┌──────────┐
│   items  │───────────────────→│ stations │
│          │                    └──────────┘
│          │     taxIds[]       ┌──────────┐
│          │───────────────────→│   taxes   │
│          │                    └──────────┘
│          │     components[]   ┌──────────┐
│          │───────────────────→│   items   │ (self-ref)
└────┬─────┘    .itemId         │(simple)   │
     │                          └──────────┘
     │ itemId
     │
     ├──────────→ ┌──────────────┐
     │            │ wasteEvents  │
     │            └──────────────┘
     │
     ├──────────→ ┌──────────────────┐
     │            │  stockReceipts   │
     │            └──────────────────┘
     │
     └──────────→ ┌──────────┐
                  │   sales   │ items[].itemId
                  └────┬─────┘
                       │ userId
                       ↓
                  ┌──────────┐
                  │   users   │
                  └──────────┘

┌──────────┐
│  staff    │ (standalone, referenced by name in waste forms)
└──────────┘

┌──────────┐
│ settings  │ (singleton doc: "pos")
└──────────┘
```
