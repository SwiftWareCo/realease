'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, TrendingDown } from "lucide-react";

export function RegionalTrendsWidget() {
    const hotspots = [
        { name: 'Downtown', price: '$520k', change: 12, status: 'Hot' },
        { name: 'West End', price: '$410k', change: 8, status: 'Warm' },
        { name: 'Lakefront', price: '$680k', change: 5, status: 'Stable' },
        { name: 'North Hills', price: '$350k', change: -3, status: 'Cooling' },
        { name: 'Suburbia', price: '$440k', change: 15, status: 'Trending' },
    ];

    return (
        <Card className="flex h-full flex-col">
            <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <MapPin className="size-4 text-primary" />
                    Regional Hotspots
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
                <div className="space-y-1">
                    {hotspots.map((spot, i) => (
                        <div key={i} className="flex items-center justify-between rounded-md border px-2 py-1.5 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                                    {i + 1}
                                </div>
                                <div>
                                    <span className="text-xs font-semibold">{spot.name}</span>
                                    <span className="text-[10px] text-muted-foreground ml-2">{spot.price}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-[9px] h-4 px-1 ${spot.status === 'Hot' || spot.status === 'Trending' ? 'bg-orange-500/10 text-orange-600 border-orange-200' :
                                        spot.status === 'Warm' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-200' :
                                            spot.status === 'Cooling' ? 'bg-blue-500/10 text-blue-600 border-blue-200' : ''
                                    }`}>
                                    {spot.status}
                                </Badge>
                                <span className={`flex items-center text-[10px] font-medium ${spot.change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {spot.change > 0 ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                                    {Math.abs(spot.change)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
