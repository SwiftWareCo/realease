export default function BuyerPage() {
    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Buyer Leads</h1>
                <p className="text-muted-foreground mt-1">
                    Manage and track your active buyer leads
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Active Buyers</h3>
                    <p className="mt-2 text-3xl font-bold">248</p>
                    <p className="mt-1 text-sm text-green-500">+8.3% from last month</p>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Showings Scheduled</h3>
                    <p className="mt-2 text-3xl font-bold">32</p>
                    <p className="mt-1 text-sm text-green-500">+5 this week</p>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Pending Offers</h3>
                    <p className="mt-2 text-3xl font-bold">12</p>
                    <p className="mt-1 text-sm text-muted-foreground">4 awaiting response</p>
                </div>
            </div>
        </div>
    );
}
