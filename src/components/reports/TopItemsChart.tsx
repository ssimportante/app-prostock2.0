'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/money';
import type { TopItemEntry } from '@/lib/types';

export function TopItemsChart({ data, currency }: { data: TopItemEntry[]; currency: string }) {
  return (
    <Card className="shadow-warm">
      <CardHeader className="pb-2">
        <CardTitle className="font-headline text-lg font-semibold">Top sellers</CardTitle>
        <CardDescription>Items ranked by net revenue</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        {data.length === 0 ? (
          <p className="pt-16 text-center text-sm text-muted-foreground">No sales recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(32 16% 85%)" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'hsl(26 10% 42%)' }}
                tickFormatter={(v: number) => `${Math.round(v / 100) / 10}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={124}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'hsl(22 25% 12%)' }}
              />
              <Tooltip
                formatter={(value: number | string) => formatMoney(Number(value), currency)}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid hsl(32 16% 85%)',
                  background: 'hsl(40 50% 99%)',
                }}
              />
              <Bar dataKey="revenue" fill="hsl(16 72% 43%)" radius={[0, 6, 6, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
