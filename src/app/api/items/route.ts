import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, sessionCookieName } from '@/lib/auth';

// Helper to get current user from session cookie
async function getSessionUser(req: NextRequest) {
  const token = req.cookies.get(sessionCookieName)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export { getSessionUser };

// Helper to compute item cost (same logic as original ItemForm)
export async function computeItemCost(
  itemData: any,
  existingId?: string | null
): Promise<number> {
  if (itemData.inventoryType === 'simple') {
    const marketPrice = itemData.marketPrice ?? 0;
    const purchaseQuantity = itemData.purchaseQuantity ?? 0;

    let priceWithTaxes = marketPrice;
    if (itemData.taxIds && itemData.taxIds.length > 0) {
      const taxes = await prisma.tax.findMany({
        where: { id: { in: itemData.taxIds } },
      });
      const additiveTaxes = taxes.filter((t) => !t.taxType || t.taxType === 'additive');
      const compoundedTaxes = taxes.filter((t) => t.taxType === 'compounded');
      const totalAdditiveRate = additiveTaxes.reduce((acc, t) => acc + (t.rate ?? 0), 0);
      priceWithTaxes = marketPrice * (1 + totalAdditiveRate / 100);
      compoundedTaxes.sort((a, b) => a.name.localeCompare(b.name));
      for (const t of compoundedTaxes) {
        priceWithTaxes = priceWithTaxes * (1 + (t.rate ?? 0) / 100);
      }
    }
    if (priceWithTaxes > 0 && purchaseQuantity > 0) {
      return priceWithTaxes / purchaseQuantity;
    }
    return 0;
  } else if (itemData.inventoryType === 'composite') {
    if (Array.isArray(itemData.components) && itemData.components.length > 0) {
      const componentIds = itemData.components.map((c: any) => c.itemId);
      const componentItems = await prisma.item.findMany({
        where: { id: { in: componentIds } },
      });
      const componentMap = new Map(componentItems.map((i) => [i.id, i]));
      const baseCost = itemData.components.reduce((acc: number, comp: any) => {
        const ci = componentMap.get(comp.itemId);
        return acc + (ci ? ci.cost * comp.quantity : 0);
      }, 0);

      let costWithTaxes = baseCost;
      if (itemData.taxIds && itemData.taxIds.length > 0) {
        const taxes = await prisma.tax.findMany({
          where: { id: { in: itemData.taxIds } },
        });
        const additiveTaxes = taxes.filter((t) => !t.taxType || t.taxType === 'additive');
        const compoundedTaxes = taxes.filter((t) => t.taxType === 'compounded');
        const totalAdditiveRate = additiveTaxes.reduce((acc, t) => acc + (t.rate ?? 0), 0);
        costWithTaxes = baseCost * (1 + totalAdditiveRate / 100);
        compoundedTaxes.sort((a, b) => a.name.localeCompare(b.name));
        for (const t of compoundedTaxes) {
          costWithTaxes = costWithTaxes * (1 + (t.rate ?? 0) / 100);
        }
      }
      const recipeYield = itemData.yield || 1;
      return costWithTaxes / recipeYield;
    }
    return 0;
  }
  return 0;
}

// GET /api/items - list all items
export async function GET() {
  const items = await prisma.item.findMany();
  return NextResponse.json(items);
}

// POST /api/items - create a new item
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { initialQuantity, initialExpiryDate, initialPurchaseDate, initialRoastDate, ...restOfData } = body;

    const calculatedCost = await computeItemCost(restOfData);

    const dataForDb: any = {
      name: restOfData.name,
      description: restOfData.description || '',
      categoryId: restOfData.categoryId,
      subcategoryId: restOfData.subcategoryId || null,
      stationId: restOfData.stationId || '',
      sku: restOfData.sku || '',
      barcode: restOfData.barcode || '',
      isSellable: restOfData.isSellable ?? false,
      saleType: restOfData.saleType ?? null,
      itemType: restOfData.isSellable ? (restOfData.itemType || null) : null,
      beverageSize: restOfData.isSellable && restOfData.itemType === 'beverage' ? (restOfData.beverageSize || null) : null,
      soldBy: restOfData.soldBy || 'each',
      price: Number(restOfData.price) || 0,
      cost: calculatedCost,
      marketPrice: restOfData.marketPrice ?? null,
      purchaseQuantity: restOfData.purchaseQuantity ?? null,
      inventoryType: restOfData.inventoryType || 'simple',
      trackStock: restOfData.trackStock ?? false,
      lowStockThreshold: Number(restOfData.lowStockThreshold) || 0,
      components: restOfData.components || [],
      yield: restOfData.yield ?? null,
      tags: restOfData.tags || [],
      taxIds: restOfData.taxIds || [],
      posRepresentationType: restOfData.posRepresentationType || 'color',
      posColor: restOfData.posColor || '#cccccc',
      posShape: 'square',
      imageUrl: restOfData.imageUrl || '',
    };

    const newBatches: any[] = [];
    if (initialQuantity && initialQuantity > 0 && restOfData.trackStock) {
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newBatch: any = {
        id: batchId,
        quantity: initialQuantity,
        purchaseDate: initialPurchaseDate
          ? new Date(initialPurchaseDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      };
      if (initialExpiryDate) newBatch.expiryDate = new Date(initialExpiryDate).toISOString().split('T')[0];
      if (initialRoastDate) newBatch.roastDate = new Date(initialRoastDate).toISOString().split('T')[0];
      newBatches.push(newBatch);

      // Create stock receipt
      await prisma.stockReceipt.create({
        data: {
          id: `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          date: initialPurchaseDate ? new Date(initialPurchaseDate) : new Date(),
          userId: user.uid,
          itemId: '', // will update after item creation
          itemName: dataForDb.name,
          quantity: initialQuantity,
          unit: dataForDb.soldBy === 'volume' ? 'g/ml' : 'units',
          batchId: batchId,
          batchDetails: {
            date: initialExpiryDate
              ? new Date(initialExpiryDate).toISOString().split('T')[0]
              : initialRoastDate
              ? new Date(initialRoastDate).toISOString().split('T')[0]
              : undefined,
            dateType: initialExpiryDate ? 'expiry' : initialRoastDate ? 'roast' : undefined,
          },
        },
      });
    }

    // Generate ID
    const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const item = await prisma.item.create({
      data: { ...dataForDb, id: itemId, stockBatches: newBatches },
    });

    // Update receipt with itemId
    if (newBatches.length > 0) {
      const receipt = await prisma.stockReceipt.findFirst({
        where: { itemId: '', batchId: newBatches[0].id },
      });
      if (receipt) {
        await prisma.stockReceipt.update({
          where: { id: receipt.id },
          data: { itemId },
        });
      }
    }

    // Update category itemCount
    await prisma.category.update({
      where: { id: dataForDb.categoryId },
      data: { itemCount: { increment: 1 } },
    }).catch(() => {});

    return NextResponse.json(item);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
