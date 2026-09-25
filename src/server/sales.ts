import type { DbData } from './db';
import { newId } from './db';
import { computeSaleMath } from '@/lib/checkout-math';
import type { LineInput, TicketDiscountInput } from '@/lib/checkout-math';
import type { Sale, SaleStatus, SaleType } from '@/lib/types';
import { deductStock, } from './stock';
import { round3 } from '@/lib/money';

export interface CreateSaleInput {
  lines: LineInput[];
  discount?: TicketDiscountInput;
  deliveryFee?: number;
  saleType: SaleType;
  userId: string;
  userName: string;
}

export function createSale(
  db: DbData,
  input: CreateSaleInput,
  opts?: { status?: SaleStatus; date?: string; skipStockDeduct?: boolean }
): Sale {
  if (!input.lines?.length) throw new Error('Cart is empty');
  for (const line of input.lines) {
    if (!db.items.some((i) => i.id === line.itemId)) {
      throw new Error('One of the items no longer exists');
    }
  }
  const math = computeSaleMath(input.lines, db.items, db.taxes, input.discount, input.deliveryFee ?? 0);
  if (!math.saleItems.length) throw new Error('Cart is empty');

  const status = opts?.status ?? 'pending';
  const date = opts?.date ?? new Date().toISOString();
  const sale: Sale = {
    id: newId('sale'),
    date,
    ticketNumber: ++db.ticketCounter,
    items: math.saleItems,
    subtotal: math.subtotal,
    deliveryFee: math.deliveryFee,
    discount:
      input.discount && input.discount.value > 0
        ? { type: input.discount.type, value: input.discount.value, amount: math.ticketDiscount }
        : undefined,
    tax: math.tax,
    total: math.total,
    status,
    saleType: input.saleType,
    userId: input.userId,
    userName: input.userName,
    completedAt: status === 'completed' ? date : null,
  };

  if (!opts?.skipStockDeduct) {
    for (const line of math.saleItems) {
      const item = db.items.find((i) => i.id === line.itemId)!;
      if (item.inventoryType === 'composite') {
        for (const comp of item.components) {
          deductStock(db, comp.itemId, round3((comp.quantity * line.quantity) / (item.yield || 1)));
        }
      } else {
        deductStock(db, line.itemId, line.quantity);
      }
    }
  }

  db.sales.push(sale);
  return sale;
}

/** Valid KDS/status transitions. */
export function canTransitionTo(from: SaleStatus, to: SaleStatus): boolean {
  if (from === to) return false;
  if (to === 'cancelled') return from === 'pending';
  const order: SaleStatus[] = ['pending', 'preparing', 'completed'];
  return order.indexOf(to) === order.indexOf(from) + 1;
}
