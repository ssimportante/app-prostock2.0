'use client';

import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ReportToolbarProps {
  dateRange?: DateRange;
  onDateChange?: (dateRange?: DateRange) => void;
  onExport: () => void;
  showDateRangePicker?: boolean;
}

export default function ReportToolbar({
  dateRange,
  onDateChange,
  onExport,
  showDateRangePicker = true,
}: ReportToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 py-4">
      {showDateRangePicker && onDateChange && (
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
              onSelect={(range) => onDateChange(range && typeof range === 'object' && 'from' in range ? range : undefined)}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
      <Button onClick={onExport} variant="outline">
        <Download className="mr-2 h-4 w-4" />
        Export to CSV
      </Button>
    </div>
  );
}
