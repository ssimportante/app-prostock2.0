'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pie,
  PieChart,
  Cell,
} from "recharts";
import { ItemWithId, CategoryWithId } from "@/types";
import { useMemo } from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";


interface CategoryDistributionChartProps {
  items: ItemWithId[];
  categories: CategoryWithId[];
}

export default function CategoryDistributionChart({ items, categories }: CategoryDistributionChartProps) {
  const data = useMemo(() => {
    const categoryMap = new Map(categories.map(c => [c.id, { name: c.name, color: c.color, value: 0 }]));
    
    for (const item of items) {
      if (item.categoryId && categoryMap.has(item.categoryId)) {
        categoryMap.get(item.categoryId)!.value++;
      }
    }
    
    return Array.from(categoryMap.values())
      .map(category => ({
        ...category,
        fill: category.color,
      }))
      .filter(c => c.value > 0);

  }, [items, categories]);

  const chartConfig = useMemo(() => data.reduce((acc, category) => {
    acc[category.name] = { label: category.name, color: category.fill };
    return acc;
  }, {} as any), [data]);

  return (
    <Card className="h-full">
      <CardHeader className="p-6">
        <CardTitle className="text-lg font-bold">Category Distribution</CardTitle>
        <CardDescription>Number of items per category.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 flex flex-col items-center justify-center">
        {data.length > 0 ? (
          <div className="h-[350px] w-full max-w-[400px]">
              <ChartContainer config={chartConfig} className="w-full h-full">
                  <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={60} strokeWidth={4} stroke="hsl(var(--background))" labelLine={false} label={({
                          cx,
                          cy,
                          midAngle,
                          innerRadius,
                          outerRadius,
                          percent,
                          }) => {
                          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                          const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                          if (percent < 0.05) return null;
                          return (
                              <text
                              x={x}
                              y={y}
                              fill="white"
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="text-lg font-black drop-shadow-md"
                              >
                              {`${(percent * 100).toFixed(0)}%`}
                              </text>
                          );
                          }}
                      >
                      {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent className="text-sm" />} />
                  </PieChart>
              </ChartContainer>
          </div>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm italic">
              No items with categories found.
          </div>
        )}
      </CardContent>
    </Card>
  );
}