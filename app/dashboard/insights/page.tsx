export default function InsightsPage() {
    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Insights</h1>
                <p className="text-muted-foreground mt-1">
                    Analytics and performance metrics for your leads
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Sample metric cards */}
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Total Leads</h3>
                    <p className="mt-2 text-3xl font-bold">1,247</p>
                    <p className="mt-1 text-sm text-green-500">+12.5% from last month</p>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Conversion Rate</h3>
                    <p className="mt-2 text-3xl font-bold">24.8%</p>
                    <p className="mt-1 text-sm text-green-500">+3.2% from last month</p>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Avg. Response Time</h3>
                    <p className="mt-2 text-3xl font-bold">2.4h</p>
                    <p className="mt-1 text-sm text-red-500">+0.5h from last month</p>
                </div>
            </div>
        </div>
    );
}
