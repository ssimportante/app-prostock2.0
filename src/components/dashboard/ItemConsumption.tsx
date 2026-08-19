
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, isWithinInterval, endOfDay, subDays } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import type { Sale, ItemWithId, ItemComponent, PosSettings } from '@/types';
import { ScrollArea } from "@/components/ui/scroll-area";

type ConsumedItem = {
  name: string;
  quantity: number;
  unit: 'units' | 'g/ml';
  amount: number;
};

interface ItemConsumptionProps {
  sales: Sale[];
  items: ItemWithId[];
  settings: PosSettings;
}

const calculateConsumption = (sales: Sale[], items: ItemWithId[], startDate: Date, endDate: Date) => {
    const consumptionMap = new Map<string, number>();
    const itemsMap = new Map(items.map(i => [i.id, i]));

    const filteredSales = sales.filter(sale => {
        const saleDate = sale.date.toDate();
        return isWithinInterval(saleDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
    });

    for (const sale of filteredSales) {
        for (const saleItem of sale.items) {
            const item = itemsMap.get(saleItem.itemId);
            if (!item) continue;

            const processComponents = (components: ItemComponent[], multiplier: number) => {
                for (const component of components) {
                    const componentItem = itemsMap.get(component.itemId);
                    if (componentItem && componentItem.trackStock) {
                         const current = consumptionMap.get(componentItem.id) || 0;
                        consumptionMap.set(componentItem.id, current + (component.quantity * multiplier));
                    }
                }
            };

            if (item.inventoryType === 'simple' && item.trackStock) {
                 const current = consumptionMap.get(item.id) || 0;
                 consumptionMap.set(item.id, current + saleItem.quantity);
            } else if (item.inventoryType === 'composite') {
                processComponents(item.components, saleItem.quantity);
            }
        }
    }
    
    const result: ConsumedItem[] = Array.from(consumptionMap.entries()).map(([itemId, quantity]) => {
        const item = itemsMap.get(itemId)!;
        return {
            name: item.name,
            quantity,
            unit: item.soldBy === 'volume' ? 'g/ml' : 'units' as 'g/ml' | 'units',
            amount: quantity * item.cost,
        };
    });

    return result.sort((a,b) => b.quantity - a.quantity);
};

export function ItemConsumption({ sales, items, settings }: ItemConsumptionProps) {
    const [date, setDate] = useState<DateRange | undefined>(undefined);
    const [consumptionData, setConsumptionData] = useState<{
        daily: ConsumedItem[] | null,
        weekly: ConsumedItem[] | null,
        monthly: ConsumedItem[] | null,
        yearly: ConsumedItem[] | null,
    }>({ daily: null, weekly: null, monthly: null, yearly: null });

    useEffect(() => {
      const now = new Date();
      setDate({
        from: subDays(now, 29),
        to: now,
      });

      setConsumptionData({
          daily: calculateConsumption(sales, items, startOfDay(now), now),
          weekly: calculateConsumption(sales, items, startOfWeek(now), now),
          monthly: calculateConsumption(sales, items, startOfMonth(now), now),
          yearly: calculateConsumption(sales, items, startOfYear(now), now),
      });

    }, [sales, items]);

    const customData = useMemo(() => date?.from && date?.to ? calculateConsumption(sales, items, date.from, date.to) : [], [sales, items, date]);

    const renderTable = (consumedItems: ConsumedItem[] | null) => {
        if (!consumedItems) {
            return (
                 <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )
        }
        const totalAmount = consumedItems.reduce((sum, item) => sum + item.amount, 0);

        return (
            <ScrollArea className="h-[300px]">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="px-0 py-3">Item</TableHead>
                            <TableHead className="py-3">Consumed</TableHead>
                            <TableHead className="text-right px-0 py-3">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {consumedItems.length > 0 ? consumedItems.map(item => (
                            <TableRow key={item.name} className="hover:bg-muted/30">
                                <TableCell className="font-medium py-4 px-0">{item.name}</TableCell>
                                <TableCell className="py-4 text-muted-foreground">
                                {item.quantity % 1 !== 0 ? item.quantity.toFixed(2) : item.quantity} {item.unit}
                                </TableCell>
                                <TableCell className="text-right py-4 px-0 font-bold">
                                    {formatCurrency(item.amount, settings.currency)}
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-12 px-0">
                                    No consumption data found for this period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    {consumedItems.length > 0 && (
                        <TableFooter className="sticky bottom-0 z-10 bg-card">
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={2} className="text-right font-bold py-4 px-0 text-muted-foreground">Total Consumption Value</TableCell>
                                <TableCell className="text-right font-black py-4 px-0 text-primary">
                                    {formatCurrency(totalAmount, settings.currency)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </ScrollArea>
        );
    }

  return (
    <Card className="h-full">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-lg font-bold">Item Consumption</CardTitle>
        <CardDescription>Ingredients and items consumed through sales records.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-9 p-1 bg-muted/50 rounded-lg">
            <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
            <TabsTrigger value="yearly" className="text-xs">Yearly</TabsTrigger>
            <TabsTrigger value="custom" className="text-xs">Custom</TabsTrigger>
          </TabsList>
          <TabsContent value="daily" className="mt-4 outline-none">{renderTable(consumptionData.daily)}</TabsContent>
          <TabsContent value="weekly" className="mt-4 outline-none">{renderTable(consumptionData.weekly)}</TabsContent>
          <TabsContent value="monthly" className="mt-4 outline-none">{renderTable(consumptionData.monthly)}</TabsContent>
          <TabsContent value="yearly" className="mt-4 outline-none">{renderTable(consumptionData.yearly)}</TabsContent>
          <TabsContent value="custom" className="mt-4 outline-none">
            <div className="flex justify-end mb-4">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        size="sm"
                        className={cn(
                        "w-full sm:w-[260px] justify-start text-left font-normal h-9",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {date?.from ? (
                        date.to ? (
                            <span className="text-xs">
                            {format(date.from, "MMM d, y")} - {format(date.to, "MMM d, y")}
                            </span>
                        ) : (
                            <span className="text-xs">{format(date.from, "MMM d, y")}</span>
                        )
                        ) : (
                        <span className="text-xs">Pick a date range</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={(range) => range && typeof range === 'object' && 'from' in range && setDate(range as DateRange)}
                        numberOfMonths={2}
                    />
                    </PopoverContent>
                </Popover>
            </div>
            {renderTable(customData)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
