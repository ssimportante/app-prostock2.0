'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Printer, Trash2 } from 'lucide-react';
import { BluetoothThermalPrinter } from '@/lib/bluetoothPrinter';

export function PrinterSettingsManager() {
  const [savedPrinter, setSavedPrinter] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const printer = localStorage.getItem('pos_preferred_printer') || '';
    setSavedPrinter(printer);
  }, []);

  const handleSave = (name: string) => {
    localStorage.setItem('pos_preferred_printer', name);
    setSavedPrinter(name);
    toast({ title: 'Printer Saved', description: `Will now default to ${name}` });
  };

  const handleClear = () => {
    localStorage.removeItem('pos_preferred_printer');
    setSavedPrinter('');
    toast({ title: 'Printer Cleared', description: 'Will now ask for any available printer.' });
  };

  const testConnect = async () => {
    try {
      const printer = new BluetoothThermalPrinter();
      const deviceName = await printer.connect(); 
      if (deviceName) {
         handleSave(deviceName);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Connection Failed', description: e.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bluetooth Printer (Local)</CardTitle>
        <CardDescription>Configure a specific Bluetooth receipt printer for this device.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Preferred Printer Name</Label>
          <div className="flex gap-2">
            <Input 
              value={savedPrinter} 
              onChange={(e) => setSavedPrinter(e.target.value)} 
              placeholder="e.g. MPT-II"
            />
            <Button onClick={() => handleSave(savedPrinter)} disabled={!savedPrinter}>Save</Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Entering the exact device name will restrict the Bluetooth pairing prompt to only show that printer.
          </p>
        </div>
        
        <div className="flex gap-4 pt-2">
          <Button variant="outline" onClick={testConnect}>
            <Printer className="mr-2 h-4 w-4" />
            Find & Save Printer
          </Button>
          {savedPrinter && (
            <Button variant="destructive" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Printer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
