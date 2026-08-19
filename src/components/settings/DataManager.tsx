
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, AlertTriangle, History, Trash2, Package, Sparkles, RefreshCcw, ShieldCheck, Zap } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { cn, roundTo } from '@/lib/utils';
import { StockBatch, ItemWithId } from '@/types';

async function resetAllStockAction(firestore: any) {
    const itemsCollection = collection(firestore, 'items');
    const itemsSnapshot = await getDocs(itemsCollection);
    const batch = writeBatch(firestore);
    itemsSnapshot.forEach(doc => {
        batch.update(doc.ref, { stockBatches: [] });
    });
    await batch.commit();
}

async function resetAllStockActivityAction(firestore: any) {
    const receiptsCollection = collection(firestore, 'stockReceipts');
    const receiptsSnapshot = await getDocs(receiptsCollection);
    const batch = writeBatch(firestore);
    receiptsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}

async function resetAllWasteEventsAction(firestore: any) {
    const wasteCollection = collection(firestore, 'wasteEvents');
    const wasteSnapshot = await getDocs(wasteCollection);
    const batch = writeBatch(firestore);
    wasteSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}

/**
 * MASTER FIFO RECONCILIATION
 * Restores original batches from receipts and applies consumption (Sales + Waste) in order.
 */
async function runGlobalInventoryReconciliation(firestore: any, targetItemId?: string) {
    const itemsSnap = await getDocs(collection(firestore, 'items'));
    const salesSnap = await getDocs(collection(firestore, 'sales'));
    const receiptsSnap = await getDocs(collection(firestore, 'stockReceipts'));
    const wasteSnap = await getDocs(collection(firestore, 'wasteEvents'));

    const itemsMap = new Map(itemsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as ItemWithId]));
    const batch = writeBatch(firestore);
    let updateCount = 0;

    for (const [itemId, item] of itemsMap.entries()) {
        if (!item.trackStock) continue;
        if (targetItemId && itemId !== targetItemId) continue;

        // 1. Rebuild Original Batches from Receipts Log
        const originalBatchesFromLogs: StockBatch[] = receiptsSnap.docs
            .filter(d => d.data().itemId === itemId)
            .map(d => {
                const data = d.data();
                const b: StockBatch = {
                    id: data.batchId || d.id,
                    quantity: Number(data.quantity || 0),
                    purchaseDate: data.date.toDate().toISOString().split('T')[0],
                };
                if (data.batchDetails?.date) {
                    if (data.batchDetails.dateType === 'expiry') b.expiryDate = data.batchDetails.date;
                    if (data.batchDetails.dateType === 'roast') b.roastDate = data.batchDetails.date;
                }
                return b;
            })
            .sort((a, b) => {
                const dateA = a.expiryDate || a.purchaseDate || '9999-12-31';
                const dateB = b.expiryDate || b.purchaseDate || '9999-12-31';
                return dateA.localeCompare(dateB);
            });

        // 2. Calculate Total Historical Outgoing (Sales + Proportional Waste)
        let totalConsumption = 0;
        
        salesSnap.forEach(saleDoc => {
            const sale = saleDoc.data();
            sale.items.forEach((si: any) => {
                const product = itemsMap.get(si.itemId);
                if (!product) return;
                const effectiveQty = Number(si.quantity || 0) - Number(si.refundedQuantity || 0);
                if (effectiveQty <= 0) return;

                if (si.itemId === itemId) {
                    totalConsumption += effectiveQty;
                } else if (product.inventoryType === 'composite' && product.components) {
                    const usage = product.components.find((c: any) => c.itemId === itemId);
                    if (usage) {
                        const yieldVal = product.yield || 1;
                        totalConsumption += (Number(usage.quantity) * (effectiveQty / yieldVal));
                    }
                }
            });
        });

        // Add direct and proportional waste
        wasteSnap.forEach(wasteDoc => {
            const waste = wasteDoc.data();
            const wastedItem = itemsMap.get(waste.itemId);
            if (!wastedItem) return;

            if (waste.itemId === itemId) {
                totalConsumption += Number(waste.quantity || 0);
            } else if (wastedItem.inventoryType === 'composite' && wastedItem.components) {
                const usage = wastedItem.components.find((c: any) => c.itemId === itemId);
                if (usage) {
                    const yieldVal = wastedItem.yield || 1;
                    totalConsumption += (Number(usage.quantity) * (Number(waste.quantity) / yieldVal));
                }
            }
        });
        
        let remainingToDeduct = roundTo(totalConsumption);

        // 3. Apply FIFO Deduction
        const resultingBatches: StockBatch[] = [];
        for (const b of originalBatchesFromLogs) {
            if (remainingToDeduct > 0) {
                const deduct = Math.min(b.quantity, remainingToDeduct);
                const left = roundTo(b.quantity - deduct);
                remainingToDeduct = roundTo(remainingToDeduct - deduct);
                if (left > 0) {
                    resultingBatches.push({ ...b, quantity: left });
                }
            } else {
                resultingBatches.push(b);
            }
        }

        batch.update(doc(firestore, 'items', itemId), { stockBatches: resultingBatches });
        updateCount++;
    }

    if (updateCount > 0) await batch.commit();
    return updateCount;
}

