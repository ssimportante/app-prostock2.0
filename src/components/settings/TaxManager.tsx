
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { TaxWithId } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Edit, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const taxSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  rate: z.coerce.number().min(0, 'Rate must be non-negative'),
  taxType: z.enum(['additive', 'compounded']).default('additive'),
});

type TaxFormData = z.infer<typeof taxSchema>;

interface TaxManagerProps {
  initialTaxes: TaxWithId[];
}

export function TaxManager({ initialTaxes }: TaxManagerProps) {
  const [taxToDelete, setTaxToDelete] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const { toast } = useToast();
  const form = useForm<TaxFormData>({
    resolver: zodResolver(taxSchema),
    defaultValues: { name: '', rate: 0, taxType: 'additive' },
  });

  const handleOpenForm = (tax: TaxWithId | null) => {
    setEditingTax(tax);
    form.reset(tax ? { name: tax.name, rate: tax.rate, taxType: tax.taxType || 'additive' } : { name: '', rate: 0, taxType: 'additive' });
    setIsFormOpen(true);
  };

  const onSubmit = (data: TaxFormData) => {
    startTransition(async () => {
      try {
        const dataToSave = { name: data.name, rate: data.rate, taxType: data.taxType };
        if (editingTax) {
          await updateDoc(doc(firestore, 'taxes', editingTax.id), dataToSave);
        } else {
          await addDoc(collection(firestore, 'taxes'), dataToSave);
        }
        toast({ title: 'Success', description: 'Tax saved.' });
        setIsFormOpen(false);
      } catch (error) {
      console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save tax.' });
      }
    });
  };

  const handleDelete = () => {
    if (taxToDelete) {
      startTransition(async () => {
        try {
          await deleteDoc(doc(firestore, 'taxes', taxToDelete));
          toast({ title: 'Success', description: 'Tax deleted.' });
        } catch (error) {
      console.error(error);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete tax.' });
        } finally {
          setTaxToDelete(null);
        }
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Manage Taxes</CardTitle>
          <Button onClick={() => handleOpenForm(null)}>
            <PlusCircle className="mr-2" />
            Add Tax
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {initialTaxes.map((tax) => (
              <div key={tax.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{tax.name}</span>
                  <span className="text-sm text-muted-foreground">{tax.rate}%</span>
                  <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">{tax.taxType || 'additive'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenForm(tax)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setTaxToDelete(tax.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {initialTaxes.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No taxes found. Add one to get started.</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingTax ? 'Edit Tax' : 'Add New Tax'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Sales Tax" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate (%)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g., 8.25" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Application</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select how tax is applied" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="additive">Additive</SelectItem>
                            <SelectItem value="compounded">Compounded</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormDescription>
                        Additive taxes are summed. Compounded taxes are applied after all additive taxes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingTax ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!taxToDelete} onOpenChange={(open) => !open && setTaxToDelete(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tax rate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
