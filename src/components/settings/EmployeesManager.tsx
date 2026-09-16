'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { EmployeeWithId } from '@/types';
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
import { Edit, Loader2, PlusCircle, Trash2, User } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, addDoc, collection, deleteDoc, query, Timestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';

const employeeSchema = z.object({
  name: z.string().min(2, 'Name is required'),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export function EmployeesManager() {
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeWithId | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const { toast } = useToast();

  const employeesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'employees'));
  }, [firestore]);

  const { data: employees, isLoading } = useCollection<EmployeeWithId>(employeesQuery);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: '',
    },
  });

  const handleOpenForm = (employee: EmployeeWithId | null) => {
    setEditingEmployee(employee);
    form.reset({ name: employee?.name || '' });
    setIsFormOpen(true);
  };

  const onSubmit = (data: EmployeeFormData) => {
    startTransition(async () => {
      try {
        if (editingEmployee) {
          await updateDoc(doc(firestore, 'employees', editingEmployee.id), { name: data.name });
        } else {
          await addDoc(collection(firestore, 'employees'), {
            name: data.name,
            createdAt: Timestamp.fromDate(new Date()),
          });
        }
        toast({ title: 'Success', description: `Employee ${editingEmployee ? 'updated' : 'created'}.` });
        setIsFormOpen(false);
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save employee.' });
      }
    });
  };

  const handleDelete = () => {
    if (!employeeToDelete) return;
    startTransition(async () => {
      try {
        await deleteDoc(doc(firestore, 'employees', employeeToDelete.id));
        toast({ title: 'Success', description: 'Employee deleted. Past stock records keep the name they were saved with.' });
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete employee.' });
      } finally {
        setEmployeeToDelete(null);
      }
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manage Employees</CardTitle>
          <CardDescription>Names available on stock receive and waste forms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Manage Employees</CardTitle>
          <Button onClick={() => handleOpenForm(null)}>
            <PlusCircle className="mr-2" />
            Add Employee
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(employees || []).map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{employee.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenForm(employee)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEmployeeToDelete(employee)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {(!employees || employees.length === 0) && (
              <p className="text-center text-muted-foreground py-4">No employees found. Add one to get started.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Juan Dela Cruz" {...field} />
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
                  {editingEmployee ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the employee "{employeeToDelete?.name}" from the list.
              Historical stock records will keep the name they were saved with. This action cannot be undone.
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
