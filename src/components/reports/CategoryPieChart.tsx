'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney } from '@/lib/money';
import type { CategoryDistEntry } from '@/lib/types';

export function CategoryPieChart({ data, currency }: { data: CategoryDistEntry[]; currency: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card className="shadow-warm">
      <CardHeader className="pb-2">
        <CardTitle className="font-headline text-lg font-semibold">Revenue by category</CardTitle>
        <CardDescription>Where your sales come from</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        {data.length === 0 ? (
          <p className="pt-16 text-center text-sm text-muted-foreground">No sales recorded yet.</p>
        ) : (
          <div className="flex h-full flex-col">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="52%"
                  outerRadius="78%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | string, name) => [
                    `${formatMoney(Number(value), currency)} (${Math.round((Number(value) / total) * 100)}%)`,
                    String(name),
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(32 16% 85%)',
                    background: 'hsl(40 50% 99%)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-2">
              {data.slice(0, 5).map((entry) => (
                <span key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                  {entry.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
