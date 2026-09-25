import type { DbData } from './db';
import type { AppUser, Item, StockBatch, StockReceipt, WasteEvent } from '@/lib/types';
import { round3 } from '@/lib/money';
import { newId } from './db';

export function totalStock(item: Item): number {
  return (item.stockBatches ?? []).reduce((sum, b) => sum + Number(b.quantity || 0), 0);
}

export function unitFor(item: Item): 'units' | 'g/ml' {
  return item.soldBy === 'volume' ? 'g/ml' : 'units';
}

/** FIFO key: earliest expiry, else earliest roast, else earliest added. */
function batchSortKey(b: StockBatch): number {
  const t = b.expiryDate
    ? new Date(b.expiryDate).getTime()
    : b.roastDate
      ? new Date(b.roastDate).getTime()
      : new Date(b.addedAt).getTime();
  return t;
}

/** Deducts stock from the item's batches (FIFO). Mutates the item. Returns the first batch touched. */
export function deductStock(db: DbData, itemId: string, quantity: number): string | undefined {
  const item = db.items.find((i) => i.id === itemId);
  if (!item || !item.trackStock || quantity <= 0) return undefined;
  let remaining = quantity;
  let firstTouched: string | undefined;
  const batches = [...(item.stockBatches ?? [])].sort((a, b) => batchSortKey(a) - batchSortKey(b));
  const left: StockBatch[] = [];
  for (const batch of batches) {
    if (remaining <= 0) {
      left.push(batch);
      continue;
    }
    if (!firstTouched) firstTouched = batch.id;
    const take = Math.min(Number(batch.quantity || 0), remaining);
    remaining -= take;
    const rest = round3(Number(batch.quantity || 0) - take);
    if (rest > 0) left.push({ ...batch, quantity: rest });
  }
  item.stockBatches = left;
  return firstTouched;
}

export function receiveStock(
  db: DbData,
  user: AppUser,
  input: { itemId: string; quantity: number; batchDate?: string; batchDateType?: 'expiry' | 'roast' }
): StockReceipt {
  const item = db.items.find((i) => i.id === input.itemId);
  if (!item) throw new Error('Item not found');
  if (!(Number(input.quantity) > 0)) throw new Error('Quantity must be positive');

  const batch: StockBatch = {
    id: newId('batch'),
    quantity: input.quantity,
    addedAt: new Date().toISOString(),
  };
  if (input.batchDate && input.batchDateType === 'expiry') batch.expiryDate = input.batchDate;
  if (input.batchDate && input.batchDateType === 'roast') batch.roastDate = input.batchDate;
  item.stockBatches.push(batch);

  const receipt: StockReceipt = {
    id: newId('srec'),
    date: new Date().toISOString(),
    itemId: item.id,
    itemName: item.name,
    quantity: input.quantity,
    unit: unitFor(item),
    batchId: batch.id,
    batchDate: input.batchDate,
    batchDateType: input.batchDateType,
    userId: user.id,
    userName: user.name,
  };
  db.stockReceipts.push(receipt);
  return receipt;
}

export function logWaste(
  db: DbData,
  user: AppUser,
  input: { itemId: string; quantity: number; reason: string; eventType: 'waste' | 'pull-out' }
): WasteEvent {
  const item = db.items.find((i) => i.id === input.itemId);
  if (!item) throw new Error('Item not found');
  if (!(Number(input.quantity) > 0)) throw new Error('Quantity must be positive');

  const cost = Math.round(item.cost * input.quantity);
  const batchId = item.trackStock ? deductStock(db, item.id, input.quantity) : undefined;
  const event: WasteEvent = {
    id: newId('waste'),
    date: new Date().toISOString(),
    itemId: item.id,
    itemName: item.name,
    quantity: input.quantity,
    cost,
    unit: unitFor(item),
    reason: input.reason?.trim() || (input.eventType === 'waste' ? 'Waste' : 'Pull-out'),
    eventType: input.eventType,
    userId: user.id,
    userName: user.name,
    batchId,
  };
  db.wasteEvents.push(event);
  return event;
}
