
'use client';

import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { PosSettings } from '@/types';

const posSettingsSchema = z.object({
  defaultSaleType: z.enum(['dine-in', 'take-away']),
  currency: z.string().length(3, { message: 'Must be a 3-letter currency code (e.g. USD)'}).transform(v => v.toUpperCase()),
});

type PosSettingsFormData = z.infer<typeof posSettingsSchema>;

async function savePosSettingsAction(firestore: any, settings: PosSettings) {
    await setDoc(doc(firestore, 'settings', 'pos'), settings);
};

const currencies = [
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'USD', name: 'United States Dollar' },
];

export function PosSettingsManager() {
  const { settings, setSettings, loading } = useSettings();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const form = useForm<PosSettingsFormData>({
    resolver: zodResolver(posSettingsSchema),
    defaultValues: settings,
  });

  useEffect(() => {
    if (!loading) {
      form.reset(settings);
    }
  }, [settings, loading, form]);

  const onSubmit = async (data: PosSettingsFormData) => {
    startTransition(async () => {
        try {
            await savePosSettingsAction(firestore, data);
            setSettings(data);
            toast({ title: 'Success', description: 'POS settings saved.' });
        } catch (error) {
      console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save settings.' });
        }
    });
  };

  if (loading) {
    return (
        <Card>
            <CardHeader>
              <CardTitle>POS Settings</CardTitle>
              <CardDescription>Customize the behavior of your Sales Terminal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-10 w-1/2" />
              </div>
               <div className="space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-32" />
            </CardContent>
        </Card>
    )
}

  return (
    <Card>
      <CardHeader>
        <CardTitle>POS Settings</CardTitle>
        <CardDescription>Customize the behavior of your Sales Terminal.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="defaultSaleType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Default Sale Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="dine-in" /></FormControl>
                        <Label className="font-normal">Dine In</Label>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="take-away" /></FormControl>
                        <Label className="font-normal">Take Away</Label>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currencies.sort((a,b) => a.name.localeCompare(b.name)).map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.name} ({currency.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>The currency used for all financial values in the app.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
