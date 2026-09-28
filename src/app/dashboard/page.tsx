'use client';

import { useMemo } from 'react';
import DashboardStats from '@/components/dashboard/DashboardStats';
import SalesChart from '@/components/dashboard/SalesChart';
import LowStockItems from '@/components/dashboard/LowStockItems';
import { ItemConsumption } from '@/components/dashboard/ItemConsumption';
import { ExpiringItems, type ExpiringItem } from '@/components/dashboard/ExpiringItems';
import { WasteSummary } from '@/components/dashboard/WasteSummary';
import { isAfter, addMonths } from 'date-fns';
import type { ItemWithId, Sale, WasteEvent, CategoryWithId, ItemComponent } from '@/types';
import CategoryDistributionChart from '@/components/dashboard/CategoryDistributionChart';
import InventoryMovementChart from '@/components/dashboard/InventoryMovementChart';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiCollection } from '@/lib/api-hooks';
import { useSettings } from '@/contexts/SettingsProvider';
import { roundTo } from '@/lib/utils';

const getExpiringItems = (items: ItemWithId[], months: number): ExpiringItem[] => {
    const expiring: ExpiringItem[] = [];
    const thresholdDate = addMonths(new Date(), months);

    for (const item of items) {
        if (!item.trackStock || !item.stockBatches || item.stockBatches.length === 0) continue;

        for (const batch of item.stockBatches) {
            let effectiveExpiryDate: Date | null = null;
            if (batch.expiryDate) {
                effectiveExpiryDate = new Date(batch.expiryDate);
            } else if (batch.roastDate) {
                effectiveExpiryDate = addMonths(new Date(batch.roastDate), 3);
            }

            if (effectiveExpiryDate) {
                if (isAfter(effectiveExpiryDate, new Date()) && isAfter(thresholdDate, effectiveExpiryDate)) {
                    expiring.push({
                        itemName: item.name,
                        quantity: Number(batch.quantity || 0),
                        effectiveExpiryDate: effectiveExpiryDate.toISOString(),
                        unit: item.soldBy === 'volume' ? 'g/ml' : 'units' as 'g/ml' | 'units'
                    });
                }
            }
        }
    }
    return expiring.sort((a, b) => new Date(a.effectiveExpiryDate).getTime() - new Date(b.effectiveExpiryDate).getTime());
};

