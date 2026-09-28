# ProStock Pages, Roles & Permissions Specification

> Complete specification of all pages, their data dependencies, user workflows, and role-based access control.

---

## Role-Based Access Control

### Roles (4 total)

| Role | Description | Route Access |
|------|-------------|--------------|
| `admin` | Full access to everything | All routes (no restrictions) |
| `manager` | Management access | Dashboard, Items, Stock, Sales, Reports, Settings, KDS, Bar |
| `stock-manager` | Stock-focused access | Stock, Stock Activity, KDS, Bar |
| `user` | Basic POS access | Dashboard, Items, Sales, KDS, Bar |

### Route Access Matrix

| Route | admin | manager | stock-manager | user |
|-------|-------|---------|---------------|------|
| `/dashboard` | ✅ | ✅ | ❌ | ✅ |
| `/items` | ✅ | ✅ | ❌ | ✅ |
| `/items/new` | ✅ | ✅ | ❌ | ✅ |
| `/items/{id}/edit` | ✅ | ✅ | ❌ | ✅ |
| `/stock` | ✅ | ✅ | ✅ | ❌ |
| `/stock-activity` | ✅ | ❌ | ✅ | ❌ |
| `/sales` | ✅ | ✅ | ❌ | ✅ |
| `/reports` | ✅ | ✅ | ❌ | ❌ |
| `/settings` | ✅ | ✅ | ❌ | ❌ |
| `/kds` | ✅ | ✅ | ✅ | ✅ |
| `/bar` | ✅ | ✅ | ✅ | ✅ |
| `/login` | Public | Public | Public | Public |

### Default Routes After Login

| Role | Default Route |
|------|--------------|
| `admin` | `/dashboard` |
| `manager` | `/dashboard` |
| `stock-manager` | `/stock` |
| `user` | `/dashboard` |

### Auto-Profile Creation

On first login, a user document is created in the `users` Firestore collection:

```
IF user does not exist in users collection:
    newUser = {
        uid: authUser.uid,
        email: authUser.email,
        name: authUser.displayName || authUser.email.split('@')[0],
        photoURL: authUser.photoURL,
        role: 'user'  // default
    }
    
    // Special email-based role assignment
    IF email == 'admin@beanespress.com':
        newUser.role = 'admin'
        // Also create marker doc in roles_admin collection
    ELSE IF email IN ['stockman@beanespress.com', 'poc@beanespress.com']:
        newUser.role = 'stock-manager'
    
    create(userDocRef, newUser)
```

### Route Guard Logic

```
FUNCTION routeGuard(authUser, appUser, pathname):
    IF pathname == '/login':
        IF isAuthenticated:
            redirect(DEFAULT_ROUTE_BY_ROLE[appUser.role])
        RETURN allow
    
    IF NOT isAuthenticated:
        redirect('/login')
        RETURN
    
    allowedRoutes = ALLOWED_ROUTES_BY_ROLE[appUser.role]
    IF allowedRoutes is null:  // admin = all routes
        RETURN allow
    
    IF NOT allowedRoutes.some(route => pathname.startsWith(route)):
        redirect(DEFAULT_ROUTE_BY_ROLE[appUser.role])
        RETURN
```

---

## Pages

### 1. Login (`/login`)

**Public route** — no authentication required.

| Aspect | Details |
|--------|---------|
| **Component** | `LoginForm` |
| **Data** | Firebase Auth (email/password) |
| **Workflow** | User enters email + password → Firebase Auth → redirect to default route by role |
| **Layout** | Full-screen centered card, no app shell |

---

### 2. Dashboard (`/dashboard`)

**Overview of business performance and inventory health.**

| Aspect | Details |
|--------|---------|
| **Route** | `/dashboard` |
| **Access** | admin, manager, user |
| **Data** | items, sales, wasteEvents, categories, settings |

**Components:**
- `DashboardStats` — Stat cards (total items, stock value, low stock count, ingredient value, packaging value, waste value, pull-out value, revenue, COGS, food cost %)
- `SalesChart` — Sales over time chart (Recharts)
- `LowStockItems` — List of items at or below low stock threshold
- `CategoryDistributionChart` — Item count per category
- `InventoryMovementChart` — Ingredient & packaging movement (stock, consumed, waste, pull-out)
- `ItemConsumption` — Top consumed items
- `ExpiringItems` — Items expiring within 3 months
- `WasteSummary` — Waste breakdown by category and type

**Workflow:** Read-only dashboard. User views metrics, charts, and alerts. No direct actions.

---

### 3. Items (`/items`)

**Manage products and ingredients.**

| Aspect | Details |
|--------|---------|
| **Route** | `/items` |
| **Access** | admin, manager, user |
| **Data** | items, categories, subcategories, stations, sales, stockReceipts, wasteEvents, settings |

