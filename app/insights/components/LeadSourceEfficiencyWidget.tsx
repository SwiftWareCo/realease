'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Target, Users } from "lucide-react";

const sourceData = [
    { source: "Zillow", volume: 45, conversion: "3.2%", timeToClose: "42 days", revenue: "$120k", performance: "High" },
    { source: "Referrals", volume: 12, conversion: "45%", timeToClose: "28 days", revenue: "$320k", performance: "Best" },
    { source: "Facebook Ads", volume: 120, conversion: "1.1%", timeToClose: "65 days", revenue: "$45k", performance: "Low" },
    { source: "Website", volume: 30, conversion: "2.8%", timeToClose: "50 days", revenue: "$85k", performance: "Medium" },
];

export function LeadSourceEfficiencyWidget() {
    return (
        <Card className="col-span-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="size-5 text-primary" />
                    Lead Source Efficiency
                </CardTitle>
                <CardDescription>
                    Analyze performance by acquisition channel
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Volume</TableHead>
                            <TableHead className="text-right">Conv. %</TableHead>
                            <TableHead className="text-right">Time to Close</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Performance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sourceData.map((item) => (
                            <TableRow key={item.source}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <Users className="size-4 text-muted-foreground" />
                                        {item.source}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">{item.volume}</TableCell>
                                <TableCell className="text-right">{item.conversion}</TableCell>
                                <TableCell className="text-right">{item.timeToClose}</TableCell>
                                <TableCell className="text-right">{item.revenue}</TableCell>
                                <TableCell className="text-right">
                                    <Badge variant={item.performance === "Best" ? "default" : item.performance === "High" ? "secondary" : "outline"}>
                                        {item.performance}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
