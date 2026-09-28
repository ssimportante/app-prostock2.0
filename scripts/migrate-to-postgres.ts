import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const EXPORTS_DIR = path.join(__dirname, '..', 'migration', 'exports');

function readJson<T>(filename: string): T[] {
  const filePath = path.join(EXPORTS_DIR, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// Convert Firestore Timestamp object to ISO string
function convertTimestamp(val: any): Date {
  if (!val) return new Date();
  if (val.__type === 'timestamp' && val.value) {
    return new Date(val.value);
  }
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return new Date();
}

async function main() {
  console.log('Starting migration to PostgreSQL...');

  // 1. Settings
  console.log('Migrating settings...');
  const settings = readJson<any>('settings.json');
  for (const s of settings) {
    await prisma.settings.upsert({
      where: { id: s.id || 'pos' },
      update: {
        defaultSaleType: s.defaultSaleType || 'dine-in',
        currency: s.currency || 'USD',
      },
      create: {
        id: s.id || 'pos',
        defaultSaleType: s.defaultSaleType || 'dine-in',
        currency: s.currency || 'USD',
      },
    });
  }
  console.log(`  Migrated ${settings.length} settings`);

  // 2. Categories
  console.log('Migrating categories...');
  const categories = readJson<any>('categories.json');
  for (const c of categories) {
    await prisma.category.create({
      data: {
        id: c.id,
        name: c.name || '',
        itemCount: c.itemCount ?? 0,
        color: c.color || '',
      },
    }).catch(() => {});
  }
  console.log(`  Migrated ${categories.length} categories`);

  // 3. Subcategories
  console.log('Migrating subcategories...');
  const subcategories = readJson<any>('subcategories.json');
  for (const s of subcategories) {
    await prisma.subcategory.create({
      data: {
        id: s.id,
        name: s.name || '',
        categoryId: s.categoryId || '',
      },
    }).catch(() => {});
  }
  console.log(`  Migrated ${subcategories.length} subcategories`);

  // 4. Stations
  console.log('Migrating stations...');
  const stations = readJson<any>('stations.json');
  for (const s of stations) {
    await prisma.station.create({
      data: {
        id: s.id,
        name: s.name || '',
      },
    }).catch(() => {});
  }
  console.log(`  Migrated ${stations.length} stations`);

  // 5. Taxes
  console.log('Migrating taxes...');
  const taxes = readJson<any>('taxes.json');
  for (const t of taxes) {
    await prisma.tax.create({
      data: {
        id: t.id,
        name: t.name || '',
        rate: Number(t.rate) || 0,
        taxType: t.taxType ?? null,
      },
    }).catch(() => {});
  }
  console.log(`  Migrated ${taxes.length} taxes`);

  // 6. Staff
  console.log('Migrating staff...');
  const staff = readJson<any>('staff.json');
  for (const s of staff) {
    await prisma.staff.create({
      data: {
        id: s.id,
        name: s.name || '',
      },
    }).catch(() => {});
  }
  console.log(`  Migrated ${staff.length} staff`);

  // 7. Users (with bcrypt-hashed default passwords)
  console.log('Migrating users...');
  const bcrypt = require('bcryptjs');
  const users = readJson<any>('users.json');
  for (const u of users) {
    const passwordHash = await bcrypt.hash('password', 10);
    await prisma.user.create({
      data: {
        id: u.id || u.uid,
        uid: u.uid || u.id,
        email: u.email ?? null,
        name: u.name ?? null,
        photoURL: u.photoURL ?? null,
        role: u.role || 'user',
        passwordHash,
      },
    }).catch(() => {});
  }
  console.log(`  Migrated ${users.length} users`);

  // 8. Items
  console.log('Migrating items...');
  const items = readJson<any>('items.json');
  for (const item of items) {
    await prisma.item.create({
      data: {
        id: item.id,
        name: item.name || '',
        description: item.description || '',
        categoryId: item.categoryId || '',
        subcategoryId: item.subcategoryId ?? null,
        stationId: item.stationId ?? null,
        sku: item.sku || '',
        barcode: item.barcode || '',
        isSellable: item.isSellable ?? false,
        saleType: item.saleType ?? null,
        itemType: item.itemType ?? null,
        beverageSize: item.beverageSize ?? null,
        soldBy: item.soldBy || 'each',
        price: Number(item.price) || 0,
        cost: Number(item.cost) || 0,
        marketPrice: item.marketPrice != null ? Number(item.marketPrice) : null,
        purchaseQuantity: item.purchaseQuantity != null ? Number(item.purchaseQuantity) : null,
        inventoryType: item.inventoryType || 'simple',
        trackStock: item.trackStock ?? false,
        stockBatches: item.stockBatches || [],
        lowStockThreshold: Number(item.lowStockThreshold) || 0,
        components: item.components || [],
        yield: item.yield != null ? Number(item.yield) : null,
        tags: item.tags || [],
        taxIds: item.taxIds || [],
        posRepresentationType: item.posRepresentationType || 'color',
        posColor: item.posColor || '#cccccc',
        posShape: item.posShape || 'square',
        imageUrl: item.imageUrl || '',
      },
    }).catch((e) => {
      console.error(`  Failed to migrate item ${item.id}:`, e.message);
    });
  }
  console.log(`  Migrated ${items.length} items`);

  // 9. Sales
  console.log('Migrating sales...');
  const sales = readJson<any>('sales.json');
  for (const sale of sales) {
    await prisma.sale.create({
      data: {
        id: sale.id,
        date: convertTimestamp(sale.date),
        total: Number(sale.total) || 0,
        subtotal: sale.subtotal != null ? Number(sale.subtotal) : null,
        deliveryFee: sale.deliveryFee != null ? Number(sale.deliveryFee) : null,
        discount: sale.discount ?? null,
        userId: sale.userId ?? null,
        status: sale.status ?? 'pending',
        ticketNumber: sale.ticketNumber ?? null,
        completedAt: sale.completedAt ? convertTimestamp(sale.completedAt) : null,
        items: sale.items || [],
      },
    }).catch((e) => {
      console.error(`  Failed to migrate sale ${sale.id}:`, e.message);
    });
  }
  console.log(`  Migrated ${sales.length} sales`);

  // 10. Stock Receipts
  console.log('Migrating stock receipts...');
  const stockReceipts = readJson<any>('stockReceipts.json');
  for (const r of stockReceipts) {
    await prisma.stockReceipt.create({
      data: {
        id: r.id,
        date: convertTimestamp(r.date),
        userId: r.userId || '',
        itemId: r.itemId || '',
        itemName: r.itemName || '',
        quantity: Number(r.quantity) || 0,
        unit: r.unit || 'units',
        batchId: r.batchId || '',
        batchDetails: r.batchDetails ?? null,
        recordedByName: r.recordedByName ?? null,
      },
    }).catch((e) => {
      console.error(`  Failed to migrate receipt ${r.id}:`, e.message);
    });
  }
  console.log(`  Migrated ${stockReceipts.length} stock receipts`);

  // 11. Waste Events
  console.log('Migrating waste events...');
  const wasteEvents = readJson<any>('wasteEvents.json');
  for (const w of wasteEvents) {
    await prisma.wasteEvent.create({
      data: {
        id: w.id,
        date: convertTimestamp(w.date),
        itemId: w.itemId || '',
        itemName: w.itemName || '',
        quantity: Number(w.quantity) || 0,
        cost: Number(w.cost) || 0,
        unit: w.unit || 'units',
        userId: w.userId || '',
        recordedByName: w.recordedByName || '',
        batchId: w.batchId ?? null,
        reason: w.reason || '',
        eventType: w.eventType || 'waste',
      },
    }).catch((e) => {
      console.error(`  Failed to migrate waste event ${w.id}:`, e.message);
    });
  }
  console.log(`  Migrated ${wasteEvents.length} waste events`);

  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
