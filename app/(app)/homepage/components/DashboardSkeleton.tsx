import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
    return (
        <div className="h-[calc(100vh-64px)] overflow-hidden bg-[radial-gradient(at_top_left,hsl(var(--primary)/0.06),transparent_50%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))] px-4 py-4 md:px-6">
            <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-5">
                <div className="grid flex-shrink-0 gap-6 pb-2 xl:grid-cols-[minmax(260px,1fr)_230px_minmax(520px,620px)]">
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-9 w-56" />
                        <Skeleton className="h-14 w-full max-w-[520px]" />
                    </div>
                    <div>
                        <Skeleton className="h-[96px] w-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                        <Skeleton className="h-[72px]" />
                        <Skeleton className="h-[72px]" />
                        <Skeleton className="h-[72px]" />
                        <Skeleton className="h-[72px]" />
                    </div>
                </div>
                <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
                        <Skeleton className="min-h-[360px] rounded-2xl border border-border/60 bg-card/70" />
                        <Skeleton className="min-h-[360px] rounded-2xl border border-border/60 bg-card/70" />
                    </div>
                    <Skeleton className="min-h-[420px] rounded-2xl border border-border/60 bg-card/70" />
                </div>
            </div>
        </div>
    );
}
