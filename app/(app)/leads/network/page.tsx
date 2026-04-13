import { LeadsDashboard } from "@/app/(app)/leads/components/LeadsDashboard";

export default function NetworkPage() {
    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
            <div className="flex-shrink-0 px-6 pt-6 pb-4">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Leads Engine
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Precision targeting for architectural portfolios
                </p>
            </div>
            <div className="flex-1 min-h-0 px-6 pb-4 overflow-hidden">
                <LeadsDashboard />
            </div>
        </div>
    );
}
