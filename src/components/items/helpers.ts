import type { Item } from '@/lib/types';

export function totalStockOf(item: Item): number {
  return (item.stockBatches ?? []).reduce((sum, b) => sum + Number(b.quantity || 0), 0);
}
