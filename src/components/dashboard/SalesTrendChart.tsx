'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/money';
import type { SalesByDayEntry } from '@/lib/types';

export function SalesTrendChart({ data, currency }: { data: SalesByDayEntry[]; currency: string }) {
  return (
    <Card className="shadow-warm">
      <CardHeader className="pb-2">
        <CardTitle className="font-headline text-lg font-semibold">Sales trend</CardTitle>
        <CardDescription>Daily revenue over the last 14 days</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(16 72% 43%)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="hsl(16 72% 43%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(32 16% 85%)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'hsl(26 10% 42%)' }}
              interval="preserveStartEnd"
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
              labelStyle={{ fontWeight: 600 }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid hsl(32 16% 85%)',
                background: 'hsl(40 50% 99%)',
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(16 72% 43%)"
              strokeWidth={2.5}
              fill="url(#revenueFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
