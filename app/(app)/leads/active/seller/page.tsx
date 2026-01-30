import { SellerKanbanBoard } from "../../components/SellerKanbanBoard";
import { SellerInsightsBar } from "../../components/SellerInsightsBar";
import { Button } from "@/components/ui/button";
import { Plus, Download, Filter } from "lucide-react";

export default function SellerPage() {
    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
            {/* Compact Header */}
            <div className="flex-shrink-0 px-6 pt-4 pb-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-green-500 to-emerald-600" />
                        <h1 className="text-2xl font-bold tracking-tight">Seller Pipeline</h1>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-2 h-8">
                            <Filter className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Filter</span>
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 h-8">
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Export</span>
                        </Button>
                        <Button size="sm" className="gap-2 h-8 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Listing</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Insights Bar */}
            <div className="flex-shrink-0 px-6 pb-3">
                <SellerInsightsBar />
            </div>

            {/* Kanban Board - takes remaining space */}
            <div className="flex-1 min-h-0 px-6 pb-4">
                <SellerKanbanBoard />
            </div>
        </div>
    );
}

