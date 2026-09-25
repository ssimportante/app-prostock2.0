'use client';

import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatMoney, round3 } from '@/lib/money';
import type { Item } from '@/lib/types';

export function BatchesDialog({
  item,
  currency,
  onClose,
}: {
  item: Item | null;
  currency: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline">Batches — {item?.name}</DialogTitle>
          <DialogDescription>
            Oldest batches are consumed first (FIFO).
          </DialogDescription>
        </DialogHeader>
        {item && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Qty</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Effective date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.stockBatches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium tabular-nums">
                    {round3(batch.quantity)} {item.soldBy === 'volume' ? 'g·ml' : 'pc'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(batch.addedAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {batch.expiryDate ? (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                        Expiry {format(parseISO(batch.expiryDate), 'MMM d')}
                      </Badge>
                    ) : batch.roastDate ? (
                      <Badge variant="outline" className="border-primary/30 text-primary">
                        Roast {format(parseISO(batch.roastDate), 'MMM d')}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No date</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {item.stockBatches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    No batches on hand.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <p className="text-right text-xs text-muted-foreground">
          Total: {round3(item?.stockBatches.reduce((s, b) => s + Number(b.quantity || 0), 0) ?? 0)}{' '}
          {item?.soldBy === 'volume' ? 'g·ml' : 'pc'} · valued at{' '}
          {formatMoney(
            Math.round(
              (item?.stockBatches.reduce((s, b) => s + Number(b.quantity || 0), 0) ?? 0) *
                (item?.cost ?? 0)
            ),
            currency
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}
