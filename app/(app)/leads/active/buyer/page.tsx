import { BuyerKanbanBoard } from "../../components/BuyerKanbanBoard";
import { BuyerInsightsBar } from "../../components/BuyerInsightsBar";
import { Button } from "@/components/ui/button";
import { Plus, Download, Filter } from "lucide-react";

export default function BuyerPage() {
    return (
        <div className="p-6 lg:p-8 min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full bg-gradient-to-b from-blue-500 to-purple-600" />
                        <h1 className="text-3xl font-bold tracking-tight">
                            Buyer Pipeline
                        </h1>
                    </div>
                    <p className="text-muted-foreground ml-5">
                        Track your buyers from initial search to closing
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 ml-5 lg:ml-0">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Filter className="h-4 w-4" />
                        <span className="hidden sm:inline">Filter</span>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button size="sm" className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                        <Plus className="h-4 w-4" />
                        <span>Add Buyer</span>
                    </Button>
                </div>
            </div>

            {/* Insights Bar */}
            <BuyerInsightsBar />

            {/* Kanban Board */}
            <BuyerKanbanBoard />
        </div>
    );
}

