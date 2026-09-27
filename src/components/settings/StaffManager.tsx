'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { StaffWithId } from '@/types';
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

const staffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type StaffFormData = z.infer<typeof staffSchema>;

interface StaffManagerProps {
  initialStaff: StaffWithId[];
}

export function StaffManager({ initialStaff }: StaffManagerProps) {
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const { toast } = useToast();
  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: '',
    },
  });

  const handleOpenForm = (staff: StaffWithId | null) => {
    setEditingStaff(staff);
    if (staff) {
      form.reset({ name: staff.name });
    } else {
      form.reset({ name: '' });
    }
    setIsFormOpen(true);
  };

  const onSubmit = (data: StaffFormData) => {
    startTransition(async () => {
      try {
        const dataToSave = { name: data.name };
        if (editingStaff) {
          const docRef = doc(firestore, 'staff', editingStaff.id);
          await updateDoc(docRef, dataToSave);
        } else {
          await addDoc(collection(firestore, 'staff'), dataToSave);
        }
        toast({ title: 'Success', description: 'Staff member saved.' });
        setIsFormOpen(false);
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save staff member.' });
      }
    });
  };

  const handleDelete = () => {
    if (staffToDelete) {
      startTransition(async () => {
        try {
          await deleteDoc(doc(firestore, 'staff', staffToDelete));
          toast({ title: 'Success', description: 'Staff member deleted.' });
        } catch (error) {
          console.error(error);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete staff member.' });
        } finally {
          setStaffToDelete(null);
        }
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Manage Staff</CardTitle>
          <Button onClick={() => handleOpenForm(null)}>
            <PlusCircle className="mr-2" />
            Add Staff
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {initialStaff.map((staff) => (
              <div
                key={staff.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{staff.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenForm(staff)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setStaffToDelete(staff.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {initialStaff.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No staff found. Add one to get started.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => setIsFormOpen(open)}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? 'Edit Staff' : 'Add New Staff'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Juan dela Cruz" {...field} />
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
                  {editingStaff ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!staffToDelete} onOpenChange={(open) => !open && setStaffToDelete(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the staff member.
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
