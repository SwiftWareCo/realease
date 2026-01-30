import { BuyerKanbanBoard } from "../../components/BuyerKanbanBoard";
import { BuyerInsightsBar } from "../../components/BuyerInsightsBar";

export default function BuyerPage() {
    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                        Buyer Pipeline
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Track your buyers from initial search to closing
                    </p>
                </div>
            </div>

            {/* Insights Bar */}
            <BuyerInsightsBar />

            {/* Kanban Board */}
            <BuyerKanbanBoard />
        </div>
    );
}
