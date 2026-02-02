import { LeadsDashboard } from "@/app/(app)/leads/components/LeadsDashboard";

export default function NetworkPage() {
    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header with breathing room */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-primary to-primary/60" />
                    <h1 className="text-2xl font-bold tracking-tight">Network</h1>
                </div>
            </div>
            {/* Dashboard - takes remaining space */}
            <div className="flex-1 min-h-0 px-6 pb-4 overflow-hidden">
                <LeadsDashboard />
            </div>
        </div>
    );
}
