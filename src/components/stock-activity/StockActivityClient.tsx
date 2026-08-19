
'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from '@/components/ui/scroll-area';
import type { StockReceiptWithId, WasteEvent, AppUser, Item, StockBatch } from '@/types';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { User, Trash2, Loader2, Info, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useFirestore } from '@/firebase';
import { doc, getDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '../ui/badge';
import { forceInteractivity } from '@/lib/utils';

async function deleteStockReceiptAction(firestore: any, receipt: StockReceiptWithId) {
    const receiptRef = doc(firestore, 'stockReceipts', receipt.id);
    
    if (!receipt.batchId) {
        console.warn(`Legacy receipt ${receipt.id} without batchId. Deleting receipt only.`);
        await deleteDoc(receiptRef);
        return;
    }

    const itemRef = doc(firestore, 'items', receipt.itemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) {
        throw new Error('Associated item not found. Cannot safely delete receipt.');
    }

    const item = itemSnap.data() as Item;
    const batchToDelete = item.stockBatches.find(b => b.id === receipt.batchId);

    if (!batchToDelete) {
        console.warn(`Batch ID ${receipt.batchId} not found for item ${receipt.itemId}. Deleting receipt only.`);
        await deleteDoc(receiptRef);
        return;
    }

    if (batchToDelete.quantity < receipt.quantity) {
        throw new Error('Cannot delete receipt. Stock from this batch has been partially consumed or wasted.');
    }
    
    const updatedBatches = item.stockBatches.map(b => 
        b.id === receipt.batchId ? { ...b, quantity: b.quantity - receipt.quantity } : b
    ).filter(b => b.quantity > 0);

    const batch = writeBatch(firestore);
    batch.update(itemRef, { stockBatches: updatedBatches });
    batch.delete(receiptRef);
    await batch.commit();
}

async function deleteWasteEventAction(firestore: any, wasteEvent: WasteEvent) {
    const wasteRef = doc(firestore, 'wasteEvents', wasteEvent.id);

    if (!wasteEvent.batchId) {
        console.warn(`Legacy waste event ${wasteEvent.id} without batchId. Deleting event only.`);
        await deleteDoc(wasteRef);
        return;
    }
    
    const itemRef = doc(firestore, 'items', wasteEvent.itemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) {
        throw new Error('Associated item not found. Cannot revert event.');
    }

    const item = itemSnap.data() as Item;
    const batchToRestore = item.stockBatches.find(b => b.id === wasteEvent.batchId);
    let newStockBatches: StockBatch[];

    if (batchToRestore) {
        newStockBatches = item.stockBatches.map(b => 
            b.id === wasteEvent.batchId 
            ? { ...b, quantity: b.quantity + wasteEvent.quantity }
            : b
        );
    } else {
        const newBatch: StockBatch = {
            id: wasteEvent.batchId,
            quantity: wasteEvent.quantity,
        };
        newStockBatches = [...item.stockBatches, newBatch];
    }
    
    const batch = writeBatch(firestore);
    batch.update(itemRef, { stockBatches: newStockBatches });
    batch.delete(wasteRef);
    await batch.commit();
}


interface StockActivityClientProps {
    receipts: StockReceiptWithId[];
    wasteEvents: WasteEvent[];
    users: AppUser[];
}

export default function StockActivityClient({ receipts, wasteEvents, users }: StockActivityClientProps) {
    const userMap = useMemo(() => new Map(users.map(u => [u.uid, u])), [users]);
    
    const [receiptToDelete, setReceiptToDelete] = useState<StockReceiptWithId | null>(null);
    const [wasteToDelete, setWasteToDelete] = useState<WasteEvent | null>(null);
    const [isDeleting, startDeleteTransition] = useTransition();
    
    const { toast } = useToast();
    const firestore = useFirestore();
    const { appUser } = useAuth();
    const isAdmin = appUser?.role === 'admin';

    // Global interactivity guard
    useEffect(() => {
        const active = !!receiptToDelete || !!wasteToDelete || isDeleting;
        if (!active) {
            forceInteractivity();
        }
    }, [receiptToDelete, wasteToDelete, isDeleting]);

    const handleDeleteReceipt = () => {
        if (!receiptToDelete) return;

        startDeleteTransition(async () => {
            try {
                await deleteStockReceiptAction(firestore, receiptToDelete);
                toast({
                    title: 'Success',
                    description: 'Stock receipt deleted and inventory updated.',
                });
            } catch (error) {
      console.error(error);
                toast({
                    variant: 'destructive',
                    title: 'Error Deleting Receipt',
                    description: (error as Error).message,
                });
            } finally {
                setReceiptToDelete(null);
                forceInteractivity();
            }
        });
    };
    
    const handleDeleteWaste = () => {
        if (!wasteToDelete) return;

        startDeleteTransition(async () => {
            try {
                await deleteWasteEventAction(firestore, wasteToDelete);
                toast({
                    title: 'Success',
                    description: 'Event deleted and inventory restored.',
                });
            } catch (error) {
      console.error(error);
                 toast({
                    variant: 'destructive',
                    title: 'Error Deleting Event',
                    description: (error as Error).message,
                });
            } finally {
                setWasteToDelete(null);
                forceInteractivity();
            }
        });
    };

    const getUserAvatar = (userId: string) => {
        const user = userMap.get(userId);
        return (
            <Avatar className="h-6 w-6">
                <AvatarImage src={user?.photoURL || ''} />
                <AvatarFallback><User className="h-4 w-4"/></AvatarFallback>
            </Avatar>
        )
    }

    const getUserIdentifier = (userId: string) => {
        const user = userMap.get(userId);
        return user?.email || 'Unknown User';
    }

    return (
        <TooltipProvider>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-headline font-bold tracking-tight">Stock Activity Log</h1>
                    <p className="text-muted-foreground">Monitor all incoming stock and recorded reductions.</p>
                </div>

                <Tabs defaultValue="stock-in" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="stock-in">Stock In</TabsTrigger>
                        <TabsTrigger value="waste">Reductions (Waste/Pull Out)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="stock-in">
                        <Card>
                            <CardHeader>
                                <CardTitle>Stock Receipts</CardTitle>
                                <CardDescription>Log of all new stock added to the inventory.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[60vh] rounded-md border">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card z-10">
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Item</TableHead>
                                                <TableHead>Quantity</TableHead>
                                                <TableHead>Expiry/Roast Date</TableHead>
                                                <TableHead>User Account</TableHead>
                                                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {receipts.map(r => (
                                                <TableRow key={r.id}>
                                                    <TableCell className="whitespace-nowrap">{format(r.date.toDate(), 'PPP p')}</TableCell>
                                                    <TableCell className="font-medium">{r.itemName}</TableCell>
                                                    <TableCell>{r.quantity} {r.unit}</TableCell>
                                                    <TableCell>
                                                        {r.batchDetails?.date ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium">{format(new Date(r.batchDetails.date), 'PP')}</span>
                                                                <span className="text-[10px] text-muted-foreground uppercase">{r.batchDetails.dateType}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">N/A</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {getUserAvatar(r.userId)}
                                                            <span className="text-sm">{getUserIdentifier(r.userId)}</span>
                                                        </div>
                                                    </TableCell>
                                                    {isAdmin && (
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setReceiptToDelete(r)}
                                                                title="Delete receipt"
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="waste">
                        <Card>
                            <CardHeader>
                                <CardTitle>Reduction Events</CardTitle>
                                <CardDescription>Log of all items removed from inventory.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[60vh] rounded-md border">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card z-10">
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Item</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>Recorded By</TableHead>
                                                <TableHead>Reason</TableHead>
                                                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {wasteEvents.map(w => (
                                                <TableRow key={w.id}>
                                                    <TableCell className="whitespace-nowrap">{format(w.date.toDate(), 'MMM d, p')}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={(!w.eventType || w.eventType === 'waste') ? 'destructive' : 'default'} className="uppercase text-[10px]">
                                                            {w.eventType || 'waste'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium">{w.itemName}</TableCell>
                                                    <TableCell className="whitespace-nowrap">{w.quantity} {w.unit}</TableCell>
                                                    <TableCell className="font-semibold text-primary">{w.recordedByName || 'N/A'}</TableCell>
                                                    <TableCell className="max-w-[200px]">
                                                        <div className="flex items-center gap-1">
                                                            <span className="truncate">{w.reason || 'N/A'}</span>
                                                            {w.reason && w.reason.length > 20 && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="max-w-xs">
                                                                        {w.reason}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    {isAdmin && (
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setWasteToDelete(w)}
                                                                title="Delete event"
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
            
            <AlertDialog open={!!receiptToDelete} onOpenChange={(open) => {
                if (!open) {
                    setReceiptToDelete(null);
                    forceInteractivity();
                }
            }}>
                <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Stock Receipt?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the stock receipt and remove the corresponding quantity from your inventory. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteReceipt} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!wasteToDelete} onOpenChange={(open) => {
                if (!open) {
                    setWasteToDelete(null);
                    forceInteractivity();
                }
            }}>
                <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revert Stock Reduction?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the record and add the quantity back to your inventory. Use this only if the reduction was recorded in error.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteWaste} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Revert Stock
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TooltipProvider>
    );
}
