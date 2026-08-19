
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemWithId } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "../ui/scroll-area";

interface LowStockItemsProps {
  items: ItemWithId[];
}

export default function LowStockItems({ items }: LowStockItemsProps) {
  return (
    <Card className="h-full">
      <CardHeader className="p-6">
        <CardTitle className="text-lg font-bold">Low Stock Items</CardTitle>
        <CardDescription>These items have fallen below their low stock threshold.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <ScrollArea className="h-[300px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-0 py-3">Item</TableHead>
                <TableHead className="text-right py-3">Current Stock</TableHead>
                <TableHead className="text-right px-0 py-3">Threshold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length > 0 ? items.map(item => {
                const totalStock = (item.stockBatches || []).reduce((sum, batch) => sum + (batch.quantity || 0), 0);
                return (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium py-4 px-0">{item.name}</TableCell>
                    <TableCell className="text-right py-4">
                      <Badge variant="default" className="bg-yellow-500 text-yellow-900 font-bold px-2 py-0.5">
                        {totalStock % 1 === 0 ? totalStock : totalStock.toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 px-0 font-medium text-muted-foreground">{item.lowStockThreshold}</TableCell>
                  </TableRow>
                )
              }) : (
                  <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-12 px-0">
                          No items are currently low on stock.
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
