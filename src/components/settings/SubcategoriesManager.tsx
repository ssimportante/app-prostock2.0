
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { SubcategoryWithId, CategoryWithId } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Edit, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const subcategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().min(1, 'Category is required'),
});

type SubcategoryFormData = z.infer<typeof subcategorySchema>;

interface SubcategoriesManagerProps {
  initialSubcategories: SubcategoryWithId[];
  categories: CategoryWithId[];
}

export function SubcategoriesManager({ initialSubcategories, categories }: SubcategoriesManagerProps) {
  const [subcategoryToDelete, setSubcategoryToDelete] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<SubcategoryWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<SubcategoryFormData>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: {
      name: '',
      categoryId: '',
    },
  });

  const handleOpenForm = (subcategory: SubcategoryWithId | null) => {
    setEditingSubcategory(subcategory);
    if (subcategory) {
      form.reset({ name: subcategory.name, categoryId: subcategory.categoryId });
    } else {
      form.reset({ name: '', categoryId: '' });
    }
    setIsFormOpen(true);
  };

  const onSubmit = (data: SubcategoryFormData) => {
    startTransition(async () => {
      try {
        if (editingSubcategory) {
          const docRef = doc(firestore, 'subcategories', editingSubcategory.id);
          await updateDoc(docRef, data);
        } else {
          await addDoc(collection(firestore, 'subcategories'), data);
        }
        toast({ title: 'Success', description: `Subcategory ${editingSubcategory ? 'updated' : 'created'}.` });
        setIsFormOpen(false);
      } catch (error) {
      console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save subcategory.' });
      }
    });
  };

  const handleDelete = () => {
    if (subcategoryToDelete) {
      startTransition(async () => {
        try {
          await deleteDoc(doc(firestore, 'subcategories', subcategoryToDelete));
          toast({ title: 'Success', description: 'Subcategory deleted.' });
        } catch (error) {
      console.error(error);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete subcategory.' });
        } finally {
          setSubcategoryToDelete(null);
        }
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Manage Subcategories</CardTitle>
            <CardDescription>Organize items into subgroups within categories.</CardDescription>
          </div>
          <Button onClick={() => handleOpenForm(null)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Subcategory
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {initialSubcategories.map((sub) => {
              const category = categories.find(c => c.id === sub.categoryId);
              return (
                <div key={sub.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{sub.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Parent: {category?.name || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenForm(sub)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSubcategoryToDelete(sub.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {initialSubcategories.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No subcategories found. Add one to organize your items.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a parent category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Hot Coffee, Pastries" {...field} />
                    </FormControl>
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
                  {editingSubcategory ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!subcategoryToDelete} onOpenChange={(open) => !open && setSubcategoryToDelete(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the subcategory.
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