**Components:**
- `ItemsToolbar` — Search, category/subcategory/station filters, tag filters, "As Of" date filter, bulk actions
- `DataTable` — Sortable, paginated table with row selection
- `ItemsColumns` — Columns: image, name, SKU, category, subcategory, station, stock quantity, cost, price, tags, actions
- `StockBatchesViewer` — View individual stock batches (in edit mode)

**Features:**
- **Search** — By name or SKU
- **Filter** — By category, subcategory, station, tags (multi-select, URL-synced)
- **Sort** — By any column, URL-synced
- **Pagination** — Configurable page size, URL-synced
- **"As Of" date** — View historical stock levels at a specific date
- **Row selection** — Multi-select for bulk operations
- **Bulk actions:**
  - Bulk update category, subcategory, or station
  - Bulk add/remove tags
  - Bulk delete items
- **Per-row actions:**
  - Edit item → `/items/{id}/edit`
  - Duplicate item → `/items/new?duplicate={id}`
  - Delete item (with confirmation)
  - "Where Used" — Shows which composite items use this ingredient
- **Add new** → `/items/new`

---

### 4. Item Form (`/items/new`, `/items/{id}/edit`)

**Create or edit an inventory item.**

| Aspect | Details |
|--------|---------|
| **Route** | `/items/new` or `/items/{id}/edit` |
| **Access** | admin, manager, user |
| **Data** | item (if editing), categories, subcategories, stations, simpleItems (for composite components), taxes, settings |

**Form Sections:**

1. **Basic Information**
   - Name, description, category, subcategory (filtered by category), station

2. **Inventory**
   - **Simple items:**
     - Purchase price (marketPrice), units per purchase (purchaseQuantity)
     - Auto-calculated unit cost (with tax adjustments)
     - Track stock toggle
     - Low stock threshold
     - Initial stock (new items only): quantity, receive date, expiry/roast date
   - **Composite items:**
     - Standard recipe yield
     - Total batch cost (auto-calculated from components)
     - Unit cost (batch cost / yield)
     - Component ingredients list (each: item selector + quantity)
     - Add/remove ingredients

3. **Pricing & Identification**
   - Selling price, taxes (multi-select), sold by (each/volume), SKU, barcode, tags

4. **POS Settings**
   - Sellable toggle
   - Sale type (dine-in/take-away) — only if sellable
   - Item type (food/beverage/packaging) — only if sellable
   - Beverage size — only if beverage
   - POS representation (color/image), color picker

5. **Image**
   - Upload image (stored in Firebase Storage)
   - AI suggestion (Genkit/Gemini) — suggests name & description from image

6. **Stock Batches Viewer** (edit mode only)
   - View all current stock batches with quantities and dates

**Cost Auto-Calculation:**
- Real-time cost preview as user types
- Simple: `(marketPrice with taxes) / purchaseQuantity`
- Composite: `(sum of component costs with taxes) / yield`

---

### 5. Stock Management (`/stock`)

**Receive new stock and record waste or spoilage.**

| Aspect | Details |
|--------|---------|
| **Route** | `/stock` |
| **Access** | admin, manager, stock-manager |
| **Data** | items, categories |

**Components:**
- `StockManager` with two tabs:

**Tab 1: Receive Stock**
- Category filter: Ingredient / Packaging (radio)
- Item selector (SearchableSelect, filtered by category type)
- Receive date (calendar picker)
- Quantity
- Shelf life info (ingredients only): Expiry date / Roast date / None
- On submit: creates new stock batch + stock receipt log

**Tab 2: Record Waste / Pull Out**
- Reduction type: Waste / Pull Out (radio)
- Item category filter: Ingredient / Packaging / Product (radio)
- Item selector (SearchableSelect)
- **Simple items:** Batch selector (dropdown showing quantity + expiry/roast date)
- **Composite items:** Shows proportional ingredient deduction preview (shows each component and calculated deduction amount based on yield)
- Quantity to remove
- Recorded by (staff name)
- Reason (required, textarea)
- On submit: deducts stock (FIFO for composite) + creates waste event

---

### 6. Stock Activity Log (`/stock-activity`)

**Monitor all incoming stock and recorded reductions.**

| Aspect | Details |
|--------|---------|
| **Route** | `/stock-activity` |
| **Access** | admin, stock-manager |
| **Data** | stockReceipts, wasteEvents, users |

**Components:**
- Two tabs:

**Tab 1: Stock In (Receipts)**
- Table: Date, Item, Quantity, Expiry/Roast Date, User Account, Actions (admin only)
- Admin can delete receipts (restores stock from the batch)

**Tab 2: Reductions (Waste/Pull Out)**
- Table: Date, Type (badge), Item, Qty, Recorded By, Reason, Actions (admin only)
- Admin can delete waste events (restores stock to the batch)

---

### 7. Sales POS (`/sales`)

**Point of sale terminal for processing orders.**

| Aspect | Details |
|--------|---------|
| **Route** | `/sales` |
| **Access** | admin, manager, user |
| **Data** | items, categories, subcategories, settings, recent sales |

**Layout:** Split view — product grid (left) + checkout panel (right)

