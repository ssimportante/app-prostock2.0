import type { Item, ItemComponent } from '@/lib/types';

const COLORS = /^#[0-9a-fA-F]{6}$/;

/** Sanitizes a client payload into item fields. */
export function itemFromPayload(
  body: Record<string, unknown>
): { item: Omit<Item, 'id' | 'stockBatches'>; error?: never } | { item?: never; error: string } {
  const name = String(body.name ?? '').trim();
  const categoryId = String(body.categoryId ?? '').trim();
  if (!name) return { error: 'Name is required' };
  if (!categoryId) return { error: 'Category is required' };

  const price = Math.max(0, Math.round(Number(body.price) || 0));
  const cost = Math.max(0, Number(body.cost) || 0);
  const soldBy = body.soldBy === 'volume' ? 'volume' : 'each';
  const inventoryType = body.inventoryType === 'composite' ? 'composite' : 'simple';

  const components: ItemComponent[] = Array.isArray(body.components)
    ? (body.components as { itemId?: unknown; quantity?: unknown }[])
        .filter((c) => c.itemId && Number(c.quantity) > 0)
        .map((c) => ({ itemId: String(c.itemId), quantity: Number(c.quantity) }))
    : [];
  if (inventoryType === 'composite' && components.length === 0) {
    return { error: 'Composite items need at least one component' };
  }

  const taxIds = Array.isArray(body.taxIds) ? body.taxIds.map(String).filter(Boolean) : [];
  const posColor = COLORS.test(String(body.posColor ?? '')) ? String(body.posColor) : '#B4552D';

  return {
    item: {
      name,
      description: String(body.description ?? '').trim(),
      categoryId,
      subcategoryId: body.subcategoryId ? String(body.subcategoryId) : null,
      stationId: body.stationId ? String(body.stationId) : null,
      sku: String(body.sku ?? '').trim(),
      barcode: String(body.barcode ?? '').trim(),
      isSellable: Boolean(body.isSellable),
      saleType:
        body.saleType === 'dine-in' || body.saleType === 'take-away' ? body.saleType : null,
      itemType:
        body.itemType === 'food' || body.itemType === 'beverage' || body.itemType === 'packaging'
          ? body.itemType
          : null,
      soldBy,
      price,
      cost,
      inventoryType,
      trackStock: Boolean(body.trackStock),
      lowStockThreshold: Math.max(0, Number(body.lowStockThreshold) || 0),
      components,
      yield: inventoryType === 'composite' ? Math.max(1, Number(body.yield) || 1) : undefined,
      taxIds,
      posColor,
    },
  };
}
