'use client';

import * as React from 'react';
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  isSameDay,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type CalendarProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> & {
  mode: 'single' | 'range';
  selected?: Date | { from?: Date; to?: Date };
  onSelect?: (date?: any) => void;
  numberOfMonths?: number;
  initialFocus?: boolean;
  defaultMonth?: Date;
  disabled?: (date: Date) => boolean;
};

const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 50 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: format(new Date(0, i), 'MMMM'),
}));

function SingleCalendar({
  displayMonth,
  onDisplayMonthChange,
  selected,
  onDateSelect,
  isStartDate,
  minDate,
  maxDate,
  disabled,
  hoveredDate,
  onDateHover,
}: {
  displayMonth: Date;
  onDisplayMonthChange: (date: Date) => void;
  selected: { from?: Date; to?: Date };
  onDateSelect: (date: Date) => void;
  isStartDate: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabled?: (date: Date) => boolean;
  hoveredDate?: Date;
  onDateHover: (date?: Date) => void;
}) {
  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startingDayIndex = getDay(monthStart);

  const handleMonthChange = (monthValue: string) => {
    const newDate = new Date(displayMonth);
    newDate.setMonth(parseInt(monthValue, 10));
    onDisplayMonthChange(newDate);
  };

  const handleYearChange = (yearValue: string) => {
    const newDate = new Date(displayMonth);
    newDate.setFullYear(parseInt(yearValue, 10));
    onDisplayMonthChange(newDate);
  };

  const isInRange = (date: Date) => {
    if (!selected.from || !selected.to) {
        if (selected.from && hoveredDate) {
            return (isAfter(date, selected.from) && isBefore(date, hoveredDate)) || (isAfter(date, hoveredDate) && isBefore(date, selected.from));
        }
        return false;
    }
    return isAfter(date, selected.from) && isBefore(date, selected.to);
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Select value={String(displayMonth.getMonth())} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[120px] focus:ring-0 focus:ring-offset-0 h-9 text-sm">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={String(m.value)} className="text-sm">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(displayMonth.getFullYear())} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[90px] focus:ring-0 focus:ring-offset-0 h-9 text-sm">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)} className="text-sm">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isStartDate ? (
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onDisplayMonthChange(subMonths(displayMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onDisplayMonthChange(addMonths(displayMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground mb-2">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 text-sm">
        {Array.from({ length: startingDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
        {days.map(day => {
          const isSelectedFrom = selected.from && isSameDay(day, selected.from);
          const isSelectedTo = selected.to && isSameDay(day, selected.to);
          const isDisabled = (minDate && isBefore(day, startOfDay(minDate))) || 
                            (maxDate && isAfter(day, startOfDay(maxDate))) || 
                            (disabled ? disabled(day) : false);

          return (
            <Button
              key={day.toString()}
              variant="ghost"
              className={cn(
                'h-9 w-9 p-0 font-normal rounded-full',
                'hover:bg-accent hover:text-accent-foreground',
                !isSameMonth(day, displayMonth) && 'text-muted-foreground opacity-50',
                isInRange(day) && 'bg-accent/50 rounded-none',
                (isSelectedFrom || isSelectedTo) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                isSelectedFrom && 'rounded-l-full',
                isSelectedTo && 'rounded-r-full',
                (selected.from && !selected.to && isSelectedFrom) && 'rounded-full'
              )}
              onClick={() => !isDisabled && onDateSelect(day)}
              onMouseEnter={() => onDateHover(day)}
              onMouseLeave={() => onDateHover(undefined)}
              disabled={isDisabled}
            >
              {format(day, 'd')}
            </Button>
          );
        })}
      </div>
    </div>
  );
}


export function Calendar({ mode = 'single', selected, onSelect, className, defaultMonth, disabled, numberOfMonths = 2 }: CalendarProps) {
  const [currentRange, setCurrentRange] = React.useState(mode === 'range' ? selected as { from?: Date; to?: Date } : {});
  const [hoveredDate, setHoveredDate] = React.useState<Date | undefined>(undefined);
  const [displayMonthLeft, setDisplayMonthLeft] = React.useState(defaultMonth || (selected instanceof Date ? selected : (selected as { from?: Date })?.from) || new Date());

  React.useEffect(() => {
    if (mode === 'range') {
        const rangeSelected = selected as { from?: Date; to?: Date };
        setCurrentRange(rangeSelected || {});
        if (rangeSelected?.from) setDisplayMonthLeft(rangeSelected.from);
    }
  }, [selected, mode]);


  const handleDateSelect = (date: Date) => {
    if (mode === 'single') {
        onSelect?.(date);
        return;
    }
    
    let newRange = { ...currentRange };

    if (!currentRange.from || (currentRange.from && currentRange.to)) {
      newRange = { from: date, to: undefined };
    } else {
      if (isBefore(date, currentRange.from)) {
        newRange = { from: date, to: currentRange.from };
      } else {
        newRange = { ...currentRange, to: date };
      }
    }
    setCurrentRange(newRange);
    onSelect?.(newRange);
  };
  
  const content = mode === 'single' ? (
     <SingleCalendar
          displayMonth={displayMonthLeft}
          onDisplayMonthChange={setDisplayMonthLeft}
          selected={{ from: selected as Date | undefined }}
          onDateSelect={(date) => onSelect?.(date)}
          isStartDate={true}
          disabled={disabled}
          onDateHover={() => {}}
      />
  ) : (
    <div className="flex flex-col md:flex-row gap-4">
      <SingleCalendar
        displayMonth={displayMonthLeft}
        onDisplayMonthChange={setDisplayMonthLeft}
        selected={currentRange}
        onDateSelect={handleDateSelect}
        isStartDate={true}
        disabled={disabled}
        maxDate={currentRange.from && !currentRange.to ? currentRange.from : undefined}
        hoveredDate={hoveredDate}
        onDateHover={setHoveredDate}
      />
      <SingleCalendar
        displayMonth={addMonths(displayMonthLeft, 1)}
        onDisplayMonthChange={(date) => setDisplayMonthLeft(subMonths(date,1))}
        selected={currentRange}
        onDateSelect={handleDateSelect}
        isStartDate={false}
        disabled={disabled}
        minDate={currentRange.from && !currentRange.to ? currentRange.from : undefined}
        hoveredDate={hoveredDate}
        onDateHover={setHoveredDate}
      />
    </div>
  );

  return (
    <div className={cn('w-fit rounded-lg border bg-card text-card-foreground shadow-sm p-4', className)}>
       {content}
    </div>
  );
}
