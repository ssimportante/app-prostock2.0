'use client';

import { useEffect, useState } from 'react';
import { Percent, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsProvider';
import { api, ApiError } from '@/lib/api-client';
import type { Tax } from '@/lib/types';

export function TaxesTab() {
  const { taxes, reload } = useSettings();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [local, setLocal] = useState<Tax[]>(taxes);

  useEffect(() => setLocal(taxes), [taxes]);

  const addTax = async () => {
    if (!name.trim()) return;
    try {
      await api('/api/taxes', { method: 'POST', body: { name, rate: Number(rate) || 0 } });
      setName('');
      setRate('');
      await reload();
      toast({ title: 'Tax added' });
    } catch (e) {
      toast({
        title: 'Could not add tax',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const deleteTax = async (tax: Tax) => {
    try {
      await api(`/api/taxes/${tax.id}`, { method: 'DELETE' });
      await reload();
    } catch {
      toast({ title: 'Could not delete tax', variant: 'destructive' });
    }
  };

  return (
    <Card className="max-w-xl shadow-warm">
      <CardHeader>
        <CardTitle className="font-headline text-lg">Taxes</CardTitle>
        <CardDescription>
          Additive rates applied at checkout to items that reference them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Name (e.g. VAT)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="relative w-28">
            <Percent className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pr-8"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="12"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <Button className="btn-press shrink-0" onClick={addTax} disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {local.map((tax) => (
            <div
              key={tax.id}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <span className="text-sm font-medium">
                {tax.name} <span className="text-muted-foreground">· {tax.rate}%</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteTax(tax)}
                aria-label={`Delete ${tax.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {local.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No taxes configured.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
