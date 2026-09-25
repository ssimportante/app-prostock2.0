import type { Discount, Item, SaleItem, Tax } from './types';

export interface LineInput {
  itemId: string;
  quantity: number;
  discount?: { type: 'percent' | 'fixed'; value: number };
}

export interface TicketDiscountInput {
  type: 'percent' | 'fixed';
  value: number;
}

export interface SaleMath {
  saleItems: SaleItem[];
  subtotal: number;
  lineDiscountTotal: number;
  ticketDiscount: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

/**
 * Single source of truth for sale totals — used by the POS client preview
 * and by the server at checkout. All amounts in integer cents.
 */
export function computeSaleMath(
  lines: LineInput[],
  items: Item[],
  taxes: Tax[],
  ticketDiscount: TicketDiscountInput | undefined,
  deliveryFee: number
): SaleMath {
  const saleItems: SaleItem[] = [];
  let subtotal = 0;
  let lineDiscountTotal = 0;

  for (const line of lines) {
    const item = items.find((i) => i.id === line.itemId);
    if (!item) continue;
    const qty = Math.max(1, Math.round(Number(line.quantity) || 1));
    const gross = item.price * qty;
    let amount = 0;
    if (line.discount && line.discount.value > 0) {
      amount =
        line.discount.type === 'percent'
          ? Math.round((gross * Math.min(line.discount.value, 100)) / 100)
          : Math.min(Math.round(line.discount.value) * qty, gross);
    }
    subtotal += gross;
    lineDiscountTotal += amount;
    saleItems.push({
      itemId: item.id,
      name: item.name,
      quantity: qty,
      price: item.price,
      refundedQuantity: 0,
      discount:
        amount > 0 && line.discount
          ? { type: line.discount.type, value: line.discount.value, amount }
          : undefined,
      stationId: item.stationId ?? null,
      itemType: item.itemType ?? null,
    });
  }

  const netAfterLines = subtotal - lineDiscountTotal;
  let ticketDiscountAmount = 0;
  if (ticketDiscount && ticketDiscount.value > 0 && netAfterLines > 0) {
    ticketDiscountAmount =
      ticketDiscount.type === 'percent'
        ? Math.round((netAfterLines * Math.min(ticketDiscount.value, 100)) / 100)
        : Math.min(Math.round(ticketDiscount.value), netAfterLines);
  }

  // Tax: additive rates summed per item, applied on each line's net share
  // after its proportion of the ticket discount.
  let tax = 0;
  if (netAfterLines > 0) {
    for (const li of saleItems) {
      const item = items.find((i) => i.id === li.itemId);
      if (!item) continue;
      const lineNet = li.price * li.quantity - (li.discount?.amount ?? 0);
      const ticketShare = (lineNet / netAfterLines) * ticketDiscountAmount;
      const taxable = Math.max(0, lineNet - ticketShare);
      const rate = item.taxIds.reduce(
        (sum, taxId) => sum + (taxes.find((t) => t.id === taxId)?.rate ?? 0),
        0
      );
      tax += Math.round((taxable * rate) / 100);
    }
  }

  const fee = Math.max(0, Math.round(deliveryFee));
  const total = subtotal - lineDiscountTotal - ticketDiscountAmount + tax + fee;

  return {
    saleItems,
    subtotal,
    lineDiscountTotal,
    ticketDiscount: ticketDiscountAmount,
    tax,
    deliveryFee: fee,
    total,
  };
}

export function ticketDiscountToPayload(
  discount: TicketDiscountInput | undefined
): Discount | undefined {
  if (!discount || discount.value <= 0) return undefined;
  return { ...discount, amount: 0 };
}
