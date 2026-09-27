
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CategoryWithId } from '@/types';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Edit, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z
    .string()
    .min(7)
    .max(7)
    .regex(/^#[0-9a-f]{6}$/i, 'Must be a valid hex color (e.g., #RRGGBB)'),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoriesManagerProps {
  initialCategories: CategoryWithId[];
}

export function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  
  const { toast } = useToast();
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      color: '#000000',
    },
  });

  const handleOpenForm = (category: CategoryWithId | null) => {
    setEditingCategory(category);
    if (category) {
      form.reset({ name: category.name, color: category.color });
    } else {
      form.reset({ name: '', color: '#3b82f6' });
    }
    setIsFormOpen(true);
  };

  const onSubmit = (data: CategoryFormData) => {
    startTransition(async () => {
        try {
            const dataToSave = { name: data.name, color: data.color };
            if (editingCategory) {
              const docRef = doc(firestore, 'categories', editingCategory.id);
              await updateDoc(docRef, dataToSave);
            } else {
              await addDoc(collection(firestore, 'categories'), dataToSave);
            }
            toast({ title: 'Success', description: `Category ${editingCategory ? 'updated' : 'created'}.` });
            setIsFormOpen(false);
        } catch (error) {
      console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save category.' });
        }
    });
  };

  const handleDelete = () => {
    if (categoryToDelete) {
        startTransition(async () => {
            try {
                await deleteDoc(doc(firestore, 'categories', categoryToDelete));
                toast({ title: 'Success', description: 'Category deleted.' });
            } catch (error) {
      console.error(error);
                 toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete category.' });
            } finally {
                setCategoryToDelete(null);
            }
        });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Manage Categories</CardTitle>
          <Button onClick={() => handleOpenForm(null)}>
            <PlusCircle className="mr-2" />
            Add Category
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {initialCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-6 w-6 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="font-medium">{category.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({category.itemCount || 0} items)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenForm(category)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCategoryToDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
             {initialCategories.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No categories found. Add one to get started.</p>
             )}
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Beverages" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                         <Input type="color" className="w-12 p-1 h-10" {...field} />
                         <Input placeholder="#3b82f6" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCategory ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the category.
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
