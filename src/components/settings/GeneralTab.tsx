'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsProvider';
import { api, ApiError } from '@/lib/api-client';
import type { PosSettings } from '@/lib/types';

export function GeneralTab() {
  const { settings, reload } = useSettings();
  const { toast } = useToast();
  const [currency, setCurrency] = useState(settings.currency);
  const [defaultSaleType, setDefaultSaleType] = useState<PosSettings['defaultSaleType']>(settings.defaultSaleType);
  const [busy, setBusy] = useState(false);

  // Sync form once settings arrive from the server.
  useEffect(() => {
    setCurrency(settings.currency);
    setDefaultSaleType(settings.defaultSaleType);
  }, [settings]);

  const save = async () => {
    setBusy(true);
    try {
      await api('/api/settings', { method: 'PATCH', body: { currency, defaultSaleType } });
      await reload();
      toast({ title: 'Settings saved' });
    } catch (e) {
      toast({
        title: 'Could not save settings',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-xl shadow-warm">
      <CardHeader>
        <CardTitle className="font-headline text-lg">Shop preferences</CardTitle>
        <CardDescription>Currency symbol and the default order type at the register.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency symbol</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="₱"
              maxLength={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default sale type</Label>
            <Select value={defaultSaleType} onValueChange={(v) => setDefaultSaleType(v as PosSettings['defaultSaleType'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dine-in">Dine-in</SelectItem>
                <SelectItem value="take-away">Take-away</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="btn-press" onClick={save} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save preferences
        </Button>
      </CardContent>
    </Card>
  );
}
