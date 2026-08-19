'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ItemWithId, CategoryWithId } from '@/types';
import { useSettings } from '@/contexts/SettingsProvider';
import { formatCurrency, roundTo } from '@/lib/utils';
import ReportToolbar from './ReportToolbar';
import { exportToCsv } from '@/lib/csv';

interface InventoryReportProps {
  items: ItemWithId[];
  categories: CategoryWithId[];
}

export default function InventoryReport({ items, categories }: InventoryReportProps) {
  const { settings } = useSettings();
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  
  const itemsWithStock = useMemo(() => {
    const productsCategoryId = categories.find(c => c.name.toLowerCase() === 'product')?.id;
    const filteredItems = productsCategoryId
      ? items.filter(item => item.categoryId !== productsCategoryId)
      : items;

    return filteredItems.map(item => {
      const totalStock = (item.stockBatches || []).reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
      const stockValue = roundTo(totalStock) * item.cost;
      return { ...item, totalStock: roundTo(totalStock), stockValue };
    });
  }, [items, categories]);

  const totalStockValue = itemsWithStock.reduce((sum, item) => sum + item.stockValue, 0);
  const totalUnits = itemsWithStock.reduce((sum, item) => sum + item.totalStock, 0);

  const handleExport = () => {
    const dataToExport = itemsWithStock.map(item => ({
        sku: item.sku,
        name: item.name,
        category: categoryMap.get(item.categoryId) || 'N/A',
        stock_quantity: item.totalStock,
        stock_value: item.stockValue,
        unit_cost: item.cost,
        selling_price: item.price,
    }));
    exportToCsv(dataToExport, 'inventory_report');
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Inventory Report</CardTitle>
        <CardDescription>Current stock levels and valuation.</CardDescription>
        <ReportToolbar onExport={handleExport} showDateRangePicker={false} />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-2 mb-4">
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{formatCurrency(totalStockValue, settings.currency)}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Units in Stock</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div></CardContent>
            </Card>
        </div>
        <div className="h-[400px] rounded-md border overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Value (Cost)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsWithStock.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{categoryMap.get(item.categoryId) || 'N/A'}</TableCell>
                  <TableCell className="text-right">{item.totalStock}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.stockValue, settings.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
