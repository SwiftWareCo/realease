'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { AlertCircle } from "lucide-react";

const data = [
    { name: 'No Response', value: 45, color: '#ef4444' }, // Red-500
    { name: 'Price Mismatch', value: 25, color: '#f97316' }, // Orange-500
    { name: 'Competitor', value: 15, color: '#3b82f6' }, // Blue-500
    { name: 'Timing', value: 15, color: '#8b5cf6' }, // Violet-500
];

const COLORS = ['#ef4444', '#f97316', '#3b82f6', '#8b5cf6'];

export function DropOffAnalysisWidget() {
    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Drop-off Reasons</CardTitle>
                <CardDescription>Why leads turn cold</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
