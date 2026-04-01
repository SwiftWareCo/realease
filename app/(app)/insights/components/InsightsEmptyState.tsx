"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, MapPin, RefreshCw } from "lucide-react";

interface InsightsEmptyStateProps {
    hasRegion?: boolean;
    regions?: Array<{ city: string; state?: string; country: string }>;
    onOpenSettings?: () => void;
}

export function InsightsEmptyState({
    hasRegion,
    regions,
    onOpenSettings,
}: InsightsEmptyStateProps) {
    if (!hasRegion) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                        No Region Selected
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                        Select your market region to start seeing relevant real
                        estate insights.
                    </p>
                    <Button onClick={onOpenSettings} disabled={!onOpenSettings}>
                        Set Your Region
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Insights Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    {regions && regions.length > 0
                        ? `We're gathering market data for ${
                              regions.length === 1
                                  ? `${regions[0].city}${regions[0].state ? `, ${regions[0].state}` : ""}`
                                  : `${regions.length} regions`
                          }.`
                        : "We're gathering market data for your selected regions."}{" "}
                    Check back soon for the latest GVR Market Watch updates.
                </p>
                <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </CardContent>
        </Card>
    );
}
