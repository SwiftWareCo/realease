import { SellerKanbanBoard } from "../../components/SellerKanbanBoard";

export default function SellerPage() {
    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Seller Leads</h1>
                <p className="text-muted-foreground mt-1">
                    Manage and track your active seller listings through the pipeline
                </p>
            </div>

            <SellerKanbanBoard />
        </div>
    );
}

