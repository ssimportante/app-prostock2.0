'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';

export interface SearchableSelectItem {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  items,
  value,
  onValueChange,
  placeholder = "Select an item...",
  searchPlaceholder = "Search items...",
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedItem = items.find(item => item.id === value);

  const filteredItems = searchTerm
    ? items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : items;

  const handleSelect = (item: SearchableSelectItem) => {
    onValueChange(item.id);
    setSearchTerm("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedItem ? selectedItem.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex flex-col">
            <div className="p-2 border-b">
                <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-9"
                />
            </div>
            <ScrollArea className="h-[200px]">
                {filteredItems.length > 0 ? (
                <div className="p-1">
                    {filteredItems.map(item => (
                    <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className="text-sm p-2 rounded-sm hover:bg-accent cursor-pointer flex items-center justify-between"
                    >
                        <span className="truncate">{item.name}</span>
                        {item.id === value && <Check className="h-4 w-4" />}
                    </div>
                    ))}
                </div>
                ) : (
                <p className="p-4 text-center text-sm text-muted-foreground">
                    No item found.
                </p>
                )}
            </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
