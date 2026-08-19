'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pie,
  PieChart,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import type { PosSettings } from "@/types";
import { useMemo } from "react";

interface InventoryMovementChartProps {
  title: string;
  data: {
    totalStockValue: number;
    totalConsumedValue: number;
    totalWasteValue: number;
    totalPullOutValue: number;
  };
  settings: PosSettings;
}

export default function InventoryMovementChart({ title, data, settings }: InventoryMovementChartProps) {
  const chartData = useMemo(() => [
    { name: "Current Stock", value: data.totalStockValue, fill: "hsl(var(--accent))" },
    { name: "Consumed (Sales)", value: data.totalConsumedValue, fill: "hsl(var(--primary))" },
    { name: "Waste", value: data.totalWasteValue, fill: "hsl(var(--destructive))" },
    { name: "Pull Out", value: data.totalPullOutValue, fill: "hsl(var(--chart-4))" },
  ].filter(item => item.value > 0), [data]);

  const chartConfig = {
    value: {
      label: "Value",
    },
    "Current Stock": { label: "Current Stock", color: "hsl(var(--accent))" },
    "Consumed (Sales)": { label: "Consumed (Sales)", color: "hsl(var(--primary))" },
    "Waste": { label: "Waste", color: "hsl(var(--destructive))" },
    "Pull Out": { label: "Pull Out", color: "hsl(var(--chart-4))" },
  };

  return (
    <Card className="h-full">
      <CardHeader className="p-6">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription>Proportional value comparison of stock lifecycle states.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 flex flex-col items-center justify-center">
        {chartData.length > 0 ? (
          <div className="h-[350px] w-full max-w-[400px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel formatter={(value) => formatCurrency(value as number, settings.currency)} />}
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={110}
                  strokeWidth={4}
                  stroke="hsl(var(--background))"
                  labelLine={false}
                  label={({
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
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent className="text-sm" />} />
              </PieChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm italic text-center px-4">
            No stock movement data for {title.toLowerCase()}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}