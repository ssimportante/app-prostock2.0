import { PrismaClient } from '@prisma/client';
import { createHmac, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters long');
  }
  const hash = createHmac('sha256', salt + secret).update(password).digest('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Seeding database...');

  // Users
  const users = [
    { email: 'admin@beanespress.com', name: 'Admin', role: 'admin' },
    { email: 'stockman@beanespress.com', name: 'Stock Manager', role: 'stock-manager' },
    { email: 'kitchen@beanespress.com', name: 'Kitchen User', role: 'kitchen-user' },
    { email: 'bar@beanespress.com', name: 'Bar User', role: 'bar-user' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash: hashPassword('password'), mustChangePassword: true },
      update: {},
    });
  }
  console.log('Users seeded');

  // Categories
  const categories = [
    { id: 'cat-coffee', name: 'Coffee', color: '#92400e', itemCount: 0 },
    { id: 'cat-food', name: 'Food', color: '#059669', itemCount: 0 },
    { id: 'cat-beverage', name: 'Beverage', color: '#2563eb', itemCount: 0 },
    { id: 'cat-ingredient', name: 'Ingredient', color: '#7c3aed', itemCount: 0 },
    { id: 'cat-packaging', name: 'Packaging', color: '#64748b', itemCount: 0 },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      create: c,
      update: {},
    });
  }
  console.log('Categories seeded');

  // Subcategories
  const subcategories = [
    { id: 'sub-espresso', name: 'Espresso Based', categoryId: 'cat-coffee' },
    { id: 'sub-drip', name: 'Drip Coffee', categoryId: 'cat-coffee' },
    { id: 'sub-cold', name: 'Cold Brew', categoryId: 'cat-coffee' },
    { id: 'sub-sandwich', name: 'Sandwiches', categoryId: 'cat-food' },
    { id: 'sub-pastry', name: 'Pastries', categoryId: 'cat-food' },
    { id: 'sub-tea', name: 'Tea', categoryId: 'cat-beverage' },
    { id: 'sub-beans', name: 'Coffee Beans', categoryId: 'cat-ingredient' },
    { id: 'sub-cups', name: 'Cups', categoryId: 'cat-packaging' },
  ];

  for (const s of subcategories) {
    await prisma.subcategory.upsert({
      where: { id: s.id },
      create: s,
      update: {},
    });
  }
  console.log('Subcategories seeded');

  // Stations
  const stations = [
    { id: 'stn-kitchen', name: 'Kitchen' },
    { id: 'stn-bar', name: 'Bar' },
  ];

  for (const s of stations) {
    await prisma.station.upsert({
      where: { id: s.id },
      create: s,
      update: {},
    });
  }
  console.log('Stations seeded');

  // Taxes
  const taxes = [
    { id: 'tax-vat', name: 'VAT', rate: 12, taxType: 'additive' },
  ];

  for (const t of taxes) {
    await prisma.tax.upsert({
      where: { id: t.id },
      create: t,
      update: {},
    });
  }
  console.log('Taxes seeded');

  // Settings
  await prisma.setting.upsert({
    where: { id: 'pos' },
    create: { id: 'pos', data: { defaultSaleType: 'dine-in', currency: 'PHP' } },
    update: {},
  });
  console.log('Settings seeded');

  // Items — sellable products
  const items = [
    {
      id: 'item-cappuccino',
      name: 'Cappuccino',
      description: 'Classic espresso with steamed milk and foam',
      categoryId: 'cat-coffee',
      subcategoryId: 'sub-espresso',
      stationId: 'stn-bar',
      sku: 'CAP-001',
      barcode: '',
      isSellable: true,
      saleType: null,
      itemType: 'beverage',
      beverageSize: 'regular',
      soldBy: 'each',
      price: 150,
      cost: 45,
      inventoryType: 'simple',
      trackStock: true,
      stockBatches: [{ id: 'batch-1', quantity: 0, purchaseDate: '2026-09-01', expiryDate: '2026-12-01' }],
      lowStockThreshold: 20,
      components: [],
      yield: null,
      tags: ['bestseller'],
      taxIds: ['tax-vat'],
      posRepresentationType: 'color',
      posColor: '#92400e',
      posShape: 'rounded',
      imageUrl: '',
    },
    {
      id: 'item-latte',
      name: 'Caffe Latte',
      description: 'Espresso with steamed milk',
      categoryId: 'cat-coffee',
      subcategoryId: 'sub-espresso',
      stationId: 'stn-bar',
      sku: 'LAT-001',
      barcode: '',
      isSellable: true,
      saleType: null,
      itemType: 'beverage',
      beverageSize: 'regular',
      soldBy: 'each',
      price: 160,
      cost: 50,
      inventoryType: 'simple',
      trackStock: true,
      stockBatches: [{ id: 'batch-2', quantity: 0, purchaseDate: '2026-09-01', expiryDate: '2026-12-01' }],
      lowStockThreshold: 20,
      components: [],
      yield: null,
      tags: [],
      taxIds: ['tax-vat'],
      posRepresentationType: 'color',
      posColor: '#a78b6f',
      posShape: 'rounded',
      imageUrl: '',
    },
    {
      id: 'item-coldbrew',
      name: 'Cold Brew',
      description: 'Smooth cold brewed coffee',
      categoryId: 'cat-coffee',
      subcategoryId: 'sub-cold',
      stationId: 'stn-bar',
      sku: 'CB-001',
      barcode: '',
      isSellable: true,
      saleType: null,
      itemType: 'beverage',
      beverageSize: 'regular',
      soldBy: 'each',
      price: 180,
      cost: 55,
      inventoryType: 'simple',
      trackStock: true,
      stockBatches: [{ id: 'batch-3', quantity: 0, purchaseDate: '2026-09-01', expiryDate: '2026-12-01' }],
      lowStockThreshold: 15,
      components: [],
      yield: null,
      tags: [],
      taxIds: ['tax-vat'],
      posRepresentationType: 'color',
      posColor: '#1c1917',
      posShape: 'rounded',
      imageUrl: '',
    },
    {
      id: 'item-croissant',
      name: 'Butter Croissant',
      description: 'Flaky butter croissant',
      categoryId: 'cat-food',
      subcategoryId: 'sub-pastry',
      stationId: 'stn-kitchen',
      sku: 'CRO-001',
      barcode: '',
      isSellable: true,
      saleType: null,
      itemType: 'food',
      beverageSize: null,
      soldBy: 'each',
      price: 120,
      cost: 40,
      inventoryType: 'simple',
      trackStock: true,
      stockBatches: [{ id: 'batch-4', quantity: 0, purchaseDate: '2026-09-20', expiryDate: '2026-09-28' }],
      lowStockThreshold: 10,
      components: [],
      yield: null,
      tags: [],
      taxIds: ['tax-vat'],
      posRepresentationType: 'color',
      posColor: '#f59e0b',
      posShape: 'rounded',
      imageUrl: '',
    },
    {
      id: 'item-sandwich',
      name: 'Club Sandwich',
      description: 'Classic club sandwich',
      categoryId: 'cat-food',
      subcategoryId: 'sub-sandwich',
      stationId: 'stn-kitchen',
      sku: 'SND-001',
      barcode: '',
      isSellable: true,
      saleType: null,
      itemType: 'food',
      beverageSize: null,
      soldBy: 'each',
      price: 220,
      cost: 80,
      inventoryType: 'simple',
      trackStock: true,
      stockBatches: [{ id: 'batch-5', quantity: 0, purchaseDate: '2026-09-20', expiryDate: '2026-09-28' }],
      lowStockThreshold: 10,
      components: [],
      yield: null,
      tags: [],
      taxIds: ['tax-vat'],
      posRepresentationType: 'color',
      posColor: '#059669',
      posShape: 'rounded',
      imageUrl: '',
    },
    {
      id: 'item-green-tea',
      name: 'Green Tea',
      description: 'Refreshing green tea',
      categoryId: 'cat-beverage',
      subcategoryId: 'sub-tea',
      stationId: 'stn-bar',
      sku: 'TEA-001',
      barcode: '',
      isSellable: true,
      saleType: null,
      itemType: 'beverage',
      beverageSize: 'regular',
      soldBy: 'each',
      price: 100,
      cost: 20,
      inventoryType: 'simple',
      trackStock: true,
      stockBatches: [{ id: 'batch-6', quantity: 0, purchaseDate: '2026-09-01', expiryDate: '2027-01-01' }],
      lowStockThreshold: 15,
      components: [],
      yield: null,
      tags: [],
      taxIds: ['tax-vat'],
      posRepresentationType: 'color',
      posColor: '#22c55e',
      posShape: 'rounded',
      imageUrl: '',
    },
    // Ingredients (not sellable, for composite items)
    {
      id: 'item-beans',
      name: 'Coffee Beans',
      description: 'Whole coffee beans',
      categoryId: 'cat-ingredient',
      subcategoryId: 'sub-beans',
      stationId: null,
      sku: 'ING-BEANS',
      barcode: '',
      isSellable: false,
      saleType: null,
      itemType: null,
      beverageSize: null,
      soldBy: 'volume',
      price: 0,
      cost: 800,
      inventoryType: 'simple',
      trackStock: true,
      stockBatches: [{ id: 'batch-beans-1', quantity: 0, purchaseDate: '2026-09-01', expiryDate: '2026-12-01' }],
      lowStockThreshold: 500,
      components: [],
      yield: null,
      tags: [],
      taxIds: [],
      posRepresentationType: 'color',
      posColor: '#451a03',
      posShape: 'rounded',
      imageUrl: '',
    },
    {
      id: 'item-milk',
      name: 'Fresh Milk',
      description: 'Fresh whole milk',
      categoryId: 'cat-ingredient',
      subcategoryId: null,
      stationId: null,
      sku: 'ING-MILK',
      barcode: '',
      isSellable: false,
      saleType: null,
      itemType: null,
      beverageSize: null,
      soldBy: 'volume',
      price: 0,
      cost: 120,
      inventoryType: 'simple',
      trackStock: true,
      stockBatches: [{ id: 'batch-milk-1', quantity: 0, purchaseDate: '2026-09-25', expiryDate: '2026-10-02' }],
      lowStockThreshold: 1000,
      components: [],
      yield: null,
      tags: [],
      taxIds: [],
      posRepresentationType: 'color',
      posColor: '#f8fafc',
      posShape: 'rounded',
      imageUrl: '',
    },
    // Packaging
    {
      id: 'item-cup-small',
      name: '8oz Cup',
      description: '8oz paper cup',
      categoryId: 'cat-packaging',
      subcategoryId: 'sub-cups',
      stationId: null,
      sku: 'PKG-CUP8',
      barcode: '',
      isSellable: false,
      saleType: null,
      itemType: 'packaging',
      beverageSize: null,
      soldBy: 'each',
      price: 0,
      cost: 3,
      inventoryType: 'simple',
      trackStock: true,
      stockBatches: [{ id: 'batch-cup-1', quantity: 0, purchaseDate: '2026-09-01' }],
      lowStockThreshold: 100,
      components: [],
      yield: null,
      tags: [],
      taxIds: [],
      posRepresentationType: 'color',
      posColor: '#e2e8f0',
      posShape: 'rounded',
      imageUrl: '',
    },
  ];

  for (const item of items) {
    await prisma.item.upsert({
      where: { id: item.id },
      create: item,
      update: {},
    });
  }
  console.log('Items seeded');

  // Update category item counts
  for (const c of categories) {
    const count = items.filter(i => i.categoryId === c.id).length;
    await prisma.category.update({ where: { id: c.id }, data: { itemCount: count } });
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
