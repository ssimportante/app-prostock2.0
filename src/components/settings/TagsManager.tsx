'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Loader2, Trash2, Tag } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { ItemWithId } from '@/types';
import { Skeleton } from '../ui/skeleton';

async function deleteTagFromAllItemsAction(firestore: any, tagToDelete: string) {
    const itemsRef = collection(firestore, 'items');
    const q = query(itemsRef, where('tags', 'array-contains', tagToDelete));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return;

    const batch = writeBatch(firestore);
    querySnapshot.forEach(docSnap => {
        const item = docSnap.data() as ItemWithId;
        const updatedTags = item.tags?.filter(t => t !== tagToDelete);
        batch.update(docSnap.ref, { tags: updatedTags });
    });
    
    await batch.commit();
}


export function TagsManager() {
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const itemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'items'));
  }, [firestore]);
  
  const { data: items, isLoading } = useCollection<ItemWithId>(itemsQuery);
  
  const uniqueTags = useMemo(() => {
      if (!items) return [];
      const allTags = items.flatMap(item => item.tags || []);
      return [...new Set(allTags)].sort((a,b) => a.localeCompare(b));
  }, [items]);

  const handleDelete = () => {
    if (tagToDelete) {
        startTransition(async () => {
            try {
                await deleteTagFromAllItemsAction(firestore, tagToDelete);
                toast({ title: 'Success', description: `Tag "${tagToDelete}" deleted from all items.` });
            } catch (error) {
      console.error(error);
                 toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete tag.' });
            } finally {
                setTagToDelete(null);
            }
        });
    }
  };

  if (isLoading) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Manage Tags</CardTitle>
                  <CardDescription>Globally remove tags from all items.</CardDescription>
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
        <CardHeader>
          <CardTitle>Manage Tags</CardTitle>
           <CardDescription>Globally remove tags from all items.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {uniqueTags.map((tag) => (
              <div
                key={tag}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{tag}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTagToDelete(tag)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
             {uniqueTags.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No tags found across all items.</p>
             )}
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the tag "{tagToDelete}" from all items that use it. This action cannot be undone.
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
