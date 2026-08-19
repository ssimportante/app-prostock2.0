'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ItemWithId, CategoryWithId, SubcategoryWithId, SaleWithId, WasteEvent } from '@/types';
import SalesReport from './SalesReport';
import InventoryReport from './InventoryReport';
import WasteReport from './WasteReport';
import ItemConsumptionReport from './ItemConsumptionReport';
import ProductSalesReport from './ProductSalesReport';

interface ReportsClientProps {
  items: ItemWithId[];
  categories: CategoryWithId[];
  subcategories: SubcategoryWithId[];
  sales: SaleWithId[];
  wasteEvents: WasteEvent[];
}

export default function ReportsClient({ items, categories, subcategories, sales, wasteEvents }: ReportsClientProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-headline font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Detailed reports for sales, inventory, and waste.</p>
      </div>
      
      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="sales">Receipts</TabsTrigger>
          <TabsTrigger value="products">Product Sales</TabsTrigger>
          <TabsTrigger value="consumption">Stock Out (Ingredients)</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Snapshot</TabsTrigger>
          <TabsTrigger value="waste">Waste Report</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <SalesReport sales={sales} items={items} categories={categories} subcategories={subcategories} />
        </TabsContent>
        <TabsContent value="products">
          <ProductSalesReport sales={sales} items={items} categories={categories} />
        </TabsContent>
        <TabsContent value="consumption">
          <ItemConsumptionReport sales={sales} items={items} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryReport items={items} categories={categories} />
        </TabsContent>
        <TabsContent value="waste">
          <WasteReport wasteEvents={wasteEvents} items={items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
