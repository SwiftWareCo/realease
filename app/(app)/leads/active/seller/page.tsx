import { SellerKanbanBoard } from "../../components/SellerKanbanBoard";
import { SellerInsightsBar } from "../../components/SellerInsightsBar";

export default function SellerPage() {
    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                        Seller Pipeline
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Track your listings from pre-listing to sold
                    </p>
                </div>
            </div>

            {/* Insights Bar */}
            <SellerInsightsBar />

            {/* Kanban Board */}
            <SellerKanbanBoard />
        </div>
    );
}
