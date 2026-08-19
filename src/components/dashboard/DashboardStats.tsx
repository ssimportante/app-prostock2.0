'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, DollarSign, AlertTriangle, Leaf, Box, Trash2, ArrowUpRight, TrendingUp, ReceiptText, PieChart, ShieldAlert } from 'lucide-react';
import { formatCurrency, cn } from "@/lib/utils";
import type { PosSettings } from "@/types";

interface DashboardStatsProps {
    stats: {
        totalItems: number;
        totalStockValue: number;
        lowStockCount: number;
        ingredientValue: number;
        packagingValue: number;
        categoryCounts: { name: string; count: number; color: string }[];
        totalWasteValue: number;
        totalPullOutValue: number;
        totalRevenue: number;
        totalCogs: number;
        foodCostPercentage: number;
    };
    settings: PosSettings;
}

export default function DashboardStats({ stats, settings }: DashboardStatsProps) {
    const { 
        totalItems, 
        totalStockValue, 
        lowStockCount, 
        ingredientValue, 
        packagingValue, 
        categoryCounts, 
        totalWasteValue, 
        totalPullOutValue,
        totalRevenue,
        totalCogs,
        foodCostPercentage
    } = stats;

    return (
        <div className="space-y-4">
            {/* Top Primary Revenue & Profitability Metrics */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-2xl border-border/70 shadow-xs card-hover bg-gradient-to-br from-card to-primary/[0.03] overflow-hidden relative">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Revenue</span>
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                            {formatCurrency(totalRevenue, settings.currency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="text-primary font-semibold">Gross sales</span> recorded
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/70 shadow-xs card-hover bg-gradient-to-br from-card to-accent/[0.03] overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">COGS (Sold Cost)</span>
                        <div className="p-2 rounded-xl bg-accent/10 text-accent">
                            <ReceiptText className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                            {formatCurrency(totalCogs, settings.currency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Calculated cost of sold goods
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/70 shadow-xs card-hover bg-gradient-to-br from-card to-chart-4/[0.03] overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Food Cost %</span>
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                            <PieChart className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "text-2xl sm:text-3xl font-extrabold tracking-tight",
                            foodCostPercentage > 35 ? "text-destructive" : "text-amber-600"
                        )}>
                            {foodCostPercentage.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Target benchmark: 28% – 35%
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/70 shadow-xs card-hover bg-gradient-to-br from-card to-emerald-500/[0.03] overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Stock Value</span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                            <DollarSign className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                            {formatCurrency(totalStockValue, settings.currency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Current valuation on hand
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary Inventory Health & Operations Row */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                <Card className="rounded-xl border-border/70 shadow-xs card-hover">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Items</span>
                        <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                            <Package className="h-3.5 w-3.5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold">{totalItems}</div>
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1 mt-2">
                            {categoryCounts.slice(0, 3).map(cat => (
                                <div key={cat.name} className="flex items-center gap-1 bg-muted/70 px-1.5 py-0.5 rounded-md text-[10px]">
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                    <span className="font-medium truncate max-w-[65px]">{cat.name}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn(
                    "rounded-xl border-border/70 shadow-xs card-hover",
                    lowStockCount > 0 && "border-amber-500/40 bg-amber-500/[0.02]"
                )}>
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Low Stock</span>
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-xl font-bold", lowStockCount > 0 ? "text-amber-600" : "text-foreground")}>
                            {lowStockCount} <span className="text-xs font-normal text-muted-foreground">SKUs</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {lowStockCount > 0 ? "Requires reordering" : "Levels healthy"}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-border/70 shadow-xs card-hover">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ingredients</span>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                            <Leaf className="h-3.5 w-3.5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold">{formatCurrency(ingredientValue, settings.currency)}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Raw consumable value</p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-border/70 shadow-xs card-hover">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Packaging</span>
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                            <Box className="h-3.5 w-3.5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold">{formatCurrency(packagingValue, settings.currency)}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Containers & cups</p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-border/70 shadow-xs card-hover">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Waste</span>
                        <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-destructive">{formatCurrency(totalWasteValue, settings.currency)}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Spoilage & loss cost</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

