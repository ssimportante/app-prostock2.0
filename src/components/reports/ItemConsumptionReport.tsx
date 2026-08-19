
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sale, ItemWithId, ItemComponent } from '@/types';
import { useSettings } from '@/contexts/SettingsProvider';
import { formatCurrency, roundTo } from '@/lib/utils';
import { format as formatDate, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import ReportToolbar from './ReportToolbar';
import { exportToCsv } from '@/lib/csv';

interface ItemConsumptionReportProps {
  sales: Sale[];
  items: ItemWithId[];
}

type ConsumedItem = {
    name: string;
    quantity: number;
    unit: 'units' | 'g/ml';
    cost: number;
};

const calculateConsumption = (sales: Sale[], items: ItemWithId[], startDate: Date, endDate: Date) => {
    const consumptionMap = new Map<string, number>();
    const itemsMap = new Map(items.map(i => [i.id, i]));

    const filteredSales = sales.filter(sale => {
        const saleDate = sale.date.toDate();
        return isWithinInterval(saleDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
    });

    const processComponents = (components: ItemComponent[], multiplier: number) => {
        for (const component of components) {
            const componentItem = itemsMap.get(component.itemId);
            if (componentItem && componentItem.trackStock) {
                const current = consumptionMap.get(componentItem.id) || 0;
                consumptionMap.set(componentItem.id, roundTo(current + (component.quantity * multiplier)));
            }
        }
    };

    for (const sale of filteredSales) {
        for (const saleItem of sale.items) {
            const item = itemsMap.get(saleItem.itemId);
            if (!item) continue;

            const effectiveQty = saleItem.quantity - (saleItem.refundedQuantity || 0);
            if (effectiveQty <= 0) continue;

            if (item.inventoryType === 'simple' && item.trackStock) {
                 const current = consumptionMap.get(item.id) || 0;
                 consumptionMap.set(item.id, roundTo(current + effectiveQty));
            } else if (item.inventoryType === 'composite') {
                if (item.components) {
                    processComponents(item.components, effectiveQty);
                }
            }
        }
    }
    
    const result: ConsumedItem[] = Array.from(consumptionMap.entries()).map(([itemId, quantity]) => {
        const item = itemsMap.get(itemId)!;
        return {
            name: item.name,
            quantity,
            unit: item.soldBy === 'volume' ? 'g/ml' : 'units',
            cost: quantity * item.cost,
        };
    });

    return result.sort((a,b) => b.cost - a.cost);
};


export default function ItemConsumptionReport({ sales, items }: ItemConsumptionReportProps) {
  const { settings } = useSettings();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    setDateRange({ from: subDays(new Date(), 30), to: new Date() });
  }, []);

  const consumedItems = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    return calculateConsumption(sales, items, dateRange.from, dateRange.to);
  }, [sales, items, dateRange]);

  const totalConsumptionValue = consumedItems.reduce((sum, item) => sum + item.cost, 0);

  const handleExport = () => {
    const dataToExport = consumedItems.map(item => ({
        item_name: item.name,
        quantity_consumed: item.quantity,
        unit: item.unit,
        cost_of_consumption: item.cost,
    }));
    exportToCsv(dataToExport, 'item_consumption_report');
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Item Consumption Report</CardTitle>
        <CardDescription>Ingredients and items consumed through sales (stock out). Adjusted for refunds.</CardDescription>
        <ReportToolbar
          dateRange={dateRange}
          onDateChange={setDateRange}
          onExport={handleExport}
        />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-1 mb-4">
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Consumption Value</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{formatCurrency(totalConsumptionValue, settings.currency)}</div></CardContent>
            </Card>
        </div>
        <div className="h-[400px] rounded-md border overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Quantity Consumed</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumedItems.length > 0 ? (
                consumedItems.map(item => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity % 1 !== 0 ? item.quantity.toFixed(2) : item.quantity} {item.unit}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.cost, settings.currency)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">No consumption data in this period.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
