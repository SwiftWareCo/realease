import { BuyerKanbanBoard } from "../../components/BuyerKanbanBoard";

export default function BuyerPage() {
    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Buyer Leads</h1>
                <p className="text-muted-foreground mt-1">
                    Manage and track your active buyer leads through the pipeline
                </p>
            </div>

            <BuyerKanbanBoard />
        </div>
    );
}

