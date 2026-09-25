'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api-client';
import type { Category, Subcategory } from '@/lib/types';

export function CategoriesTab() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#B4552D');
  const [subName, setSubName] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [cats, subs] = await Promise.all([
      api<{ categories: Category[] }>('/api/categories'),
      api<{ subcategories: Subcategory[] }>('/api/subcategories'),
    ]);
    setCategories(cats.categories);
    setSubcategories(subs.subcategories);
  };

  useEffect(() => {
    void reload();
  }, []);

  const addCategory = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api('/api/categories', { method: 'POST', body: { name, color } });
      setName('');
      await reload();
      toast({ title: 'Category added' });
    } catch (e) {
      toast({
        title: 'Could not add category',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async (cat: Category) => {
    try {
      await api(`/api/categories/${cat.id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      toast({
        title: 'Could not delete',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const addSubcategory = async () => {
    if (!subName.trim() || !subCategory) return;
    setBusy(true);
    try {
      await api('/api/subcategories', {
        method: 'POST',
        body: { name: subName, categoryId: subCategory },
      });
      setSubName('');
      await reload();
      toast({ title: 'Subcategory added' });
    } catch (e) {
      toast({
        title: 'Could not add subcategory',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const deleteSubcategory = async (sub: Subcategory) => {
    try {
      await api(`/api/subcategories/${sub.id}`, { method: 'DELETE' });
      await reload();
    } catch {
      toast({ title: 'Could not delete subcategory', variant: 'destructive' });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle className="font-headline text-lg">Categories</CardTitle>
          <CardDescription>Top-level groupings shown across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-card p-0.5"
              aria-label="Category color"
            />
            <Button className="btn-press shrink-0" onClick={addCategory} disabled={busy || !name.trim()}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="h-3 w-3 rounded-full" style={{ background: cat.color }} />
                  {cat.name}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {subcategories.filter((s) => s.categoryId === cat.id).length} sub
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteCategory(cat)}
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle className="font-headline text-lg">Subcategories</CardTitle>
          <CardDescription>Optional finer groupings within a category.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="h-9 w-36 rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="">Category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Subcategory name"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              disabled={!subCategory}
            />
            <Button
              className="btn-press shrink-0"
              onClick={addSubcategory}
              disabled={busy || !subName.trim() || !subCategory}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {subcategories.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm">
                  <span className="text-muted-foreground">
                    {categories.find((c) => c.id === sub.categoryId)?.name} →
                  </span>{' '}
                  <span className="font-medium">{sub.name}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteSubcategory(sub)}
                  aria-label={`Delete ${sub.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {subcategories.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No subcategories yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
