import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KPIStripSkeleton } from "./KPIStrip";
import { MarketSnapshotSkeleton } from "./MarketSnapshot";

export function InsightsPageSkeleton() {
    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                    <Skeleton className="h-8 w-52" />
                    <Skeleton className="h-9 w-[320px]" />
                </div>
                <Skeleton className="h-4 w-80" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            </div>

            <KPIStripSkeleton />
            <MarketSnapshotSkeleton />

            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-56" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[320px] w-full rounded-md" />
                </CardContent>
            </Card>
        </div>
    );
}
