"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    FileX,
    Clock,
    CheckCircle,
    TrendingUp,
    Users,
} from "lucide-react";

interface AlertItem {
    icon: React.ReactNode;
    label: string;
    count: number;
    type: "warning" | "danger" | "success" | "info";
}

export function BuyerInsightsBar() {
    const buyerLeads = useQuery(api.leads.queries.getBuyerLeads);

    if (buyerLeads === undefined) {
        return (
            <Card className="p-4 mb-6 animate-pulse bg-muted/30">
                <div className="h-6 bg-muted rounded w-3/4" />
            </Card>
        );
    }

    // Calculate insights from leads
    // These calculations will be expanded when more data is available
    const readyToOffer = buyerLeads?.filter(
        (lead: Doc<"leads">) => lead.buyer_pipeline_stage === "showings" && lead.urgency_score >= 70
    ).length ?? 0;

    const inOfferStage = buyerLeads?.filter(
        (lead: Doc<"leads">) => lead.buyer_pipeline_stage === "offer_out"
    ).length ?? 0;

    const underContract = buyerLeads?.filter(
        (lead: Doc<"leads">) => lead.buyer_pipeline_stage === "under_contract"
    ).length ?? 0;

    // Placeholder for future: leads missing documents
    // Will check for missing pre-approval, ID verification, etc.
    const missingDocuments = 0;

    // Placeholder for future: inactive leads (no contact in 14+ days)
    // Will check last_contact_date field
    const inactiveLeads = 0;

    const totalActive = buyerLeads?.length ?? 0;

    const alerts: AlertItem[] = [
        {
            icon: <TrendingUp className="h-4 w-4" />,
            label: "Ready to submit offer",
            count: readyToOffer,
            type: "success",
        },
        {
            icon: <AlertTriangle className="h-4 w-4" />,
            label: "Active offers out",
            count: inOfferStage,
            type: "warning",
        },
        {
            icon: <CheckCircle className="h-4 w-4" />,
            label: "Under contract",
            count: underContract,
            type: "info",
        },
        // Future items - currently showing 0 but structure is ready
        ...(missingDocuments > 0 ? [{
            icon: <FileX className="h-4 w-4" />,
            label: "Missing documents",
            count: missingDocuments,
            type: "danger" as const,
        }] : []),
        ...(inactiveLeads > 0 ? [{
            icon: <Clock className="h-4 w-4" />,
            label: "Inactive 14+ days",
            count: inactiveLeads,
            type: "danger" as const,
        }] : []),
    ];

    const getTypeStyles = (type: AlertItem["type"]) => {
        switch (type) {
            case "success":
                return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
            case "warning":
                return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
            case "danger":
                return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
            case "info":
                return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
        }
    };

    return (
        <Card className="p-4 mb-6 bg-gradient-to-r from-card via-card to-card/80 border-border/50 backdrop-blur-sm">
            <div className="flex items-center justify-between flex-wrap gap-4">
                {/* Total count badge */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{totalActive}</span>
                        <span className="text-muted-foreground text-sm">Active Buyers</span>
                    </div>
                </div>

                {/* Insight alerts */}
                <div className="flex items-center gap-2 flex-wrap">
                    {alerts.map((alert, index) => (
                        alert.count > 0 && (
                            <Badge
                                key={index}
                                variant="outline"
                                className={`flex items-center gap-1.5 px-3 py-1.5 font-medium ${getTypeStyles(alert.type)}`}
                            >
                                {alert.icon}
                                <span className="font-bold">{alert.count}</span>
                                <span className="hidden sm:inline">{alert.label}</span>
                            </Badge>
                        )
                    ))}
                    {alerts.every(a => a.count === 0) && (
                        <span className="text-sm text-muted-foreground italic">
                            No active alerts — all buyers are on track
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );
}
