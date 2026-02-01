'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Briefcase, TrendingUp, TrendingDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";

const data = [
    { month: "Jan", revenue: 45000 },
    { month: "Feb", revenue: 52000 },
    { month: "Mar", revenue: 48000 },
    { month: "Apr", revenue: 61000 },
    { month: "May", revenue: 55000 },
    { month: "Jun", revenue: 67000 },
];

export function RevenueWidget() {
    return (
        <Card className="col-span-full h-full">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <DollarSign className="size-5 text-primary" />
                        <CardTitle>Revenue & Performance</CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">Monthly metrics vs Target</p>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex h-[200px] flex-col gap-6 lg:flex-row">
                    {/* Stats Column - Clean Vertical List */}
                    <div className="flex flex-col justify-center gap-6 lg:w-1/4">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">Deals Closed</span>
                                <Badge variant="outline" className="gap-1 text-green-600 bg-green-500/10 border-0">
                                    <TrendingUp className="size-3" /> +2
                                </Badge>
                            </div>
                            <div className="mt-1 text-3xl font-bold">12</div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">Revenue</span>
                                <Badge variant="outline" className="gap-1 text-green-600 bg-green-500/10 border-0">
                                    <TrendingUp className="size-3" /> +15%
                                </Badge>
                            </div>
                            <div className="mt-1 text-3xl font-bold">$328k</div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">GCI</span>
                                <span className="text-xs font-semibold text-green-600">Target Met</span>
                            </div>
                            <div className="mt-1 text-3xl font-bold">$82k</div>
                        </div>
                    </div>

                    {/* Chart Column - Full Height & Width */}
                    <div className="min-h-0 flex-1 rounded-lg border bg-muted/10 p-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} padding={{ left: 10, right: 10 }} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    formatter={(value) => [`$${value}`, 'Revenue']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
