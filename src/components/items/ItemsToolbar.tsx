'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Download, PlusCircle, Upload, FileText, Loader2, Tag, Trash2, XCircle, Settings2, Layout, Layers, MapPin, Calendar as CalendarIcon, X } from 'lucide-react';
import { CategoryWithId, ItemWithId, StationWithId, SubcategoryWithId } from '@/types';
import { type Table } from '@tanstack/react-table';
import { exportToCsv, importFromCsv, exportCsvTemplate } from '@/lib/csv';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useMemo, useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ItemsToolbarProps {
  table: Table<ItemWithId>;
  categories: CategoryWithId[];
  subcategories: SubcategoryWithId[];
  stations: StationWithId[];
  items: ItemWithId[];
  onImport: (data: any[]) => void;
  onAddTag: () => void;
  onRemoveTag: () => void;
  onUpdateField: (field: string) => void;
  onDeleteSelected: () => void;
  isImporting: boolean;
  asOfDate: Date | null;
  onAsOfDateChange: (date: Date | null) => void;
}

export function ItemsToolbar({
  table,
  categories,
  subcategories,
  stations,
  items,
  onImport,
  onAddTag,
  onRemoveTag,
  onUpdateField,
  onDeleteSelected,
  isImporting,
  asOfDate,
  onAsOfDateChange,
}: ItemsToolbarProps) {

  const uniqueTags = useMemo(() => {
      const allTags = items.flatMap(item => item.tags || []);
      return [...new Set(allTags)].sort();
  }, [items]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importFromCsv(file, onImport);
      event.target.value = '';
    }
  };
  
  const columnFilters = table.getState().columnFilters;
  const setColumnFilters = table.setColumnFilters;

  // LOCAL SEARCH STATE FOR SNAPPY UI
  const initialSearchValue = (columnFilters.find(f => f.id === 'name')?.value || '') as string;
  const [searchValue, setSearchValue] = useState(initialSearchValue);

  // Sync internal filter to URL with a responsive 250ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
        if (searchValue !== initialSearchValue) {
            setColumnFilters(old => {
                const otherFilters = old.filter(f => f.id !== 'name');
                if (searchValue) return [...otherFilters, {id: 'name', value: searchValue}];
                return otherFilters;
            });
        }
    }, 250); 
    return () => clearTimeout(timer);
  }, [searchValue, setColumnFilters, initialSearchValue]);

  // Update local input if URL changes externally
  useEffect(() => {
    setSearchValue(initialSearchValue);
  }, [initialSearchValue]);

  const handleFilterChange = (id: string, checked: boolean, value: string) => {
    setColumnFilters(old => {
        const filter = old.find(f => f.id === id);
        const selectedValues = (filter?.value || []) as string[];
        let newSelectedValues: string[];

        if (checked) {
            newSelectedValues = [...selectedValues, value];
        } else {
            newSelectedValues = selectedValues.filter(v => v !== value);
        }

        const otherFilters = old.filter(f => f.id !== id);

        if (newSelectedValues.length > 0) {
            return [...otherFilters, { id, value: newSelectedValues }];
        } else {
            return otherFilters;
        }
    });
  };
  
  const selectedCategories = (columnFilters.find(f => f.id === 'categoryId')?.value || []) as string[];
  const selectedSubcategories = (columnFilters.find(f => f.id === 'subcategoryId')?.value || []) as string[];
  const selectedStations = (columnFilters.find(f => f.id === 'stationId')?.value || []) as string[];
  const selectedTags = (columnFilters.find(f => f.id === 'tags')?.value || []) as string[];
  
  const numSelected = table.getSelectedRowModel().rows.length;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 gap-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full flex-1 min-w-0">
        <Input
          placeholder="Filter by name, SKU, or tag..."
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        <Layers className="mr-2 h-4 w-4" />
                        Category
                        {selectedCategories.length > 0 && <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{selectedCategories.length}</span>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                        checked={selectedCategories.includes('__none__')}
                        onCheckedChange={(checked) => handleFilterChange('categoryId', !!checked, '__none__')}
                    >
                        Uncategorized
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {categories.map(category => (
                        <DropdownMenuCheckboxItem
                            key={category.id}
                            checked={selectedCategories.includes(category.id)}
                            onCheckedChange={(checked) => handleFilterChange('categoryId', !!checked, category.id)}
                        >
                            {category.name}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        <Layout className="mr-2 h-4 w-4" />
                        Subcategory
                        {selectedSubcategories.length > 0 && <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{selectedSubcategories.length}</span>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel>Filter by Subcategory</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                        checked={selectedSubcategories.includes('__none__')}
                        onCheckedChange={(checked) => handleFilterChange('subcategoryId', !!checked, '__none__')}
                    >
                        No Subcategory
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {subcategories.map(sub => (
                        <DropdownMenuCheckboxItem
                            key={sub.id}
                            checked={selectedSubcategories.includes(sub.id)}
                            onCheckedChange={(checked) => handleFilterChange('subcategoryId', !!checked, sub.id)}
                        >
                            {sub.name}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        <MapPin className="mr-2 h-4 w-4" />
                        Station
                        {selectedStations.length > 0 && <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{selectedStations.length}</span>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Filter by Station</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                        checked={selectedStations.includes('__none__')}
                        onCheckedChange={(checked) => handleFilterChange('stationId', !!checked, '__none__')}
                    >
                        No Station
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {stations.map(station => (
                        <DropdownMenuCheckboxItem
                            key={station.id}
                            checked={selectedStations.includes(station.id)}
                            onCheckedChange={(checked) => handleFilterChange('stationId', !!checked, station.id)}
                        >
                            {station.name}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        <Tag className="mr-2 h-4 w-4" />
                        Tags
                        {selectedTags.length > 0 && <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{selectedTags.length}</span>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {uniqueTags.map(tag => (
                        <DropdownMenuCheckboxItem
                            key={tag}
                            checked={selectedTags.includes(tag)}
                            onCheckedChange={(checked) => handleFilterChange('tags', !!checked, tag)}
                        >
                            {tag}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9", asOfDate && "bg-primary/10 border-primary text-primary")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {asOfDate ? `Stock as of ${format(asOfDate, 'MMM d, yyyy')}` : 'Stock as of Date'}
                        {asOfDate && (
                            <div 
                                className="ml-2 hover:bg-primary/20 rounded-full p-0.5" 
                                onClick={(e) => { e.stopPropagation(); onAsOfDateChange(null); }}
                            >
                                <X className="h-3 w-3" />
                            </div>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={asOfDate || undefined}
                        onSelect={(date) => onAsOfDateChange(date instanceof Date ? date : null)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
        {numSelected > 0 ? (
            <>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Settings2 className="mr-2 h-4 w-4" />
                            Update Field
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Mass Update</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onUpdateField('categoryId')}>
                            <Layers className="mr-2 h-4 w-4" /> Set Category
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateField('subcategoryId')}>
                            <Layout className="mr-2 h-4 w-4" /> Set Subcategory
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateField('stationId')}>
                            <MapPin className="mr-2 h-4 w-4" /> Set Station
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Tag className="mr-2 h-4 w-4" />
                            Tags
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onAddTag}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Tags
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onRemoveTag}>
                            <XCircle className="mr-2 h-4 w-4" /> Remove Tags
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDeleteSelected}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete ({numSelected})
                </Button>
            </>
        ) : (
            <>
                <Button variant="outline" size="sm" onClick={() => exportToCsv(items, 'prostock_items_export')}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsvTemplate}>
                    <FileText className="mr-2 h-4 w-4" />
                    Template
                </Button>
                 <Button variant="outline" size="sm" asChild>
                    <label htmlFor="csv-import" className="cursor-pointer">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Import
                        <input
                        type="file"
                        id="csv-import"
                        className="hidden"
                        accept=".csv"
                        onChange={handleFileUpload}
                        disabled={isImporting}
                        />
                    </label>
                </Button>
                <Button size="sm" asChild>
                    <Link href="/items/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Item
                    </Link>
                </Button>
            </>
        )}
      </div>
    </div>
  );
}
