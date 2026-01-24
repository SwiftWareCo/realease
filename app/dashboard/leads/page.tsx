import { LeadsDashboard } from "@/components/leads/LeadsDashboard";

export default function LeadsPage() {
    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">Leads Dashboard</h1>
            </div>
            <LeadsDashboard />
        </div>
    );
}
