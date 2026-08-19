
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Sale, PosSettings } from "@/types";
import { format, subDays, isWithinInterval, startOfDay, endOfDay, differenceInDays, addDays, isBefore, isSameDay } from "date-fns";
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';


interface SalesChartProps {
  sales: Sale[];
  settings: PosSettings;
}

export default function SalesChart({ sales, settings }: SalesChartProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    setDateRange({
      from: subDays(new Date(), 6),
      to: new Date(),
    });
  }, []);

  const filteredSales = useMemo(() => {
    if (dateRange?.from && dateRange?.to && sales) {
        return sales.filter(sale => {
            const saleDate = sale.date.toDate();
            return isWithinInterval(saleDate, { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to!) });
        });
    }
    return [];
  }, [sales, dateRange]);

  const chartData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    
    const dailyMap = new Map<string, number>();
    
    // Initialize all days in range with 0 to ensure a continuous line even on days with no sales
    let current = startOfDay(dateRange.from);
    const last = startOfDay(dateRange.to);
    
    while (isBefore(current, last) || isSameDay(current, last)) {
      dailyMap.set(format(current, 'yyyy-MM-dd'), 0);
      current = addDays(current, 1);
    }

    // Aggregate sales by day
    filteredSales.forEach(sale => {
      const dayKey = format(sale.date.toDate(), 'yyyy-MM-dd');
      if (dailyMap.has(dayKey)) {
        const currentTotal = dailyMap.get(dayKey) || 0;
        dailyMap.set(dayKey, currentTotal + sale.total);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, total]) => ({ 
        date, 
        total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales, dateRange]);

  const chartConfig = {
    total: {
      label: "Total Sales",
      color: "hsl(var(--primary))",
    },
  };
  
  const getTickFormatter = () => {
    if (!dateRange?.from || !dateRange?.to) return (value: string) => format(new Date(value), "MMM d");
    
    const days = differenceInDays(dateRange.to, dateRange.from);
    if (days <= 7) return (value: string) => format(new Date(value), "MMM d");
    if (days <= 31) return (value: string) => format(new Date(value), "d");
    if (days <= 365) return (value: string) => format(new Date(value), "MMM");
    return (value: string) => format(new Date(value), "MMM ''yy");
  };

  const descriptionText = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      if (format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) {
        return `Total sales for ${format(dateRange.from, 'LLL d, y')}.`;
      }
      return `Total daily sales from ${format(dateRange.from, 'LLL d, y')} to ${format(dateRange.to, 'LLL d, y')}.`;
    }
    return 'Total daily sales over time.';
  }, [dateRange]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
                <CardTitle>Sales Overview</CardTitle>
                <CardDescription>{descriptionText}</CardDescription>
            </div>
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                    "w-full sm:w-[300px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                    dateRange.to ? (
                        <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                        </>
                    ) : (
                        format(dateRange.from, "LLL dd, y")
                    )
                    ) : (
                    <span>Pick a date range</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => range && typeof range === 'object' && 'from' in range && setDateRange(range as DateRange)}
                    numberOfMonths={2}
                />
                </PopoverContent>
            </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="w-full h-full">
                    <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={getTickFormatter()}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => formatCurrency(value, settings.currency).replace(/\.00$/, '')}
                    />
                    <ChartTooltip
                        cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                        content={<ChartTooltipContent indicator="dot" formatter={(value) => formatCurrency(value as number, settings.currency)} />}
                    />
                    <Line
                        dataKey="total"
                        type="monotone"
                        stroke="var(--color-total)"
                        strokeWidth={2}
                        dot={{ r: 4, fill: 'var(--color-total)', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    </LineChart>
                </ChartContainer>
            ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    No sales data for the selected period.
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
