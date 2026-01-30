"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    Clock,
    CheckCircle,
    TrendingDown,
    Home,
    DollarSign,
} from "lucide-react";

interface AlertItem {
    icon: React.ReactNode;
    label: string;
    count: number;
    type: "warning" | "danger" | "success" | "info";
}

export function SellerInsightsBar() {
    const sellerLeads = useQuery(api.leads.queries.getSellerLeads);

    if (sellerLeads === undefined) {
        return (
            <Card className="p-4 mb-6 animate-pulse bg-muted/30">
                <div className="h-6 bg-muted rounded w-3/4" />
            </Card>
        );
    }

    // Calculate insights from leads
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    // Properties on market for 30+ days
    const staleListings = sellerLeads?.filter((lead: Doc<"leads">) => {
        if (!lead.listed_date) return false;
        const daysOnMarket = Math.floor((now - lead.listed_date) / dayMs);
        return lead.seller_pipeline_stage === "on_market" && daysOnMarket >= 30;
    }).length ?? 0;

    // Properties on market for 60+ days (critical)
    const criticalListings = sellerLeads?.filter((lead: Doc<"leads">) => {
        if (!lead.listed_date) return false;
        const daysOnMarket = Math.floor((now - lead.listed_date) / dayMs);
        return lead.seller_pipeline_stage === "on_market" && daysOnMarket >= 60;
    }).length ?? 0;

    // Listings with active offers
    const activeOffers = sellerLeads?.filter(
        (lead: Doc<"leads">) => lead.seller_pipeline_stage === "offer_in"
    ).length ?? 0;

    // Under contract
    const underContract = sellerLeads?.filter(
        (lead: Doc<"leads">) => lead.seller_pipeline_stage === "under_contract"
    ).length ?? 0;

    // Pre-listing (preparing)
    const preListing = sellerLeads?.filter(
        (lead: Doc<"leads">) => lead.seller_pipeline_stage === "pre_listing"
    ).length ?? 0;

    // Sold this month - placeholder for future implementation
    // Will track closed_date and filter by current month
    const soldThisMonth = sellerLeads?.filter(
        (lead: Doc<"leads">) => lead.seller_pipeline_stage === "sold"
    ).length ?? 0;

    const totalActive = sellerLeads?.filter(
        (lead: Doc<"leads">) =>
            lead.seller_pipeline_stage !== "sold"
    ).length ?? 0;

    const baseAlerts: AlertItem[] = [
        {
            icon: <TrendingDown className="h-4 w-4" />,
            label: "On market 60+ days",
            count: criticalListings,
            type: "danger",
        },
        {
            icon: <Clock className="h-4 w-4" />,
            label: "On market 30+ days",
            count: staleListings - criticalListings, // Exclude criticals to avoid double counting
            type: "warning",
        },
        {
            icon: <AlertTriangle className="h-4 w-4" />,
            label: "Offers pending review",
            count: activeOffers,
            type: "warning",
        },
        {
            icon: <CheckCircle className="h-4 w-4" />,
            label: "Under contract",
            count: underContract,
            type: "success",
        },
        {
            icon: <Home className="h-4 w-4" />,
            label: "Preparing to list",
            count: preListing,
            type: "info",
        },
    ];

    const alerts = baseAlerts.filter(alert => alert.count > 0);

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
                {/* Total count badges */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                        <Home className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{totalActive}</span>
                        <span className="text-muted-foreground text-sm">Active Listings</span>
                    </div>
                    {soldThisMonth > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-sm text-green-700 dark:text-green-400">{soldThisMonth}</span>
                            <span className="text-green-600/80 text-sm">Sold</span>
                        </div>
                    )}
                </div>

                {/* Insight alerts */}
                <div className="flex items-center gap-2 flex-wrap">
                    {alerts.map((alert, index) => (
                        <Badge
                            key={index}
                            variant="outline"
                            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium ${getTypeStyles(alert.type)}`}
                        >
                            {alert.icon}
                            <span className="font-bold">{alert.count}</span>
                            <span className="hidden sm:inline">{alert.label}</span>
                        </Badge>
                    ))}
                    {alerts.length === 0 && (
                        <span className="text-sm text-muted-foreground italic">
                            No active alerts — all listings are on track
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );
}
