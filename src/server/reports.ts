import { addMonths, format, isAfter, isSameDay, startOfDay, subDays } from 'date-fns';
import type { DbData } from './db';
import type {
  CategoryDistEntry,
  ExpiringEntry,
  LowStockEntry,
  MovementBreakdown,
  ReportsSummary,
  SalesByDayEntry,
  TopItemEntry,
  WasteByItemEntry,
} from '@/lib/types';
import { round3 } from '@/lib/money';

const roundMovement = (m: MovementBreakdown): MovementBreakdown => ({
  stock: Math.round(m.stock),
  consumed: Math.round(m.consumed),
  waste: Math.round(m.waste),
  pullOut: Math.round(m.pullOut),
});

export function buildSummary(db: DbData): ReportsSummary {
  const { items, sales, wasteEvents, categories } = db;
  const now = new Date();

  const ingredientCategoryId = categories.find((c) =>
    ['ingredient', 'ingredients'].includes(c.name.toLowerCase())
  )?.id;
  const packagingCategoryId = categories.find(
    (c) => c.name.toLowerCase() === 'packaging'
  )?.id;

  // ---- Stock values, low stock & expiring ----
  let totalStockValue = 0;
  let ingredientStockValue = 0;
  let packagingStockValue = 0;
  const lowStock: LowStockEntry[] = [];
  const expiring: ExpiringEntry[] = [];
  const expiringThreshold = addMonths(now, 3);

  for (const item of items) {
    if (!item.trackStock) continue;
    const stock = (item.stockBatches ?? []).reduce((s, b) => s + Number(b.quantity || 0), 0);
    const value = Math.round(stock * item.cost);
    totalStockValue += value;
    if (item.categoryId === ingredientCategoryId) ingredientStockValue += value;
    if (item.categoryId === packagingCategoryId) packagingStockValue += value;
    const unit = item.soldBy === 'volume' ? 'g/ml' : 'units';
    if (item.lowStockThreshold > 0 && stock <= item.lowStockThreshold) {
      lowStock.push({ id: item.id, name: item.name, stock: round3(stock), threshold: item.lowStockThreshold, unit });
    }
    for (const batch of item.stockBatches ?? []) {
      let effective: Date | null = null;
      if (batch.expiryDate) effective = new Date(batch.expiryDate);
      else if (batch.roastDate) effective = addMonths(new Date(batch.roastDate), 3);
      if (effective && isAfter(effective, now) && isAfter(expiringThreshold, effective)) {
        expiring.push({
          itemName: item.name,
          quantity: round3(Number(batch.quantity || 0)),
          effectiveExpiry: effective.toISOString(),
          unit,
        });
      }
    }
  }
  lowStock.sort((a, b) => a.stock - b.stock);
  expiring.sort((a, b) => new Date(a.effectiveExpiry).getTime() - new Date(b.effectiveExpiry).getTime());

  // ---- Revenue, COGS, consumption, movement ----
  const itemsMap = new Map(items.map((i) => [i.id, i]));
  const topMap = new Map<string, TopItemEntry>();
  const categoryRevenue = new Map<string, number>();
  let totalRevenue = 0;
  let totalCogs = 0;
  const movement = {
    ingredient: { stock: ingredientStockValue, consumed: 0, waste: 0, pullOut: 0 },
    packaging: { stock: packagingStockValue, consumed: 0, waste: 0, pullOut: 0 },
  };

  for (const sale of sales) {
    totalRevenue += sale.total || 0;
    for (const line of sale.items) {
      const item = itemsMap.get(line.itemId);
      if (!item) continue;
      const qty = line.quantity - (line.refundedQuantity ?? 0);
      if (qty <= 0) continue;
      const lineNet = line.price * qty - (line.discount?.amount ?? 0);

      const entry = topMap.get(line.name) ?? { name: line.name, revenue: 0, units: 0 };
      entry.revenue += lineNet;
      entry.units += qty;
      topMap.set(line.name, entry);

      categoryRevenue.set(item.categoryId, (categoryRevenue.get(item.categoryId) ?? 0) + lineNet);
      totalCogs += item.cost * qty;

      const process = (target: typeof item, multiplier: number) => {
        const v = target.cost * multiplier;
        if (target.categoryId === ingredientCategoryId) movement.ingredient.consumed += v;
        else if (target.categoryId === packagingCategoryId) movement.packaging.consumed += v;
      };
      if (item.inventoryType === 'composite') {
        for (const comp of item.components) {
          const c = itemsMap.get(comp.itemId);
          if (c) process(c, comp.quantity * (qty / (item.yield || 1)));
        }
      } else {
        process(item, qty);
      }
    }
  }

  // ---- Waste breakdowns ----
  let wasteValue = 0;
  let pullOutValue = 0;
  const wasteByItemMap = new Map<string, WasteByItemEntry>();
  for (const ev of wasteEvents) {
    if (ev.eventType === 'pull-out') pullOutValue += ev.cost;
    else wasteValue += ev.cost;

    const item = itemsMap.get(ev.itemId);
    const bucket: 'waste' | 'pullOut' = ev.eventType === 'pull-out' ? 'pullOut' : 'waste';
    if (item?.categoryId === ingredientCategoryId) movement.ingredient[bucket] += ev.cost;
    else if (item?.categoryId === packagingCategoryId) movement.packaging[bucket] += ev.cost;

    const entry = wasteByItemMap.get(ev.itemName) ?? { name: ev.itemName, waste: 0, pullOut: 0, total: 0, events: 0 };
    if (ev.eventType === 'pull-out') entry.pullOut += ev.cost;
    else entry.waste += ev.cost;
    entry.total += ev.cost;
    entry.events += 1;
    wasteByItemMap.set(ev.itemName, entry);
  }

  // ---- Sales by day (last 14) ----
  const salesByDay: SalesByDayEntry[] = [];
  for (let d = 13; d >= 0; d--) {
    const day = startOfDay(subDays(now, d));
    let revenue = 0;
    let orders = 0;
    for (const sale of sales) {
      if (isSameDay(new Date(sale.date), day)) {
        revenue += sale.total;
        orders += 1;
      }
    }
    salesByDay.push({ label: format(day, 'MMM d'), date: day.toISOString(), revenue, orders });
  }

  const topItems = [...topMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const categoryDist: CategoryDistEntry[] = [...categoryRevenue.entries()]
    .map(([id, value]) => {
      const cat = categories.find((c) => c.id === id);
      return { name: cat?.name ?? 'Other', value, color: cat?.color ?? '#B4552D' };
    })
    .sort((a, b) => b.value - a.value);

  return {
    kpis: {
      totalRevenue,
      totalCogs: Math.round(totalCogs),
      foodCostPercentage: totalRevenue > 0 ? (totalCogs / totalRevenue) * 100 : 0,
      totalStockValue,
      ingredientStockValue,
      packagingStockValue,
      wasteValue,
      pullOutValue,
      totalItems: items.length,
      ordersCount: sales.length,
      pendingCount: sales.filter((s) => s.status === 'pending').length,
      lowStockCount: lowStock.length,
      expiringCount: expiring.length,
    },
    salesByDay,
    lowStock: lowStock.slice(0, 8),
    expiring: expiring.slice(0, 8),
    topItems,
    categoryDist,
    movement: {
      ingredient: roundMovement(movement.ingredient),
      packaging: roundMovement(movement.packaging),
    },
    wasteByItem: [...wasteByItemMap.values()].sort((a, b) => b.total - a.total),
  };
}
