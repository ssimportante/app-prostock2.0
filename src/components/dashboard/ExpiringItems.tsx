
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from 'date-fns';
import { ScrollArea } from "../ui/scroll-area";

export type ExpiringItem = {
    itemName: string;
    quantity: number;
    effectiveExpiryDate: string;
    unit: 'units' | 'g/ml';
};

interface ExpiringItemsProps {
  items: ExpiringItem[];
}

export function ExpiringItems({ items }: ExpiringItemsProps) {
    const getBadgeVariant = (expiryDate: string) => {
        const daysLeft = differenceInDays(new Date(expiryDate), new Date());
        if (daysLeft < 7) return 'destructive';
        if (daysLeft < 30) return 'default';
        return 'secondary';
    };

    const getBadgeClass = (expiryDate: string) => {
        const daysLeft = differenceInDays(new Date(expiryDate), new Date());
        if (daysLeft >= 7 && daysLeft < 30) return 'bg-yellow-500 text-yellow-900 font-bold';
        return 'font-bold';
    }

    return (
        <Card className="h-full">
            <CardHeader className="p-6">
                <CardTitle className="text-lg font-bold">Expiring Soon</CardTitle>
                <CardDescription>Items expiring or best used in the next 3 months.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
                <ScrollArea className="h-[300px]">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-card">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="px-0 py-3">Item</TableHead>
                                <TableHead className="py-3">Quantity</TableHead>
                                <TableHead className="text-right px-0 py-3">Expires / Best By</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length > 0 ? items.map((item, index) => (
                                <TableRow key={`${item.itemName}-${index}`} className="hover:bg-muted/30">
                                    <TableCell className="font-medium py-4 px-0">{item.itemName}</TableCell>
                                    <TableCell className="py-4 text-muted-foreground">{item.quantity} {item.unit}</TableCell>
                                    <TableCell className="text-right py-4 px-0">
                                        <Badge variant={getBadgeVariant(item.effectiveExpiryDate)} className={cn("px-2 py-0.5", getBadgeClass(item.effectiveExpiryDate))}>
                                            {format(new Date(item.effectiveExpiryDate), 'MMM d, yyyy')}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-12 px-0">
                                        No items expiring soon.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
