import { SellerKanbanBoard } from "../../components/SellerKanbanBoard";
import { SellerInsightsBar } from "../../components/SellerInsightsBar";
import { Button } from "@/components/ui/button";
import { Plus, Download, Filter } from "lucide-react";

export default function SellerPage() {
    return (
        <div className="p-6 lg:p-8 min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full bg-gradient-to-b from-green-500 to-emerald-600" />
                        <h1 className="text-3xl font-bold tracking-tight">
                            Seller Pipeline
                        </h1>
                    </div>
                    <p className="text-muted-foreground ml-5">
                        Track your listings from pre-listing to sold
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
                    <Button size="sm" className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                        <Plus className="h-4 w-4" />
                        <span>Add Listing</span>
                    </Button>
                </div>
            </div>

            {/* Insights Bar */}
            <SellerInsightsBar />

            {/* Kanban Board */}
            <SellerKanbanBoard />
        </div>
    );
}

