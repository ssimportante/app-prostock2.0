export type Role = 'admin' | 'manager' | 'stock-manager' | 'user';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface StockBatch {
  id: string;
  quantity: number;
  expiryDate?: string;
  roastDate?: string;
  addedAt: string;
}

export interface ItemComponent {
  itemId: string;
  quantity: number;
}

export type InventoryType = 'simple' | 'composite';
export type SoldBy = 'each' | 'volume';
export type SaleType = 'dine-in' | 'take-away';
export type ItemType = 'food' | 'beverage' | 'packaging';

export interface Item {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  subcategoryId?: string | null;
  stationId?: string | null;
  sku: string;
  barcode?: string;
  isSellable: boolean;
  saleType?: SaleType | null;
  itemType?: ItemType | null;
  soldBy: SoldBy;
  price: number; // cents (per unit; for volume items, per g/ml)
  cost: number; // cents per unit (may be fractional for volume rates)
  inventoryType: InventoryType;
  trackStock: boolean;
  stockBatches: StockBatch[];
  lowStockThreshold: number;
  components: ItemComponent[];
  yield?: number;
  taxIds: string[];
  posColor: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export interface Station {
  id: string;
  name: string;
}

export interface Tax {
  id: string;
  name: string;
  rate: number; // percentage, e.g. 12 for 12%
}

export interface Discount {
  type: 'percent' | 'fixed';
  value: number; // percent: 0-100, fixed: cents
  amount: number; // applied amount in cents
}

export interface SaleItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number; // cents
  refundedQuantity?: number;
  discount?: Discount;
  stationId?: string | null;
  itemType?: string | null;
}

export type SaleStatus = 'pending' | 'preparing' | 'completed' | 'cancelled';

export interface Sale {
  id: string;
  date: string; // ISO
  ticketNumber: number;
  items: SaleItem[];
  subtotal: number; // cents
  deliveryFee: number; // cents
  discount?: Discount;
  tax: number; // cents
  total: number; // cents
  status: SaleStatus;
  saleType: SaleType;
  userId: string;
  userName: string;
  completedAt?: string | null;
}

export interface WasteEvent {
  id: string;
  date: string; // ISO
  itemId: string;
  itemName: string;
  quantity: number;
  cost: number; // cents (quantity * item.cost)
  unit: 'units' | 'g/ml';
  reason: string;
  eventType: 'waste' | 'pull-out';
  userId: string;
  userName: string;
  batchId?: string;
}

export interface StockReceipt {
  id: string;
  date: string; // ISO
  itemId: string;
  itemName: string;
  quantity: number;
  unit: 'units' | 'g/ml';
  batchId: string;
  batchDate?: string;
  batchDateType?: 'expiry' | 'roast';
  userId: string;
  userName: string;
}

export interface PosSettings {
  currency: string;
  defaultSaleType: SaleType;
}

// ---------- Report payloads ----------

export interface SummaryKpis {
  totalRevenue: number;
  totalCogs: number;
  foodCostPercentage: number;
  totalStockValue: number;
  ingredientStockValue: number;
  packagingStockValue: number;
  wasteValue: number;
  pullOutValue: number;
  totalItems: number;
  ordersCount: number;
  pendingCount: number;
  lowStockCount: number;
  expiringCount: number;
}

export interface LowStockEntry {
  id: string;
  name: string;
  stock: number;
  threshold: number;
  unit: string;
}

export interface ExpiringEntry {
  itemName: string;
  quantity: number;
  effectiveExpiry: string;
  unit: string;
}

export interface SalesByDayEntry {
  label: string;
  date: string; // ISO
  revenue: number;
  orders: number;
}

export interface TopItemEntry {
  name: string;
  revenue: number;
  units: number;
}

export interface CategoryDistEntry {
  name: string;
  value: number;
  color: string;
}

export interface MovementBreakdown {
  stock: number;
  consumed: number;
  waste: number;
  pullOut: number;
}

export interface WasteByItemEntry {
  name: string;
  waste: number;
  pullOut: number;
  total: number;
  events: number;
}

export interface ReportsSummary {
  kpis: SummaryKpis;
  salesByDay: SalesByDayEntry[];
  lowStock: LowStockEntry[];
  expiring: ExpiringEntry[];
  topItems: TopItemEntry[];
  categoryDist: CategoryDistEntry[];
  movement: {
    ingredient: MovementBreakdown;
    packaging: MovementBreakdown;
  };
  wasteByItem: WasteByItemEntry[];
}

export interface StockOverviewRow {
  id: string;
  name: string;
  categoryId: string;
  stock: number;
  unit: string;
  lowStockThreshold: number;
  value: number;
  batches: StockBatch[];
}

export type ActivityEntry =
  | ({ kind: 'receipt' } & StockReceipt)
  | ({ kind: 'waste' } & WasteEvent);
