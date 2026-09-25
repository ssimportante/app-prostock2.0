import type { DbData } from './db';
import { createSale } from './sales';
import { hashPassword } from './password';
import type { Item, StockReceipt, WasteEvent } from '@/lib/types';

/** Deterministic PRNG so seeded demo data is stable across resets. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DATE_IN_DAYS = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function buildSeedData(): DbData {
  const rand = mulberry32(42);
  const isoDaysAgo = (n: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, Math.floor(rand() * 59), 0, 0);
    return d.toISOString();
  };

  const db: DbData = {
    version: 1,
    sessions: [],
    settings: { currency: '₱', defaultSaleType: 'dine-in' },
    ticketCounter: 0,
    users: [
      { id: 'user_admin', email: 'admin@beanespress.com', name: 'Ava Reyes', role: 'admin', passwordHash: hashPassword('password123') },
      { id: 'user_manager', email: 'manager@beanespress.com', name: 'Marco Lim', role: 'manager', passwordHash: hashPassword('password123') },
      { id: 'user_stock', email: 'stockman@beanespress.com', name: 'Sam Dela Cruz', role: 'stock-manager', passwordHash: hashPassword('password123') },
      { id: 'user_poc', email: 'poc@beanespress.com', name: 'Paul Cruz', role: 'stock-manager', passwordHash: hashPassword('password123') },
      { id: 'user_cashier', email: 'cashier@beanespress.com', name: 'Lena Tan', role: 'user', passwordHash: hashPassword('password123') },
    ],
    categories: [
      { id: 'cat_espresso', name: 'Espresso Drinks', color: '#B4552D' },
      { id: 'cat_cold', name: 'Cold Drinks', color: '#3E7C8F' },
      { id: 'cat_pastries', name: 'Pastries & Food', color: '#C29B3C' },
      { id: 'cat_ingredients', name: 'Ingredients', color: '#6B8E5A' },
      { id: 'cat_packaging', name: 'Packaging', color: '#8A7A6B' },
    ],
    subcategories: [
      { id: 'sub_hot', name: 'Hot', categoryId: 'cat_espresso' },
      { id: 'sub_iced', name: 'Iced', categoryId: 'cat_espresso' },
      { id: 'sub_bottled', name: 'Bottled', categoryId: 'cat_cold' },
      { id: 'sub_sweet', name: 'Sweet', categoryId: 'cat_pastries' },
      { id: 'sub_savory', name: 'Savory', categoryId: 'cat_pastries' },
    ],
    stations: [
      { id: 'st_bar', name: 'Bar' },
      { id: 'st_kitchen', name: 'Kitchen' },
      { id: 'st_storage', name: 'Storage' },
    ],
    taxes: [{ id: 'tax_vat', name: 'VAT', rate: 12 }],
    items: [],
    sales: [],
    wasteEvents: [],
    stockReceipts: [],
  };

  const item = (i: Partial<Item> & Pick<Item, 'id' | 'name' | 'categoryId' | 'sku' | 'price' | 'cost'>): Item => ({
    description: '',
    subcategoryId: null,
    stationId: null,
    barcode: '',
    isSellable: false,
    saleType: null,
    itemType: null,
    soldBy: 'each',
    inventoryType: 'simple',
    trackStock: true,
    stockBatches: [],
    lowStockThreshold: 0,
    components: [],
    taxIds: [],
    posColor: '#B4552D',
    yield: undefined,
    ...i,
  });

  const batch = (quantity: number, opts?: { expiryDays?: number; roastDays?: number; addedDays?: number }) => ({
    id: `batch_${Math.random().toString(36).slice(2, 10)}`,
    quantity,
    addedAt: isoDaysAgo(opts?.addedDays ?? 0, 9),
    ...(opts?.expiryDays != null ? { expiryDate: DATE_IN_DAYS(opts.expiryDays) } : {}),
    ...(opts?.roastDays != null ? { roastDate: DATE_IN_DAYS(-opts.roastDays) } : {}),
  });

  db.items = [
    // Ingredients
    item({
      id: 'it_beans', name: 'House Espresso Beans', categoryId: 'cat_ingredients', stationId: 'st_storage',
      sku: 'BEAN-HSE', description: 'Single-origin dark roast, 1kg bags.', soldBy: 'volume',
      price: 0, cost: 1.8, lowStockThreshold: 500,
      stockBatches: [
        batch(1200, { roastDays: 10, addedDays: 10 }),
        batch(600, { roastDays: 25, addedDays: 25 }),
        batch(200, { roastDays: 80, addedDays: 80 }),
      ],
    }),
    item({
      id: 'it_milk', name: 'Whole Milk', categoryId: 'cat_ingredients', stationId: 'st_storage',
      sku: 'MILK-WHL', description: 'Fresh whole milk.', soldBy: 'volume',
      price: 0, cost: 0.85, lowStockThreshold: 1000,
      stockBatches: [
        batch(2000, { expiryDays: 3, addedDays: 3 }),
        batch(4000, { expiryDays: 20, addedDays: 20 }),
      ],
    }),
    item({
      id: 'it_syrup', name: 'Chocolate Syrup', categoryId: 'cat_ingredients', stationId: 'st_storage',
      sku: 'SYRUP-CHO', soldBy: 'volume', price: 0, cost: 2.5, lowStockThreshold: 100,
      stockBatches: [batch(800, { expiryDays: 60, addedDays: 12 })],
    }),
    item({
      id: 'it_matcha', name: 'Matcha Powder', categoryId: 'cat_ingredients', stationId: 'st_storage',
      sku: 'MATCHA-CER', soldBy: 'volume', price: 0, cost: 12, lowStockThreshold: 50,
      stockBatches: [batch(300, { expiryDays: 75, addedDays: 15 })],
    }),
    // Packaging
    item({
      id: 'it_cup', name: '12oz Cup', categoryId: 'cat_packaging', stationId: 'st_storage',
      sku: 'CUP-12', itemType: 'packaging', price: 0, cost: 450, lowStockThreshold: 200,
      stockBatches: [batch(150, { addedDays: 2 })],
    }),
    item({
      id: 'it_lid', name: 'Cup Lid', categoryId: 'cat_packaging', stationId: 'st_storage',
      sku: 'LID-12', itemType: 'packaging', price: 0, cost: 200, lowStockThreshold: 300,
      stockBatches: [batch(800, { addedDays: 12 }), batch(500, { addedDays: 4 })],
    }),
    item({
      id: 'it_box', name: 'Pastry Box', categoryId: 'cat_packaging', stationId: 'st_storage',
      sku: 'BOX-PST', itemType: 'packaging', price: 0, cost: 1200, lowStockThreshold: 20,
      stockBatches: [batch(15, { addedDays: 6 })],
    }),
    // Espresso drinks (composites)
    item({
      id: 'it_cappuccino', name: 'Cappuccino', categoryId: 'cat_espresso', subcategoryId: 'sub_hot', stationId: 'st_bar',
      sku: 'DRK-CAP', description: 'Double shot with steamed milk.', itemType: 'beverage',
      isSellable: true, price: 16500, cost: 3900, inventoryType: 'composite', trackStock: false,
      components: [
        { itemId: 'it_beans', quantity: 18 },
        { itemId: 'it_milk', quantity: 160 },
        { itemId: 'it_cup', quantity: 1 },
        { itemId: 'it_lid', quantity: 1 },
      ],
      yield: 1, taxIds: ['tax_vat'], posColor: '#B4552D',
    }),
    item({
      id: 'it_latte', name: 'Caffè Latte', categoryId: 'cat_espresso', subcategoryId: 'sub_hot', stationId: 'st_bar',
      sku: 'DRK-LAT', description: 'Double shot with silky milk.', itemType: 'beverage',
      isSellable: true, price: 17500, cost: 4200, inventoryType: 'composite', trackStock: false,
      components: [
        { itemId: 'it_beans', quantity: 18 },
        { itemId: 'it_milk', quantity: 220 },
        { itemId: 'it_cup', quantity: 1 },
        { itemId: 'it_lid', quantity: 1 },
      ],
      yield: 1, taxIds: ['tax_vat'], posColor: '#A0622D',
    }),
    item({
      id: 'it_icedlatte', name: 'Iced Latte', categoryId: 'cat_espresso', subcategoryId: 'sub_iced', stationId: 'st_bar',
      sku: 'DRK-ILAT', itemType: 'beverage', isSellable: true, price: 18000, cost: 4100,
      inventoryType: 'composite', trackStock: false,
      components: [
        { itemId: 'it_beans', quantity: 18 },
        { itemId: 'it_milk', quantity: 160 },
        { itemId: 'it_cup', quantity: 1 },
        { itemId: 'it_lid', quantity: 1 },
      ],
      yield: 1, taxIds: ['tax_vat'], posColor: '#7C5A3C',
    }),
    item({
      id: 'it_americano', name: 'Americano', categoryId: 'cat_espresso', subcategoryId: 'sub_hot', stationId: 'st_bar',
      sku: 'DRK-AME', itemType: 'beverage', isSellable: true, price: 14000, cost: 2900,
      inventoryType: 'composite', trackStock: false,
      components: [
        { itemId: 'it_beans', quantity: 18 },
        { itemId: 'it_cup', quantity: 1 },
        { itemId: 'it_lid', quantity: 1 },
      ],
      yield: 1, taxIds: ['tax_vat'], posColor: '#5A4632',
    }),
    item({
      id: 'it_matchalatte', name: 'Matcha Latte', categoryId: 'cat_espresso', subcategoryId: 'sub_hot', stationId: 'st_bar',
      sku: 'DRK-MAT', itemType: 'beverage', isSellable: true, price: 19000, cost: 5200,
      inventoryType: 'composite', trackStock: false,
      components: [
        { itemId: 'it_matcha', quantity: 12 },
        { itemId: 'it_milk', quantity: 200 },
        { itemId: 'it_cup', quantity: 1 },
        { itemId: 'it_lid', quantity: 1 },
      ],
      yield: 1, taxIds: ['tax_vat'], posColor: '#6B8E5A',
    }),
    item({
      id: 'it_hotchoc', name: 'Hot Chocolate', categoryId: 'cat_espresso', subcategoryId: 'sub_hot', stationId: 'st_bar',
      sku: 'DRK-HCH', itemType: 'beverage', isSellable: true, price: 17000, cost: 4400,
      inventoryType: 'composite', trackStock: false,
      components: [
        { itemId: 'it_syrup', quantity: 30 },
        { itemId: 'it_milk', quantity: 220 },
        { itemId: 'it_cup', quantity: 1 },
        { itemId: 'it_lid', quantity: 1 },
      ],
      yield: 1, taxIds: ['tax_vat'], posColor: '#8A5A3C',
    }),
    // Cold drinks
    item({
      id: 'it_coldbrew', name: 'Cold Brew', categoryId: 'cat_cold', subcategoryId: 'sub_bottled', stationId: 'st_bar',
      sku: 'DRK-CB', itemType: 'beverage', isSellable: true, price: 22000, cost: 9500,
      lowStockThreshold: 10, taxIds: ['tax_vat'], posColor: '#3E4A5C',
      stockBatches: [batch(24, { expiryDays: 30, addedDays: 25 })],
    }),
    item({
      id: 'it_water', name: 'Still Water', categoryId: 'cat_cold', subcategoryId: 'sub_bottled', stationId: 'st_bar',
      sku: 'DRK-WTR', itemType: 'beverage', isSellable: true, price: 3500, cost: 1500,
      lowStockThreshold: 12, posColor: '#4C7C99',
      stockBatches: [batch(48, { addedDays: 9 })],
    }),
    // Pastries & food
    item({
      id: 'it_croissant', name: 'Butter Croissant', categoryId: 'cat_pastries', subcategoryId: 'sub_sweet', stationId: 'st_kitchen',
      sku: 'FOD-CRO', itemType: 'food', isSellable: true, price: 9500, cost: 4200,
      lowStockThreshold: 6, taxIds: ['tax_vat'], posColor: '#C29B3C',
      stockBatches: [batch(12, { expiryDays: 2, addedDays: 2 })],
    }),
    item({
      id: 'it_muffin', name: 'Blueberry Muffin', categoryId: 'cat_pastries', subcategoryId: 'sub_sweet', stationId: 'st_kitchen',
      sku: 'FOD-MUF', itemType: 'food', isSellable: true, price: 8500, cost: 3800,
      lowStockThreshold: 8, taxIds: ['tax_vat'], posColor: '#8E6BB0',
      stockBatches: [],
    }),
    item({
      id: 'it_sandwich', name: 'Ham & Cheese Sandwich', categoryId: 'cat_pastries', subcategoryId: 'sub_savory', stationId: 'st_kitchen',
      sku: 'FOD-HAM', itemType: 'food', isSellable: true, price: 14500, cost: 6500,
      lowStockThreshold: 6, taxIds: ['tax_vat'], posColor: '#B0755A',
      stockBatches: [batch(4, { expiryDays: 1, addedDays: 1 })],
    }),
  ];

  // ---- Stock receipts history ----
  const receipt = (
    itemId: string, itemName: string, quantity: number, daysAgo: number,
    batchDate?: string, batchDateType?: 'expiry' | 'roast'
  ): StockReceipt => ({
    id: `srec_seed_${db.stockReceipts.length + 1}`,
    date: isoDaysAgo(daysAgo, 8),
    itemId, itemName, quantity,
    unit: db.items.find((i) => i.id === itemId)?.soldBy === 'volume' ? 'g/ml' : 'units',
    batchId: `batch_seed_${db.stockReceipts.length + 1}`,
    batchDate, batchDateType,
    userId: 'user_stock', userName: 'Sam Dela Cruz',
  });

  db.stockReceipts = [
    receipt('it_beans', 'House Espresso Beans', 1200, 10, DATE_IN_DAYS(-10), 'roast'),
    receipt('it_beans', 'House Espresso Beans', 600, 25, DATE_IN_DAYS(-25), 'roast'),
    receipt('it_milk', 'Whole Milk', 4000, 20, DATE_IN_DAYS(20), 'expiry'),
    receipt('it_milk', 'Whole Milk', 2000, 3, DATE_IN_DAYS(3), 'expiry'),
    receipt('it_cup', '12oz Cup', 150, 2),
    receipt('it_lid', 'Cup Lid', 800, 12),
    receipt('it_lid', 'Cup Lid', 500, 4),
    receipt('it_box', 'Pastry Box', 15, 6),
    receipt('it_coldbrew', 'Cold Brew', 24, 25, DATE_IN_DAYS(30), 'expiry'),
    receipt('it_croissant', 'Butter Croissant', 24, 2, DATE_IN_DAYS(2), 'expiry'),
    receipt('it_sandwich', 'Ham & Cheese Sandwich', 6, 1, DATE_IN_DAYS(1), 'expiry'),
    receipt('it_water', 'Still Water', 48, 9),
  ];

  // ---- Waste events ----
  const waste = (
    itemId: string, itemName: string, quantity: number, cost: number, daysAgo: number,
    reason: string, eventType: 'waste' | 'pull-out', hour = 10
  ): WasteEvent => ({
    id: `waste_seed_${db.wasteEvents.length + 1}`,
    date: isoDaysAgo(daysAgo, hour),
    itemId, itemName, quantity, cost,
    unit: db.items.find((i) => i.id === itemId)?.soldBy === 'volume' ? 'g/ml' : 'units',
    reason, eventType,
    userId: 'user_stock', userName: 'Sam Dela Cruz',
  });

  db.wasteEvents = [
    waste('it_croissant', 'Butter Croissant', 3, 12600, 2, 'Expired batch'),
    waste('it_milk', 'Whole Milk', 250, 213, 5, 'Spilt during prep'),
    waste('it_beans', 'House Espresso Beans', 50, 90, 3, 'Quality testing', 'pull-out'),
    waste('it_cup', '12oz Cup', 10, 4500, 1, 'Damaged in delivery'),
    waste('it_syrup', 'Chocolate Syrup', 40, 100, 8, 'Batch contaminated'),
    waste('it_sandwich', 'Ham & Cheese Sandwich', 2, 13000, 0, 'Wrong order remade', 'waste', 14),
  ];

  // ---- Sales history (last 14 days) ----
  const menu = [
    'it_cappuccino', 'it_latte', 'it_cappuccino', 'it_americano', 'it_icedlatte',
    'it_matchalatte', 'it_latte', 'it_hotchoc', 'it_coldbrew', 'it_water',
    'it_croissant', 'it_croissant', 'it_muffin', 'it_sandwich',
  ];
  const sellers = [
    { userId: 'user_admin', userName: 'Ava Reyes' },
    { userId: 'user_cashier', userName: 'Lena Tan' },
    { userId: 'user_manager', userName: 'Marco Lim' },
  ];

  for (let d = 13; d >= 1; d--) {
    const count = 3 + Math.floor(rand() * 5);
    for (let s = 0; s < count; s++) {
      const lineCount = 1 + Math.floor(rand() * 3);
      const lines = Array.from({ length: lineCount }, () => ({
        itemId: menu[Math.floor(rand() * menu.length)],
        quantity: 1 + Math.floor(rand() * 2),
        ...(rand() < 0.15 ? { discount: { type: 'percent' as const, value: 10 } } : {}),
      }));
      const takeAway = rand() < 0.2;
      const seller = sellers[Math.floor(rand() * sellers.length)];
      createSale(
        db,
        {
          lines,
          ...(rand() < 0.1 ? { discount: { type: 'percent' as const, value: 5 } } : {}),
          deliveryFee: takeAway && rand() < 0.5 ? 4900 : 0,
          saleType: takeAway ? 'take-away' : 'dine-in',
          userId: seller.userId,
          userName: seller.userName,
        },
        { status: 'completed', date: isoDaysAgo(d, 8 + Math.floor(rand() * 11)), skipStockDeduct: true }
      );
    }
  }

  // Today's tickets: a live KDS queue plus completed sales
  const todayLines = (ids: string[]) => ids.map((itemId) => ({ itemId, quantity: 1 }));
  const mkSale = (
    ids: string[], status: 'completed' | 'preparing' | 'pending', hour: number,
    extra?: { discount?: { type: 'percent'; value: number }; saleType?: 'dine-in' | 'take-away' }
  ) =>
    createSale(
      db,
      {
        lines: todayLines(ids),
        ...extra,
        deliveryFee: extra?.saleType === 'take-away' ? 4900 : 0,
        saleType: extra?.saleType ?? 'dine-in',
        userId: 'user_cashier',
        userName: 'Lena Tan',
      },
      { status, date: isoDaysAgo(0, hour), skipStockDeduct: true }
    );

  mkSale(['it_cappuccino', 'it_croissant'], 'completed', 8);
  mkSale(['it_latte', 'it_sandwich'], 'completed', 9);
  mkSale(['it_icedlatte', 'it_icedlatte', 'it_coldbrew'], 'preparing', 10);
  mkSale(['it_cappuccino', 'it_muffin'], 'pending', 10, { saleType: 'take-away' });
  mkSale(['it_americano', 'it_water'], 'pending', 11);

  return db;
}
