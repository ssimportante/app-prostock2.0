'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney } from '@/lib/money';
import type { WasteByItemEntry } from '@/lib/types';

export function WasteTable({ data, currency }: { data: WasteByItemEntry[]; currency: string }) {
  return (
    <Card className="shadow-warm">
      <CardHeader className="pb-2">
        <CardTitle className="font-headline text-lg font-semibold">Waste summary</CardTitle>
        <CardDescription>Losses grouped by item</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="pt-12 text-center text-sm text-muted-foreground">No waste recorded. Keep it up.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead className="text-right">Waste</TableHead>
                <TableHead className="text-right">Pull-outs</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.events}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {formatMoney(row.waste, currency)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatMoney(row.pullOut, currency)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMoney(row.total, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
