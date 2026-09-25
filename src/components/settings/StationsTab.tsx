'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api-client';
import type { Station } from '@/lib/types';

export function StationsTab() {
  const { toast } = useToast();
  const [stations, setStations] = useState<Station[]>([]);
  const [name, setName] = useState('');

  const reload = async () => {
    const data = await api<{ stations: Station[] }>('/api/stations');
    setStations(data.stations);
  };

  useEffect(() => {
    void reload();
  }, []);

  const addStation = async () => {
    if (!name.trim()) return;
    try {
      await api('/api/stations', { method: 'POST', body: { name } });
      setName('');
      await reload();
      toast({ title: 'Station added' });
    } catch (e) {
      toast({
        title: 'Could not add station',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const deleteStation = async (station: Station) => {
    try {
      await api(`/api/stations/${station.id}`, { method: 'DELETE' });
      await reload();
    } catch {
      toast({ title: 'Could not delete station', variant: 'destructive' });
    }
  };

  return (
    <Card className="max-w-xl shadow-warm">
      <CardHeader>
        <CardTitle className="font-headline text-lg">Stations</CardTitle>
        <CardDescription>Prep areas items can be assigned to (Bar, Kitchen, …).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Station name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button className="btn-press shrink-0" onClick={addStation} disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {stations.map((station) => (
            <div
              key={station.id}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <span className="text-sm font-medium">{station.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteStation(station)}
                aria-label={`Delete ${station.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
