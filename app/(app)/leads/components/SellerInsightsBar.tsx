"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
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
    const [now] = useState(() => Date.now());

    // Calculate insights from leads
    const insights = useMemo(() => {
        if (!sellerLeads) return null;
        const dayMs = 1000 * 60 * 60 * 24;

        // Properties on market for 30+ days
        const staleListings =
            sellerLeads?.filter((lead: Doc<"leads">) => {
                if (!lead.listed_date) return false;
                const daysOnMarket = Math.floor(
                    (now - lead.listed_date) / dayMs,
                );
                return (
                    lead.seller_pipeline_stage === "on_market" &&
                    daysOnMarket >= 30
                );
            }).length ?? 0;

        // Properties on market for 60+ days (critical)
        const criticalListings =
            sellerLeads?.filter((lead: Doc<"leads">) => {
                if (!lead.listed_date) return false;
                const daysOnMarket = Math.floor(
                    (now - lead.listed_date) / dayMs,
                );
                return (
                    lead.seller_pipeline_stage === "on_market" &&
                    daysOnMarket >= 60
                );
            }).length ?? 0;

        // Listings with active offers
        const activeOffers =
            sellerLeads?.filter(
                (lead: Doc<"leads">) =>
                    lead.seller_pipeline_stage === "offer_in",
            ).length ?? 0;

        // Under contract
        const underContract =
            sellerLeads?.filter(
                (lead: Doc<"leads">) =>
                    lead.seller_pipeline_stage === "under_contract",
            ).length ?? 0;

        // Pre-listing (preparing)
        const preListing =
            sellerLeads?.filter(
                (lead: Doc<"leads">) =>
                    lead.seller_pipeline_stage === "pre_listing",
            ).length ?? 0;

        // Sold this month - placeholder for future implementation
        // Will track closed_date and filter by current month
        const soldThisMonth =
            sellerLeads?.filter(
                (lead: Doc<"leads">) => lead.seller_pipeline_stage === "sold",
            ).length ?? 0;

        const totalActive =
            sellerLeads?.filter(
                (lead: Doc<"leads">) => lead.seller_pipeline_stage !== "sold",
            ).length ?? 0;

        return {
            staleListings,
            criticalListings,
            activeOffers,
            underContract,
            preListing,
            soldThisMonth,
            totalActive,
        };
    }, [sellerLeads, now]);

    if (insights === null) {
        return (
            <div className="flex items-center gap-2 flex-wrap animate-pulse">
                <div className="h-7 w-28 rounded-lg bg-muted/40 border border-muted/50" />
                <div className="h-7 w-32 rounded-lg bg-muted/40 border border-muted/50" />
                <div className="h-7 w-44 rounded-lg bg-muted/40 border border-muted/50" />
                <div className="h-7 w-40 rounded-lg bg-muted/40 border border-muted/50" />
                <div className="h-7 w-36 rounded-lg bg-muted/40 border border-muted/50" />
            </div>
        );
    }

    const baseAlerts: AlertItem[] = [
        {
            icon: <TrendingDown className="h-4 w-4" />,
            label: "On market 60+ days",
            count: insights.criticalListings,
            type: "danger",
        },
        {
            icon: <Clock className="h-4 w-4" />,
            label: "On market 30+ days",
            count: insights.staleListings - insights.criticalListings, // Exclude criticals to avoid double counting
            type: "warning",
        },
        {
            icon: <AlertTriangle className="h-4 w-4" />,
            label: "Offers pending review",
            count: insights.activeOffers,
            type: "warning",
        },
        {
            icon: <CheckCircle className="h-4 w-4" />,
            label: "Under contract",
            count: insights.underContract,
            type: "success",
        },
        {
            icon: <Home className="h-4 w-4" />,
            label: "Preparing to list",
            count: insights.preListing,
            type: "info",
        },
    ];

    const alerts = baseAlerts.filter((alert) => alert.count > 0);

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
                <Home className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-xs">
                    {insights.totalActive}
                </span>
                <span className="text-muted-foreground text-xs">
                    Active Listings
                </span>
            </div>

            {/* Sold this month card */}
            {insights.soldThisMonth > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                    <DollarSign className="h-3.5 w-3.5 text-green-600" />
                    <span className="font-semibold text-xs text-green-700 dark:text-green-400">
                        {insights.soldThisMonth}
                    </span>
                    <span className="text-green-600/80 text-xs">Sold</span>
                </div>
            )}

            {/* Insight alert cards */}
            {alerts.map((alert, index) => (
                <div
                    key={index}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${getTypeStyles(alert.type)}`}
                >
                    {alert.icon}
                    <span className="font-semibold text-xs">{alert.count}</span>
                    <span className="text-xs">{alert.label}</span>
                </div>
            ))}
        </div>
    );
}
