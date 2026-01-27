import { LeadsDashboard } from "@/app/(app)/leads/components/LeadsDashboard";

export default function NetworkPage() {
    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">Network</h1>
            </div>
            <LeadsDashboard />
        </div>
    );
}
