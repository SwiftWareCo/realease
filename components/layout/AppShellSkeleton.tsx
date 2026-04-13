import { Skeleton } from "@/components/ui/skeleton";

export function AppShellSkeleton() {
    return (
        <div className="flex min-h-full flex-col gap-6 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_25%)] p-6 md:p-8">
            <Skeleton className="h-10 w-48 rounded-full" />
            <Skeleton className="h-24 w-full rounded-[1.8rem]" />
            <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-64 rounded-[1.8rem]" />
                <Skeleton className="h-64 rounded-[1.8rem]" />
            </div>
            <Skeleton className="h-48 w-full rounded-[1.8rem]" />
        </div>
    );
}
