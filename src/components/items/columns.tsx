'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { ItemWithId, CategoryWithId, StationWithId, SubcategoryWithId, SaleWithId, StockReceiptWithId, WasteEvent } from '@/types';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, ArrowUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { cn, formatCurrency, roundTo } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface ActionsCellProps {
  item: ItemWithId;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onWhereUsed: (item: ItemWithId) => void;
}

const ActionsCell = ({ item, onEdit, onDuplicate, onDelete, onWhereUsed }: ActionsCellProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onEdit(item.id)}>
          Edit Item
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDuplicate(item.id)}>
          Duplicate Item
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onWhereUsed(item)}>
          <Search className="mr-2 h-4 w-4" />
          Where Used
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => onDelete(item.id)}
        >
          Delete Item
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const getColumns = (
  categories: CategoryWithId[],
  subcategories: SubcategoryWithId[],
  stations: StationWithId[],
  onEdit: (id: string) => void,
  onDuplicate: (id: string) => void,
  onDelete: (id: string) => void,
  onWhereUsed: (item: ItemWithId) => void,
  asOfStr: string | null,
  currency: string,
  allItems: ItemWithId[],
  sales: SaleWithId[],
  receipts: StockReceiptWithId[],
  wasteEvents: WasteEvent[]
): ColumnDef<ItemWithId>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
        <div className="flex flex-col">
            <div className="font-medium">{row.original.name}</div>
            <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">ID: {row.original.id}</div>
        </div>
    ),
    filterFn: (row, id, value) => {
        const searchValue = (value || '').toString().toLowerCase().trim();
        if (!searchValue) return true;
        
        const name = (row.original.name || '').toLowerCase();
        const sku = (row.original.sku || '').toLowerCase();
        const id_str = (row.original.id || '').toLowerCase();
        const tags = row.original.tags?.map(t => t.toLowerCase()) || [];
        
        return name.includes(searchValue) || sku.includes(searchValue) || id_str.includes(searchValue) || tags.some(tag => tag.includes(searchValue));
    }
  },
  {
    accessorKey: 'sku',
    header: 'SKU',
  },
   {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags = row.original.tags;
      if (!tags || tags.length === 0) return <span className="text-muted-foreground">N/A</span>;
      return (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {tags.map(tag => (
            <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
          ))}
        </div>
      );
    },
    filterFn: (row, id, value) => {
        const itemTags = row.original.tags || [];
        const selectedTags = (value as string[]) || [];
        if (selectedTags.length === 0) return true;
        return selectedTags.every(tag => itemTags.includes(tag));
    },
    enableSorting: false,
  },
  {
    accessorKey: 'categoryId',
    header: 'Category',
    cell: ({ row }) => {
      const categoryId = row.getValue('categoryId') as string;
      const category = categories.find(c => c.id === categoryId);
      return category ? <Badge variant="secondary" style={{ backgroundColor: category.color, color: '#fff' }}>{category.name}</Badge> : 'N/A';
    },
    filterFn: (row, id, value) => {
        const val = (value as string[]) || [];
        if (val.length === 0) return true;
        const rowValue = row.getValue(id) as string;
        if (val.includes('__none__') && (!rowValue || rowValue === '')) return true;
        return val.includes(rowValue);
    }
  },
  {
    accessorKey: 'subcategoryId',
    header: 'Subcategory',
    cell: ({ row }) => {
      const subcategoryId = row.getValue('subcategoryId') as string;
      const subcategory = subcategories.find(s => s.id === subcategoryId);
      return subcategory ? <span>{subcategory.name}</span> : <span className="text-muted-foreground">N/A</span>;
    },
    filterFn: (row, id, value) => {
        const val = (value as string[]) || [];
        if (val.length === 0) return true;
        const rowValue = row.getValue(id) as string;
        if (val.includes('__none__') && (!rowValue || rowValue === '')) return true;
        return val.includes(rowValue);
    }
  },
  {
    accessorKey: 'stationId',
    header: 'Station',
    cell: ({ row }) => {
      const stationId = row.getValue('stationId') as string;
      const station = stations.find(s => s.id === stationId);
      return station ? <span>{station.name}</span> : <span className="text-muted-foreground">N/A</span>;
    },
    filterFn: (row, id, value) => {
        const val = (value as string[]) || [];
        if (val.length === 0) return true;
        const rowValue = row.getValue(id) as string;
        if (val.includes('__none__') && (!rowValue || rowValue === '')) return true;
        return val.includes(rowValue);
    },
  },
  {
    id: 'stock',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Stock
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: row => {
        if (!row.trackStock) return 0;
        
        // --- CALCULATION LOGIC ---
        // If we are looking "As Of" a date, we calculate historical balance.
        // If not, we just sum current batches.
        
        if (asOfStr) {
            const asOfDate = startOfDay(new Date(asOfStr));
            const itemId = row.id;
            const itemsMap = new Map(allItems.map(i => [i.id, i]));

            // 1. Total In before Date
            const totalIn = receipts
                .filter(r => r.itemId === itemId && (isBefore(r.date.toDate(), asOfDate) || isSameDay(r.date.toDate(), asOfDate)))
                .reduce((sum, r) => sum + Number(r.quantity || 0), 0);

            // 2. Total Waste before Date
            const totalWasted = wasteEvents
                .filter(w => w.itemId === itemId && (isBefore(w.date.toDate(), asOfDate) || isSameDay(w.date.toDate(), asOfDate)))
                .reduce((sum, w) => sum + Number(w.quantity || 0), 0);

            // 3. Total Consumed before Date
            let totalConsumed = 0;
            sales.forEach(sale => {
                if (isBefore(sale.date.toDate(), asOfDate) || isSameDay(sale.date.toDate(), asOfDate)) {
                    sale.items.forEach(si => {
                        const product = itemsMap.get(si.itemId);
                        if (!product) return;
                        const effectiveQty = Number(si.quantity || 0) - Number(si.refundedQuantity || 0);
                        if (effectiveQty <= 0) return;

                        if (si.itemId === itemId) {
                            totalConsumed += effectiveQty;
                        } else if (product.inventoryType === 'composite' && product.components) {
                            const usage = product.components.find(c => c.itemId === itemId);
                            if (usage) totalConsumed += (Number(usage.quantity) * effectiveQty);
                        }
                    });
                }
            });

            return roundTo(totalIn - totalWasted - totalConsumed);
        }

        const total = (row.stockBatches || []).reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
        return roundTo(total);
    },
    cell: ({ row }) => {
      const item = row.original;
      if (!item.trackStock) return <span className="text-muted-foreground">N/A</span>;
      const totalStock = (row.getValue('stock') as number);
      const isLowStock = totalStock > 0 && item.lowStockThreshold > 0 && totalStock <= item.lowStockThreshold;
      const isOutOfStock = totalStock <= 0;
      let variant: 'default' | 'destructive' | 'secondary' = isOutOfStock ? 'destructive' : isLowStock ? 'default' : 'secondary';
      return (
        <div className="flex flex-col">
          <span className="font-mono font-bold">{totalStock} {item.soldBy === 'volume' ? 'g/ml' : ''}</span>
          <Badge variant={variant} className={cn("text-[10px] uppercase", isLowStock ? 'bg-yellow-500 text-yellow-900' : '')}>
            {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
          </Badge>
        </div>
      );
    },
  },
  {
    id: 'expiry',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Expiry/Roast Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (row) => {
      if (!row.trackStock || !row.stockBatches || row.stockBatches.length === 0) return null;
      
      const filteredBatches = asOfStr 
        ? (row.stockBatches || []).filter(b => b.purchaseDate && b.purchaseDate <= asOfStr)
        : (row.stockBatches || []);

      const dates = filteredBatches
        .map(b => (b.expiryDate || b.roastDate) ? new Date(b.expiryDate || b.roastDate as string) : null)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());
      return dates.length > 0 ? dates[0] : null;
    },
    cell: ({ row }) => {
      const item = row.original;
      
      const filteredBatches = asOfStr 
        ? (item.stockBatches || []).filter(b => b.purchaseDate && b.purchaseDate <= asOfStr)
        : (item.stockBatches || []);

      if (!item.trackStock || !filteredBatches || filteredBatches.length === 0) return <span className="text-muted-foreground">N/A</span>;
      
      const dates = filteredBatches
        .map(b => ({ date: (b.expiryDate || b.roastDate) ? new Date(b.expiryDate || b.roastDate as string) : null, type: b.expiryDate ? 'Expires' : 'Roasted' }))
        .filter((d): d is { date: Date; type: string } => d.date !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      
      if (dates.length === 0) return <span className="text-muted-foreground">N/A</span>;
      return (
        <div className="flex flex-col">
          <span>{format(dates[0].date, 'P')}</span>
          <span className="text-xs text-muted-foreground">{dates[0].type}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'price',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Price <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.getValue('price'), currency)}</div>,
  },
  {
    accessorKey: 'cost',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Cost <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.getValue('cost'), currency)}</div>,
  },
  {
    id: 'margin',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Margin <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: row => row.price === 0 ? 0 : ((row.price - row.cost) / row.price) * 100,
    cell: ({ row }) => <div className="text-right">{(row.getValue('margin') as number).toFixed(2)}%</div>,
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <ActionsCell
        item={row.original}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onWhereUsed={onWhereUsed}
      />
    ),
  },
];