**Product Grid:**
- Search bar (by name or SKU)
- Sale type tabs: Dine In / Take Away
- View mode: Categories (subcategory grid) / All (item grid)
- Subcategory grid → click to see items in that subcategory
- Item cards: image, name, price, SKU, in-cart quantity badge
- Click item to add to cart

**Checkout Panel:**
- Sale date picker
- Cart items list with:
  - Quantity controls (+/-)
  - Item-level discount (percent/fixed)
  - Remove button
- Overall discount (percent/fixed)
- Delivery fee toggle + amount
- Totals: Gross subtotal, item discounts, overall discount, delivery fee, total
- Complete Sale button → deducts stock (FIFO) + creates sale record
- Recent Sales history (slide-out panel):
  - Last 20 sales
  - Expandable details (items, discounts, delivery fee)
  - Print receipt (Bluetooth thermal printer)
  - Delete sale (restores stock)

**Mobile:** Cart becomes a bottom sheet, history accessible via floating button

---

### 8. Reports (`/reports`)

**Detailed reports for sales, inventory, and waste.**

| Aspect | Details |
|--------|---------|
| **Route** | `/reports` |
| **Access** | admin, manager |
| **Data** | items, categories, subcategories, sales, wasteEvents |

**Report Tabs (5):**

1. **Receipts** — Individual sales transactions with date range filter, item details, totals
2. **Product Sales** — Sales aggregated by product, showing quantity sold and revenue
3. **Stock Out (Ingredients)** — Ingredient consumption analysis (from sales + composite breakdown)
4. **Inventory Snapshot** — Current inventory state: items, quantities, values, categories
5. **Waste Report** — Waste events with filtering by type (waste/pull-out), date, item

---

### 9. Settings (`/settings`)

**Manage application settings.**

| Aspect | Details |
|--------|---------|
| **Route** | `/settings` |
| **Access** | admin, manager |
| **Data** | categories, subcategories, stations, taxes, users |

**Settings Tabs (4):**

1. **General**
   - `PosSettingsManager` — Default sale type, currency
   - `PrinterSettingsManager` — Bluetooth thermal printer configuration
   - `TaxManager` — CRUD for taxes (name, rate, type)

2. **Item Properties**
   - `CategoriesManager` — CRUD for categories (name, color)
   - `SubcategoriesManager` — CRUD for subcategories (name, parent category)
   - `StationsManager` — CRUD for stations (name)
   - `TagsManager` — Manage tags used across items
   - `StaffManager` — CRUD for staff members (name, role)

3. **Users**
   - `UserSettings` — View all users, change user roles (admin only)

4. **Data Management**
   - `DataManager` — Data integrity & reconciliation tools:
     - **Master Inventory Sync** — Rebuilds all stock from receipts + sales + waste history (FIFO)
     - **Item-specific audits** — Graham Crackers, French Vanilla Syrup, Brown Sugar, Frappe Base, Espresso Blend, Salted Butter
     - **Normalize Precision** — Ensures 4-decimal rounding on all stock data
     - **Danger zone:** Reset all stock, clear activity log, clear waste log

---

### 10. Kitchen Display System (`/kds`)

**Real-time kitchen order queue.**

| Aspect | Details |
|--------|---------|
| **Route** | `/kds` |
| **Access** | admin, manager, stock-manager, user |
| **Data** | sales (pending/preparing), items |

**Features:**
- Shows active orders (status: pending or preparing) filtered to food items
- Horizontal card layout (one card per order)
- Each card shows: ticket number, dine-in/delivery badge, wait timer, item list with checkboxes
- Wait time urgency: >15min = red/pulsing, >8min = amber, normal = default
- Actions: "Start Preparing" (pending → preparing), "Mark Ready & Complete" (preparing → completed)
- Interactive item checkboxes for tracking preparation progress

---

### 11. Bar Display (`/bar`)

**Real-time bar order queue.**

| Aspect | Details |
|--------|---------|
| **Route** | `/bar` |
| **Access** | admin, manager, stock-manager, user |
| **Data** | sales (pending/preparing), items |

**Features:**
- Identical to KDS but filtered to beverage items only
- Same card layout, timer, and status management

---

## App Layout

### Shell (`AppLayout`)

- **Sidebar navigation** (desktop) with links to accessible routes
- **Mobile** — Collapsible menu
- **Loading state** — Full-screen spinner while auth initializes
- **User info** — Current user name, email, role, avatar

### Global Providers

1. `FirebaseClientProvider` — Initializes Firebase app, auth, and Firestore
2. `AuthProvider` — Manages auth state, route guarding, user profile creation
3. `SettingsProvider` — Loads POS settings from Firestore `settings/pos` document

### Fonts
- Body: Inter (Google Fonts)
- Headlines: Space Grotesk (Google Fonts)

### UI Framework
- TailwindCSS with custom theme
- Radix UI primitives (dialogs, dropdowns, tabs, etc.)
- Recharts for data visualization
- Lucide icons
