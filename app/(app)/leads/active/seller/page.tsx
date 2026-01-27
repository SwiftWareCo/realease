export default function SellerPage() {
    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Seller Leads</h1>
                <p className="text-muted-foreground mt-1">
                    Manage and track your active seller leads
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Active Sellers</h3>
                    <p className="mt-2 text-3xl font-bold">156</p>
                    <p className="mt-1 text-sm text-green-500">+4.2% from last month</p>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Listings Active</h3>
                    <p className="mt-2 text-3xl font-bold">89</p>
                    <p className="mt-1 text-sm text-green-500">+12 this month</p>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Under Contract</h3>
                    <p className="mt-2 text-3xl font-bold">18</p>
                    <p className="mt-1 text-sm text-muted-foreground">5 closing this week</p>
                </div>
            </div>
        </div>
    );
}
