
export type StockBatch = {
  id: string;
  quantity: number;
  purchaseDate?: string;
  expiryDate?: string; // ISO date string e.g. "2024-12-31"
  roastDate?: string; // ISO date string e.g. "2024-12-31"
};

export type ItemComponent = {
  itemId: string;
  quantity: number;
};

export type Item = {
  name: string;
  description: string;
  categoryId: string;
  subcategoryId?: string | null;
  stationId?: string;
  sku: string;
  barcode: string;
  isSellable: boolean;
  saleType?: 'dine-in' | 'take-away' | null;
  itemType?: 'food' | 'beverage' | 'packaging' | null;
  beverageSize?: string | null;
  soldBy: 'each' | 'volume';
  price: number;
  cost: number;
  marketPrice?: number;
  purchaseQuantity?: number;
  inventoryType: 'simple' | 'composite';
  trackStock: boolean;
  stockBatches: StockBatch[];
  lowStockThreshold: number;
  components: ItemComponent[];
  yield?: number; // Standard yield for composite recipes
  tags?: string[];
  taxIds?: string[];
  posRepresentationType: 'color' | 'image';
  posColor: string;
  posShape: string;
  imageUrl: string;
};

export type ItemWithId = Item & { id: string };

export type Category = {
  name: string;
  itemCount: number;
  color: string;
};

export type CategoryWithId = Category & { id: string };

export type Subcategory = {
  name: string;
  categoryId: string;
};

export type SubcategoryWithId = Subcategory & { id: string };

export type Station = {
  name: string;
};

export type StationWithId = Station & { id: string };

export type Sale = {
  id: string;
  date: any; // This will be a Firestore Timestamp object
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  discount?: {
    type: 'percent' | 'fixed';
    value: number;
    amount: number;
  };
  userId?: string;
  status?: 'pending' | 'preparing' | 'completed' | 'cancelled';
  ticketNumber?: string;
  completedAt?: any;
  items: {
    itemId: string;
    quantity: number;
    refundedQuantity?: number;
    price: number;
    discount?: {
      type: 'percent' | 'fixed';
      value: number;
      amount: number;
    };
  }[];
};

export type SaleWithId = Sale & { id: string };

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  discount?: {
    type: 'percent' | 'fixed';
    value: number;
    amount: number;
  };
};

export type WasteEvent = {
  id: string;
  date: any; // This will be a Firestore Timestamp object
  itemId: string;
  itemName: string;
  quantity: number;
  cost: number; // total cost of wasted items (quantity * item.cost)
  unit: 'units' | 'g/ml';
  userId: string;
  recordedByName: string;
  batchId?: string;
  reason: string;
  eventType: 'waste' | 'pull-out';
};

export type StockReceipt = {
  date: any; // Firestore Timestamp
  userId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: 'units' | 'g/ml';
  batchId: string;
  batchDetails: {
    date?: string;
    dateType?: 'expiry' | 'roast';
  };
  recordedByName: string;
};

export type Staff = {
  name: string;
};

export type StaffWithId = Staff & { id: string };

export type StockReceiptWithId = StockReceipt & { id: string };

export type Tax = {
    name: string;
    rate: number; // as a percentage, e.g., 8.5 for 8.5%
    taxType?: 'additive' | 'compounded';
};

export type TaxWithId = Tax & { id: string };

export type PosSettings = {
    defaultSaleType: 'dine-in' | 'take-away';
    currency: string;
};

export type UserRole = 'admin' | 'stock-manager' | 'kitchen-user' | 'bar-user';

export type AppUser = {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
};
