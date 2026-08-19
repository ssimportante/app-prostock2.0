
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
import { WasteEvent, ItemWithId } from '@/types';
import { useSettings } from '@/contexts/SettingsProvider';
import { formatCurrency } from '@/lib/utils';
import { format as formatDate, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import ReportToolbar from './ReportToolbar';
import { exportToCsv } from '@/lib/csv';
import { Badge } from '../ui/badge';

interface WasteReportProps {
  wasteEvents: WasteEvent[];
  items: ItemWithId[];
}

export default function WasteReport({ wasteEvents, items }: WasteReportProps) {
  const { settings } = useSettings();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    setDateRange({ from: subDays(new Date(), 30), to: new Date() });
  }, []);

  const filteredEvents = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    return wasteEvents
      .filter(event => isWithinInterval(event.date.toDate(), { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to!) }))
      .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
  }, [wasteEvents, dateRange]);

  const totalWasteValue = filteredEvents
    .filter(e => !e.eventType || e.eventType === 'waste')
    .reduce((sum, event) => sum + event.cost, 0);

  const totalPullOutValue = filteredEvents
    .filter(e => e.eventType === 'pull-out')
    .reduce((sum, event) => sum + event.cost, 0);

  const handleExport = () => {
    const dataToExport = filteredEvents.map(event => ({
      date: formatDate(event.date.toDate(), 'yyyy-MM-dd HH:mm:ss'),
      type: event.eventType || 'waste',
      item_name: event.itemName,
      quantity: event.quantity,
      cost: event.cost,
      unit: event.unit,
      recorded_by: event.recordedByName,
      reason: event.reason,
    }));
    exportToCsv(dataToExport, 'stock_reductions_report');
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Stock Reductions Report</CardTitle>
        <CardDescription>Detailed log of all recorded waste and pull out events.</CardDescription>
        <ReportToolbar
          dateRange={dateRange}
          onDateChange={setDateRange}
          onExport={handleExport}
        />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-4">
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Waste Value</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(totalWasteValue, settings.currency)}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Pull Out Value</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(totalPullOutValue, settings.currency)}</div></CardContent>
            </Card>
        </div>
        <div className="h-[400px] rounded-md border overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length > 0 ? (
                filteredEvents.map(event => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(event.date.toDate(), 'MMM d, p')}</TableCell>
                    <TableCell>
                        <Badge variant={(!event.eventType || event.eventType === 'waste') ? 'destructive' : 'default'} className="uppercase text-[10px]">
                            {event.eventType || 'waste'}
                        </Badge>
                    </TableCell>
                    <TableCell>{event.itemName}</TableCell>
                    <TableCell className="text-right">{event.quantity} {event.unit}</TableCell>
                    <TableCell className="text-right">{formatCurrency(event.cost, settings.currency)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">No reductions recorded in this period.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
