
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { StationWithId } from '@/types';
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

const stationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type StationFormData = z.infer<typeof stationSchema>;

interface StationsManagerProps {
  initialStations: StationWithId[];
}

export function StationsManager({ initialStations }: StationsManagerProps) {
  const [stationToDelete, setStationToDelete] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<StationWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const { toast } = useToast();
  const form = useForm<StationFormData>({
    resolver: zodResolver(stationSchema),
    defaultValues: {
      name: '',
    },
  });

  const handleOpenForm = (station: StationWithId | null) => {
    setEditingStation(station);
    if (station) {
      form.reset({ name: station.name });
    } else {
      form.reset({ name: '' });
    }
    setIsFormOpen(true);
  };

  const onSubmit = (data: StationFormData) => {
    startTransition(async () => {
      try {
        const dataToSave = { name: data.name };
        if (editingStation) {
          const docRef = doc(firestore, 'stations', editingStation.id);
          await updateDoc(docRef, dataToSave);
        } else {
          await addDoc(collection(firestore, 'stations'), dataToSave);
        }
        toast({ title: 'Success', description: 'Station saved.' });
        setIsFormOpen(false);
      } catch (error) {
      console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save station.' });
      }
    });
  };

  const handleDelete = () => {
    if (stationToDelete) {
        startTransition(async () => {
            try {
                await deleteDoc(doc(firestore, 'stations', stationToDelete));
                toast({ title: 'Success', description: 'Station deleted.' });
            } catch (error) {
      console.error(error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete station.' });
            } finally {
                setStationToDelete(null);
            }
        });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Manage Stations</CardTitle>
          <Button onClick={() => handleOpenForm(null)}>
            <PlusCircle className="mr-2" />
            Add Station
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {initialStations.map((station) => (
              <div
                key={station.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{station.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenForm(station)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setStationToDelete(station.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
             {initialStations.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No stations found. Add one to get started.</p>
             )}
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={(open) => setIsFormOpen(open)}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingStation ? 'Edit Station' : 'Add New Station'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Station Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Bar" {...field} />
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
                  {editingStation ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!stationToDelete} onOpenChange={(open) => !open && setStationToDelete(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the station.
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
