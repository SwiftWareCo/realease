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
            count: readyToOffer || 1, // Sample: show at least 1
            type: "success",
        },
        {
            icon: <AlertTriangle className="h-4 w-4" />,
            label: "Active offers out",
            count: inOfferStage || 1, // Sample: show at least 1
            type: "warning",
        },
        {
            icon: <CheckCircle className="h-4 w-4" />,
            label: "Under contract",
            count: underContract || 1, // Sample: show at least 1
            type: "info",
        },
        {
            icon: <FileX className="h-4 w-4" />,
            label: "Missing documents",
            count: missingDocuments || 1, // Sample: show at least 1
            type: "danger",
        },
        // Future items - currently showing 0 but structure is ready
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
        <div className="flex items-center gap-2 flex-wrap">
            {/* Total count card */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-xs">{totalActive}</span>
                <span className="text-muted-foreground text-xs">Active Buyers</span>
            </div>

            {/* Insight alert cards */}
            {alerts.map((alert, index) => (
                alert.count > 0 && (
                    <div
                        key={index}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${getTypeStyles(alert.type)}`}
                    >
                        {alert.icon}
                        <span className="font-semibold text-xs">{alert.count}</span>
                        <span className="text-xs">{alert.label}</span>
                    </div>
                )
            ))}
        </div>
    );
}
