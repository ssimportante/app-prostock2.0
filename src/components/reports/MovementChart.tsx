'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/money';
import type { MovementBreakdown } from '@/lib/types';

export function MovementChart({
  movement,
  currency,
}: {
  movement: { ingredient: MovementBreakdown; packaging: MovementBreakdown };
  currency: string;
}) {
  const data = [
    { stage: 'In stock', ingredient: movement.ingredient.stock, packaging: movement.packaging.stock },
    { stage: 'Consumed', ingredient: movement.ingredient.consumed, packaging: movement.packaging.consumed },
    { stage: 'Waste', ingredient: movement.ingredient.waste, packaging: movement.packaging.waste },
    { stage: 'Pull-outs', ingredient: movement.ingredient.pullOut, packaging: movement.packaging.pullOut },
  ];

  return (
    <Card className="shadow-warm">
      <CardHeader className="pb-2">
        <CardTitle className="font-headline text-lg font-semibold">Inventory movement</CardTitle>
        <CardDescription>Value flow for ingredients vs packaging</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(32 16% 85%)" vertical={false} />
            <XAxis
              dataKey="stage"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'hsl(26 10% 42%)' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 11, fill: 'hsl(26 10% 42%)' }}
              tickFormatter={(v: number) => `${Math.round(v / 100) / 10}k`}
            />
            <Tooltip
              formatter={(value: number | string) => formatMoney(Number(value), currency)}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid hsl(32 16% 85%)',
                background: 'hsl(40 50% 99%)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingredient" name="Ingredients" fill="hsl(16 72% 43%)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="packaging" name="Packaging" fill="hsl(36 80% 50%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
