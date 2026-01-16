import { LeadsDashboard } from "@/components/leads/LeadsDashboard";

export default async function DashboardPage() {

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Leads Dashboard</h1>
      <LeadsDashboard />
    </div>
  );
}
