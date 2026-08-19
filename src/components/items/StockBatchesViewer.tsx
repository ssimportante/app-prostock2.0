'use client';

import { useState, useTransition, useEffect } from 'react';
import { StockBatch } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';

interface StockBatchesViewerProps {
  itemId: string;
  initialBatches: StockBatch[];
}

async function deleteStockBatchAction(firestore: any, itemId: string, batchId: string, currentBatches: StockBatch[]) {
    const updatedBatches = currentBatches.filter(b => b.id !== batchId);
    await updateDoc(doc(firestore, 'items', itemId), { stockBatches: updatedBatches });
}

export function StockBatchesViewer({ itemId, initialBatches }: StockBatchesViewerProps) {
  const [batches, setBatches] = useState<StockBatch[]>(initialBatches);
  const [batchToDelete, setBatchToDelete] = useState<StockBatch | null>(null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const { toast } = useToast();

  // Sync state if initialBatches changes (e.g. from real-time updates)
  useEffect(() => {
    setBatches(initialBatches);
  }, [initialBatches]);

  const handleDelete = () => {
    if (!batchToDelete) return;

    startTransition(async () => {
      try {
        await deleteStockBatchAction(firestore, itemId, batchToDelete.id, batches);
        setBatches(currentBatches => currentBatches.filter(b => b.id !== batchToDelete.id));
        toast({ title: 'Success', description: 'Stock batch deleted.' });
      } catch (error) {
      console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete stock batch.' });
      } finally {
        setBatchToDelete(null);
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Current Stock Batches</CardTitle>
          <CardDescription>
            A list of all current stock batches for this item.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Expiry / Roast Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length > 0 ? (
                  batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>{batch.quantity}</TableCell>
                      <TableCell>
                        {batch.purchaseDate ? format(new Date(batch.purchaseDate), 'PPP') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {batch.expiryDate
                          ? `Expires: ${format(new Date(batch.expiryDate), 'PPP')}`
                          : batch.roastDate
                          ? `Roasted: ${format(new Date(batch.roastDate), 'PPP')}`
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => setBatchToDelete(batch)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No stock batches found for this item.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!batchToDelete} onOpenChange={(open) => !open && setBatchToDelete(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this stock batch. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