const calculateDetailedStockValues = (items: ItemWithId[], ingredientCategoryId?: string, packagingCategoryId?: string) => {
    return items.reduce((acc, item) => {
        if (!item.trackStock || !item.stockBatches) return acc;
        
        const totalStock = item.stockBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
        const itemValue = roundTo(totalStock) * item.cost;
        
        acc.totalStockValue += itemValue;
        
        if (item.categoryId === ingredientCategoryId) {
            acc.ingredientValue += itemValue;
        } else if (item.categoryId === packagingCategoryId) {
            acc.packagingValue += itemValue;
        }
        
        return acc;
    }, { totalStockValue: 0, ingredientValue: 0, packagingValue: 0 });
};

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-80" />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>

      <div className="mt-8">
        <Skeleton className="h-96 w-full" />
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96" />
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
    const { settings } = useSettings();

    const { data: items } = useApiCollection<ItemWithId>('/api/items');
    const { data: sales } = useApiCollection<Sale>('/api/sales');
    const { data: wasteEvents } = useApiCollection<WasteEvent>('/api/wasteEvents');
    const { data: categories } = useApiCollection<CategoryWithId>('/api/categories');
    
    const data = useMemo(() => {
        if (!items || !sales || !wasteEvents || !categories || !settings) {
            return null;
        }

        const totalItems = items.length;

        const ingredientCategory = categories.find(c => c.name.toLowerCase() === 'ingredient' || c.name.toLowerCase() === 'ingredients');
        const ingredientCategoryId = ingredientCategory?.id;
        const packagingCategory = categories.find(c => c.name.toLowerCase() === 'packaging');
        const packagingCategoryId = packagingCategory?.id;

        const { totalStockValue, ingredientValue, packagingValue } = calculateDetailedStockValues(items, ingredientCategoryId, packagingCategoryId);
        
        const lowStockItems = items.filter(item => {
            if (!item.trackStock || !item.lowStockThreshold || !item.stockBatches) return false;
            const totalStock = item.stockBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
            return totalStock > 0 && totalStock <= item.lowStockThreshold;
        });

        const expiringItems = getExpiringItems(items, 3);
        
        const categoryCounts = categories.map(category => {
            const count = items.filter(item => item.categoryId === category.id).length;
            return { name: category.name, count, color: category.color };
        }).sort((a,b) => b.count - a.count);

        // Movement Data Calculation
        const itemsMap = new Map(items.map(i => [i.id, i]));

        // Waste/Pull-out categorized
        const movementBreakdown = {
            ingredient: { stock: ingredientValue, consumed: 0, waste: 0, pullOut: 0 },
            packaging: { stock: packagingValue, consumed: 0, waste: 0, pullOut: 0 }
        };

        wasteEvents.forEach(event => {
            const item = itemsMap.get(event.itemId);
            if (!item) return;

            const isIngredient = item.categoryId === ingredientCategoryId;
            const isPackaging = item.categoryId === packagingCategoryId;
            const type = event.eventType || 'waste';

            if (isIngredient) {
                if (type === 'waste') movementBreakdown.ingredient.waste += event.cost;
                else movementBreakdown.ingredient.pullOut += event.cost;
            } else if (isPackaging) {
                if (type === 'waste') movementBreakdown.packaging.waste += event.cost;
                else movementBreakdown.packaging.pullOut += event.cost;
            }
        });

        // Consumption categorized & COGS Calculation
        let totalCogs = 0;
        sales.forEach(sale => {
            sale.items.forEach(saleItem => {
                const item = itemsMap.get(saleItem.itemId);
                if (!item) return;

                const effectiveQty = saleItem.quantity - (saleItem.refundedQuantity || 0);
                if (effectiveQty <= 0) return;

                // Add to Global COGS
                totalCogs += (item.cost * effectiveQty);

                const processItemForMovement = (targetItem: typeof item, multiplier: number) => {
                    const costValue = targetItem.cost * multiplier;
                    if (targetItem.categoryId === ingredientCategoryId) {
                        movementBreakdown.ingredient.consumed += costValue;
                    } else if (targetItem.categoryId === packagingCategoryId) {
                        movementBreakdown.packaging.consumed += costValue;
                    }
                };

                if (item.inventoryType === 'simple') {
                    processItemForMovement(item, effectiveQty);
                } else if (item.inventoryType === 'composite') {
                    item.components.forEach((comp: ItemComponent) => {
                        const compItem = itemsMap.get(comp.itemId);
                        if (compItem) processItemForMovement(compItem, comp.quantity * (effectiveQty / (item.yield || 1)));
                    });
                }
            });
        });

        const totalWasteValue = wasteEvents.reduce((acc, event) => {
            if (!event.eventType || event.eventType === 'waste') {
                return acc + event.cost;
            }
            return acc;
        }, 0);

        const totalPullOutValue = wasteEvents.reduce((acc, event) => {
            if (event.eventType === 'pull-out') {
                return acc + event.cost;
            }
            return acc;
        }, 0);

        const totalRevenue = sales.reduce((acc, sale) => acc + (sale.total || 0), 0);
        const foodCostPercentage = totalRevenue > 0 ? (totalCogs / totalRevenue) * 100 : 0;

        return {
            totalItems,
            totalStockValue,
            ingredientValue,
            packagingValue,
            lowStockItems,
            expiringItems,
            categoryCounts,
            totalWasteValue,
            totalPullOutValue,
            totalRevenue,
            totalCogs,
            foodCostPercentage,
            ingredientMovement: {
                totalStockValue: movementBreakdown.ingredient.stock,
                totalConsumedValue: movementBreakdown.ingredient.consumed,
                totalWasteValue: movementBreakdown.ingredient.waste,
                totalPullOutValue: movementBreakdown.ingredient.pullOut
            },
            packagingMovement: {
                totalStockValue: movementBreakdown.packaging.stock,
                totalConsumedValue: movementBreakdown.packaging.consumed,
                totalWasteValue: movementBreakdown.packaging.waste,
                totalPullOutValue: movementBreakdown.packaging.pullOut
            }
        }
    }, [items, sales, wasteEvents, categories, settings]);


    if (!data || !sales || !wasteEvents || !categories || !settings || !items) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-headline font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-1">An overview of your business performance and inventory health.</p>
            </div>

            <DashboardStats settings={settings} stats={{ 
                totalItems: data.totalItems, 
                totalStockValue: data.totalStockValue, 
                lowStockCount: data.lowStockItems.length, 
                ingredientValue: data.ingredientValue, 
                packagingValue: data.packagingValue,
                categoryCounts: data.categoryCounts,
                totalWasteValue: data.totalWasteValue,
                totalPullOutValue: data.totalPullOutValue,
                totalRevenue: data.totalRevenue,
                totalCogs: data.totalCogs,
                foodCostPercentage: data.foodCostPercentage,
            }} />

            <div className="mt-8">
                <SalesChart sales={sales} settings={settings} />
            </div>
            
            <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <LowStockItems items={data.lowStockItems} />
                </div>
                <CategoryDistributionChart items={items || []} categories={categories} />
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <InventoryMovementChart 
                    title="Ingredient Movement Analysis"
                    data={data.ingredientMovement} 
                    settings={settings} 
                />
                <InventoryMovementChart 
                    title="Packaging Movement Analysis"
                    data={data.packagingMovement} 
                    settings={settings} 
                />
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <ItemConsumption sales={sales} items={items || []} settings={settings} />
                </div>
                <ExpiringItems items={data.expiringItems} />
            </div>

            <div className="mt-8 grid gap-8 md:grid-cols-1 pb-8">
                <WasteSummary wasteEvents={wasteEvents} items={items} categories={categories} settings={settings} />
            </div>
        </div>
    );
}
