import { roundTo } from './utils';
import type { ItemWithId, ItemComponent } from '@/types';

/**
 * Recursively calculates the per-unit cost of an item.
 * For simple items, returns item.cost.
 * For composite items, sums (component.quantity * componentItem.cost) recursively.
 * Yield is treated as 1 everywhere per project decision.
 */
export function calculateItemUnitCost(item: ItemWithId, itemsMap: Map<string, ItemWithId>): number {
    if (item.inventoryType === 'composite' && item.components) {
        return roundTo(item.components.reduce((sum, comp) => {
            const compItem = itemsMap.get(comp.itemId);
            if (!compItem) return sum;
            return sum + (comp.quantity * calculateItemUnitCost(compItem, itemsMap));
        }, 0));
    }
    return item.cost || 0;
}

/**
 * Calculates the total cost of goods sold for a sale item line,
 * accounting for refunds and composite item costs.
 */
export function calculateSaleItemCogs(
    item: ItemWithId,
    effectiveQty: number,
    itemsMap: Map<string, ItemWithId>
): number {
    return roundTo(calculateItemUnitCost(item, itemsMap) * effectiveQty);
}

/**
 * Calculates the per-unit price of a sale item after applying any item-level discount.
 * refundValue = refundedQuantity * discountedPerUnitPrice
 */
export function calculateDiscountedUnitPrice(si: { price: number; quantity: number; discount?: { amount?: number } }): number {
    const discountPerUnit = (si.discount?.amount || 0) / si.quantity;
    return roundTo(si.price - discountPerUnit);
}