type ResetType = 'stock' | 'activity' | 'waste' | 'french-vanilla-syrup' | 'brown-sugar' | 'frappe-base' | 'espresso-blend' | 'salted-butter' | 'graham-crackers' | 'sync-all' | 'global-recon';

interface ResetConfig {
    title: string;
    description: string;
    buttonText: string;
    icon: React.ReactNode;
}

export function DataManager() {
  const [isPending, startTransition] = useTransition();
  const [resetType, setResetType] = useState<ResetType | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleReset = () => {
    if (!resetType) return;

    startTransition(async () => {
      try {
        if (resetType === 'stock') {
            await resetAllStockAction(firestore);
            toast({ title: 'Success!', description: 'All stock batches cleared.' });
        } else if (resetType === 'activity') {
            await resetAllStockActivityAction(firestore);
            toast({ title: 'Success!', description: 'Stock activity log cleared.' });
        } else if (resetType === 'waste') {
            await resetAllWasteEventsAction(firestore);
            toast({ title: 'Success!', description: 'Waste events deleted.' });
        } else if (resetType === 'global-recon') {
            const count = await runGlobalInventoryReconciliation(firestore);
            toast({ title: 'Reconciliation Complete!', description: `Audited ${count} items. Stock batches are now synced with historical sales and waste logs.` });
        } else if (resetType === 'graham-crackers') {
            const itemsSnap = await getDocs(collection(firestore, 'items'));
            const crackerDoc = itemsSnap.docs.find(d => {
                const n = (d.data().name || '').toLowerCase().trim();
                return n === 'graham crackers' || n === 'graham cracker';
            });
            if (!crackerDoc) throw new Error("Graham Crackers item not found.");
            
            const group1 = [
                'Mango Graham Cheesecake [16oz] [Dine]',
                'Mango Graham [16oz] [Out]',
                'Mango Graham Cheesecake [16oz] [Out]',
                'Mango Graham [16oz] [Dine]'
            ].map(p => p.toLowerCase().trim());

            const group2 = [
                'Mango Graham Cheesecake [22oz] [Out]',
                'Mango Graham Cheesecake [22oz] [Dine]',
                'Mango Graham [22oz] [Dine]',
                'Mango Graham [22oz] [Out]'
            ].map(p => p.toLowerCase().trim());

            const batchR = writeBatch(firestore);
            let updatedRecipesCount = 0;

            itemsSnap.docs.forEach(d => {
                const product = d.data();
                const productName = (product.name || '').toLowerCase().trim();
                let targetQty = 0;

                if (group1.includes(productName)) targetQty = 1;
                else if (group2.includes(productName)) targetQty = 2;

                if (targetQty > 0 && product.components) {
                    let needsUpdate = false;
                    const newComponents = product.components.map((c: any) => {
                        if (c.itemId === crackerDoc.id) {
                            if (Number(c.quantity) !== targetQty) {
                                needsUpdate = true;
                                return { ...c, quantity: targetQty };
                            }
                        }
                        return c;
                    });
                    if (needsUpdate) {
                        batchR.update(d.ref, { components: newComponents });
                        updatedRecipesCount++;
                    }
                }
            });

            if (updatedRecipesCount > 0) await batchR.commit();
            await runGlobalInventoryReconciliation(firestore, crackerDoc.id);
            toast({ title: 'Graham Crackers Synced!', description: `Updated ${updatedRecipesCount} recipes and audited inventory.` });

        } else if (resetType === 'french-vanilla-syrup') {
            const itemsSnap = await getDocs(collection(firestore, 'items'));
            const syrupDoc = itemsSnap.docs.find(d => {
                const n = (d.data().name || '').toLowerCase().trim();
                return n === 'french vanilla syrup' || n === 'french vanilla';
            });
            if (!syrupDoc) throw new Error("French Vanilla Syrup item not found.");
            
            const targetProducts = [
                'milky strawberry [16oz]', 'milky green apple [16oz]', 'milky blueberry [16oz]',
                'milky kiwi [16oz]', 'green apple pop [22oz]', 'blueberry pop [22oz]', 'kiwi pop [22oz]'
            ].map(p => p.toLowerCase().trim());

            const batchR = writeBatch(firestore);
            let updatedRecipesCount = 0;

            itemsSnap.docs.forEach(d => {
                const product = d.data();
                const productName = (product.name || '').toLowerCase().trim();
                if (targetProducts.includes(productName)) {
                    if (product.components) {
                        let needsUpdate = false;
                        const newComponents = product.components.map((c: any) => {
                            if (c.itemId === syrupDoc.id && Number(c.quantity) === 15) {
                                needsUpdate = true;
                                return { ...c, quantity: 10 };
                            }
                            return c;
                        });
                        if (needsUpdate) {
                            batchR.update(d.ref, { components: newComponents });
                            updatedRecipesCount++;
                        }
                    }
                }
            });

            if (updatedRecipesCount > 0) await batchR.commit();
            await runGlobalInventoryReconciliation(firestore, syrupDoc.id);
            toast({ title: 'French Vanilla Syrup Repaired!', description: `Updated ${updatedRecipesCount} recipes and audited stock history.` });

        } else if (resetType === 'brown-sugar') {
            const itemsSnap = await getDocs(collection(firestore, 'items'));
            const sugarDoc = itemsSnap.docs.find(d => (d.data().name || '').toLowerCase().trim() === 'brown sugar');
            if (!sugarDoc) throw new Error("Brown Sugar item not found.");

            const mappings: Record<string, number> = {
                "1.75": 1.5, "8.25": 11.25, "16.5": 19.5, "17": 19.5, "18": 19.5, 
                "20": 19.5, "28.25": 27.5, "28.5": 27.5, "33": 36, "34.5": 36, 
                "36.5": 36, "49.5": 52.5, "67.5": 69
            };

            const batchS = writeBatch(firestore);
            let updatedCount = 0;

            itemsSnap.docs.forEach(d => {
                const item = d.data();
                if (item.components) {
                    let changed = false;
                    const newComps = item.components.map((c: any) => {
                        if (c.itemId === sugarDoc.id) {
                            const val = String(c.quantity);
                            if (mappings[val] !== undefined) {
                                changed = true;
                                return { ...c, quantity: mappings[val] };
                            }
                        }
                        return c;
                    });
                    if (changed) {
                        batchS.update(d.ref, { components: newComps });
                        updatedCount++;
                    }
                }
            });

            if (updatedCount > 0) await batchS.commit();
            await runGlobalInventoryReconciliation(firestore, sugarDoc.id);
            toast({ title: 'Brown Sugar Synced!', description: `Updated ${updatedCount} recipes and recalculated current stock.` });

        } else if (resetType === 'frappe-base') {
            const itemsSnap = await getDocs(collection(firestore, 'items'));
            const baseDoc = itemsSnap.docs.find(d => (d.data().name || '').toLowerCase().trim() === 'frappe base');
            if (!baseDoc) throw new Error("Frappe Base item not found.");

            const batchF = writeBatch(firestore);
            let updatedCount = 0;
            itemsSnap.docs.forEach(d => {
                const item = d.data();
                if (item.components) {
                    let changed = false;
                    const newComps = item.components.map((c: any) => {
                        if (c.itemId === baseDoc.id) {
                            if (Number(c.quantity) === 36) { changed = true; return { ...c, quantity: 36.3 }; }
                            if (Number(c.quantity) === 48) { changed = true; return { ...c, quantity: 48.4 }; }
                        }
                        return c;
                    });
                    if (changed) { batchF.update(d.ref, { components: newComps }); updatedCount++; }
                }
            });
            if (updatedCount > 0) await batchF.commit();
            await runGlobalInventoryReconciliation(firestore, baseDoc.id);
            toast({ title: 'Frappe Base Synced!', description: `Updated ${updatedCount} recipes and audited inventory.` });

        } else if (resetType === 'espresso-blend' || resetType === 'salted-butter') {
            const itemsSnap = await getDocs(collection(firestore, 'items'));
            const targetName = resetType === 'espresso-blend' ? 'espresso blend' : 'salted butter';
            const targetDoc = itemsSnap.docs.find(d => (d.data().name || '').toLowerCase().trim() === targetName);
            if (!targetDoc) throw new Error(`${targetName} not found.`);
            await runGlobalInventoryReconciliation(firestore, targetDoc.id);
            toast({ title: 'Sync Complete', description: `Audited and restored batches for ${targetName}.` });

        } else if (resetType === 'sync-all') {
            const itemsSnapshot = await getDocs(collection(firestore, 'items'));
            const batch = writeBatch(firestore);
            itemsSnapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (data.stockBatches) {
                    const clean = data.stockBatches.map((b: any) => ({ ...b, quantity: roundTo(Number(b.quantity || 0)) }));
                    batch.update(docSnap.ref, { stockBatches: clean });
                }
            });
            await batch.commit();
            toast({ title: 'Normalization Complete' });
        }
      } catch (error) {
      console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Operation failed.' });
      } finally {
        setResetType(null);
      }
    });
  };

  const resetConfigs: Record<ResetType, ResetConfig> = {
      'global-recon': { title: "Master Inventory Sync", description: "The definitive tool to run after editing recipes. Rebuilds every item's batches by auditing your full Stock-In, Sales, and Waste history (FIFO).", buttonText: "Run Master Sync", icon: <ShieldCheck className="h-5 w-5 text-primary" /> },
      'graham-crackers': { title: "Audit Graham Crackers", description: "Sync recipes for Mango Graham products (16oz -> 1, 22oz -> 2) and audit historical consumption to update current stock.", buttonText: "Sync Graham", icon: <Zap className="h-5 w-5 text-primary" /> },
      'french-vanilla-syrup': { title: "Audit French Vanilla Syrup", description: "Robust matching to update recipes (15 to 10) for milky/pop products and audit history.", buttonText: "Sync Vanilla", icon: <Zap className="h-5 w-5 text-primary" /> },
      'brown-sugar': { title: "Audit Brown Sugar", description: "Apply all 13 recipe mappings (1.75 -> 1.5, etc.) and audit historical consumption.", buttonText: "Sync Sugar", icon: <Sparkles className="h-5 w-5 text-primary" /> },
      'frappe-base': { title: "Audit Frappe Base", description: "Update recipes (36 -> 36.3, 48 -> 48.4) and audit historical consumption.", buttonText: "Sync Frappe", icon: <Sparkles className="h-5 w-5 text-primary" /> },
      'espresso-blend': { title: "Audit Espresso Blend", description: "Recalculate Espresso Blend current stock based on historical receipts and sales.", buttonText: "Sync Espresso", icon: <Package className="h-5 w-5 text-primary" /> },
      'salted-butter': { title: "Audit Salted Butter", description: "Recalculate Salted Butter current stock based on historical receipts and sales.", buttonText: "Sync Butter", icon: <Package className="h-5 w-5 text-primary" /> },
      'sync-all': { title: "Normalize Precision", description: "Ensure high-precision rounding (4 decimals) for all numeric stock data.", buttonText: "Normalize", icon: <RefreshCcw className="h-5 w-5 text-primary" /> },
      stock: { title: "Reset All Stock Counts", description: "DANGER: Set all item quantities to zero. Only use if you plan to re-import starting inventory.", buttonText: "Reset Stock", icon: <Package className="h-5 w-5 text-destructive" /> },
      activity: { title: "Clear Activity Log", description: "DANGER: Delete all stock receipt records. This will break future reconciliations.", buttonText: "Clear Activity", icon: <History className="h-5 w-5 text-destructive" /> },
      waste: { title: "Clear Waste Log", description: "DANGER: Delete all recorded waste and pull-out events.", buttonText: "Clear Waste", icon: <Trash2 className="h-5 w-5 text-destructive" /> },
  };

  return (
    <>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Data Integrity & Reconciliation</CardTitle>
            <CardDescription>Tools to synchronize your physical inventory with digital records after recipe or component changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.entries(resetConfigs) as [ResetType, ResetConfig][]).map(([type, config]) => {
              const isDanger = ['stock', 'activity', 'waste'].includes(type);
              const isMaster = type === 'global-recon';
              const isAudit = ['french-vanilla-syrup', 'brown-sugar', 'frappe-base', 'espresso-blend', 'salted-butter', 'graham-crackers'].includes(type);
              
              return (
                  <div key={type} className={cn(
                    "flex items-center justify-between rounded-lg border p-4 transition-colors",
                    isDanger ? "border-destructive/20 bg-destructive/5 hover:bg-destructive/10" : 
                    isMaster ? "border-primary bg-primary/10 hover:bg-primary/20" : 
                    isAudit ? "border-primary/20 bg-primary/5 hover:bg-primary/10" :
                    "border-muted bg-muted/20"
                  )}>
                      <div className="flex items-start gap-3">
                          <div className="mt-1">{config.icon}</div>
                          <div>
                            <h3 className={cn("font-semibold", isMaster && "text-primary")}>{config.title}</h3>
                            <p className="text-sm text-muted-foreground">{config.description}</p>
                          </div>
                      </div>
                      <Button 
                        variant={isDanger ? "destructive" : isMaster ? "default" : "outline"} 
                        onClick={() => setResetType(type)} 
                        disabled={isPending} 
                        className="ml-4 shrink-0 min-w-[120px]"
                      >
                          {isPending && resetType === type ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : config.buttonText}
                      </Button>
                  </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!resetType} onOpenChange={(open) => !open && !isPending && setResetType(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className={cn("h-5 w-5", resetType && ['stock', 'activity', 'waste'].includes(resetType) ? "text-destructive" : "text-primary")} /> 
                Confirm Data Operation
            </AlertDialogTitle>
            <AlertDialogDescription>{resetType && resetConfigs[resetType].description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={isPending} className={cn(resetType && ['stock', 'activity', 'waste'].includes(resetType) ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90")}>
              {isPending ? "Processing..." : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
