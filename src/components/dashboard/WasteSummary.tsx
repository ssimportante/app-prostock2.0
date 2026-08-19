
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import type { WasteEvent, PosSettings, ItemWithId, CategoryWithId } from '@/types';
import { ScrollArea } from "@/components/ui/scroll-area";

type WastedItemSummary = {
  itemName: string;
  quantity: number;
  cost: number;
  unit: 'units' | 'g/ml';
};

interface WasteSummaryProps {
  wasteEvents: WasteEvent[];
  items: ItemWithId[];
  categories: CategoryWithId[];
  settings: PosSettings;
}

const calculateWaste = (
  events: WasteEvent[],
  items: ItemWithId[],
  packagingCategoryId: string | undefined,
  startDate: Date,
  endDate: Date,
  reductionType: 'waste' | 'pull-out'
): { ingredients: WastedItemSummary[], packaging: WastedItemSummary[] } => {
    const ingredientWasteMap = new Map<string, { quantity: number; cost: number; unit: 'units' | 'g/ml' }>();
    const packagingWasteMap = new Map<string, { quantity: number; cost: number; unit: 'units' | 'g/ml' }>();
    const itemsMap = new Map(items.map(i => [i.id, i]));

    const filteredEvents = events.filter(event => {
        const eventDate = event.date.toDate();
        const matchesDate = isWithinInterval(eventDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
        const matchesType = (event.eventType || 'waste') === reductionType;
        return matchesDate && matchesType;
    });

    for (const event of filteredEvents) {
        const item = itemsMap.get(event.itemId);
        const isPackaging = item?.categoryId === packagingCategoryId;
        const targetMap = isPackaging ? packagingWasteMap : ingredientWasteMap;
        
        const existing = targetMap.get(event.itemName) || { quantity: 0, cost: 0, unit: event.unit };
        existing.quantity += event.quantity;
        existing.cost += event.cost;
        targetMap.set(event.itemName, existing);
    }
    
    const mapToSummaryArray = (map: Map<string, { quantity: number; cost: number; unit: 'units' | 'g/ml' }>) => {
        return Array.from(map.entries()).map(([itemName, data]) => ({
            itemName,
            ...data,
        })).sort((a, b) => b.cost - a.cost);
    }

    return {
        ingredients: mapToSummaryArray(ingredientWasteMap),
        packaging: mapToSummaryArray(packagingWasteMap)
    };
};

export function WasteSummary({ wasteEvents, items, categories, settings }: WasteSummaryProps) {
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [activeReductionType, setActiveReductionType] = useState<'waste' | 'pull-out'>('waste');
  const packagingCategoryId = useMemo(() => categories.find(c => c.name.toLowerCase() === 'packaging')?.id, [categories]);
  
  useEffect(() => {
    const now = new Date();
    setDate({
        from: subDays(now, 29),
        to: now,
    });
  }, []);

  const wasteData = useMemo(() => {
      if (!date?.from || !date?.to || !wasteEvents) return null;
      return calculateWaste(wasteEvents, items, packagingCategoryId, date.from, date.to, activeReductionType);
  }, [wasteEvents, items, packagingCategoryId, date, activeReductionType]);


  const renderTable = (wastedItems: WastedItemSummary[] | null) => {
    if (!wastedItems) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }
    const totalCost = wastedItems.reduce((sum, item) => sum + item.cost, 0);

    return (
        <ScrollArea className="h-[300px]">
            <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="px-0 py-3">Item</TableHead>
                        <TableHead className="py-3">Qty</TableHead>
                        <TableHead className="text-right px-0 py-3">Total Cost</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {wastedItems.length > 0 ? wastedItems.map(item => (
                        <TableRow key={item.itemName} className="hover:bg-muted/30">
                            <TableCell className="font-medium py-4 px-0">{item.itemName}</TableCell>
                            <TableCell className="py-4 text-muted-foreground">
                            {item.quantity % 1 !== 0 ? item.quantity.toFixed(2) : item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="text-right py-4 px-0 font-bold">
                                {formatCurrency(item.cost, settings.currency)}
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-12 px-0">
                                No {activeReductionType} events recorded for this period.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                {wastedItems.length > 0 && (
                    <TableFooter className="sticky bottom-0 z-10 bg-card">
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={2} className="text-right font-bold py-4 px-0 text-muted-foreground">Total Reduction Value</TableCell>
                            <TableCell className="text-right font-black py-4 px-0 text-destructive">
                                {formatCurrency(totalCost, settings.currency)}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
                <CardTitle className="text-lg font-bold">Stock Reductions</CardTitle>
                <CardDescription>Items recorded as waste or pull outs.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Tabs value={activeReductionType} onValueChange={(v) => setActiveReductionType(v as 'waste' | 'pull-out')} className="w-auto">
                    <TabsList className="h-8 p-1 bg-muted/50 rounded-lg">
                        <TabsTrigger value="waste" className="text-[10px] px-2">Waste</TabsTrigger>
                        <TabsTrigger value="pull-out" className="text-[10px] px-2">Pull Out</TabsTrigger>
                    </TabsList>
                </Tabs>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        size="sm"
                        className={cn(
                        "w-[180px] justify-start text-left font-normal h-8",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {date?.from ? (
                            <span className="text-[10px] truncate">
                                {format(date.from, "MMM d")} - {date.to ? format(date.to, "MMM d") : ""}
                            </span>
                        ) : (
                            <span className="text-[10px]">Date range</span>
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
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="ingredients" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-muted/50 rounded-lg">
            <TabsTrigger value="ingredients" className="text-xs">Ingredients</TabsTrigger>
            <TabsTrigger value="packaging" className="text-xs">Packaging</TabsTrigger>
          </TabsList>
          <TabsContent value="ingredients" className="mt-4 outline-none">
            {renderTable(wasteData?.ingredients || null)}
          </TabsContent>
          <TabsContent value="packaging" className="mt-4 outline-none">
            {renderTable(wasteData?.packaging || null)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
