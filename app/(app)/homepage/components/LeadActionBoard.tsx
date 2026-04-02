"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Flame, Users } from "lucide-react";

function StatTile({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p
                className="text-lg font-semibold"
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {value}
            </p>
        </div>
    );
}

function statusBadgeClass(status: Doc<"leads">["status"]) {
    if (status === "qualified") {
        return "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300";
    }
    if (status === "contacted") {
        return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    }
    return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300";
}

export function LeadActionBoard() {
    const allLeads = useQuery(api.leads.queries.getAllLeads);

    if (allLeads === undefined) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-lg">
                        Pipeline Action Board
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    const stats = {
        total: allLeads.length,
        new: allLeads.filter((lead) => lead.status === "new").length,
        contacted: allLeads.filter((lead) => lead.status === "contacted")
            .length,
        qualified: allLeads.filter((lead) => lead.status === "qualified")
            .length,
    };

    const urgentLeads = [...allLeads]
        .filter((lead) => lead.status !== "qualified")
        .sort((a, b) => b.urgency_score - a.urgency_score)
        .slice(0, 3);

    const criticalQueue = allLeads.filter(
        (lead) => lead.status === "new" && lead.urgency_score >= 70,
    ).length;

    const closeRate =
        stats.total === 0
            ? 0
            : Math.round((stats.qualified / stats.total) * 100);

    return (
        <Card className="relative overflow-hidden h-full flex flex-col border-border/60 bg-gradient-to-br from-card via-card to-muted/20">
            <div
                className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-primary/10 blur-3xl"
                aria-hidden="true"
            />

            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Users
                            className="size-5 text-primary"
                            aria-hidden="true"
                        />
                        Pipeline Action Board
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                        {closeRate}% qualified
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                    Live lead health plus next best actions.
                </p>
            </CardHeader>

            <CardContent className="flex flex-1 min-h-0 flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                    <StatTile label="Total leads" value={stats.total} />
                    <StatTile label="New" value={stats.new} />
                    <StatTile label="Contacted" value={stats.contacted} />
                    <StatTile label="Qualified" value={stats.qualified} />
                </div>

                <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-300">
                        <Flame className="size-3.5" aria-hidden="true" />
                        Priority queue
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                            {criticalQueue}
                        </span>{" "}
                        high-urgency new leads need first contact.
                    </p>
                </div>

                <div className="flex flex-1 min-h-0 flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Top follow-ups
                        </p>
                        <Link
                            href="/leads"
                            className="text-xs text-primary hover:text-primary/80"
                        >
                            Open pipeline
                        </Link>
                    </div>
                    {urgentLeads.length === 0 ? (
                        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                            No pending follow-ups right now.
                        </p>
                    ) : (
                        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto scrollbar-hidden pr-1">
                            {urgentLeads.map((lead) => (
                                <Link
                                    key={lead._id}
                                    href={`/leads/${lead._id}`}
                                    className="flex items-center justify-between rounded-lg border bg-background/70 px-3 py-2 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {lead.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Urgency {lead.urgency_score}/100
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 pl-2">
                                        <Badge
                                            className={`capitalize ${statusBadgeClass(lead.status)}`}
                                        >
                                            {lead.status}
                                        </Badge>
                                        <ArrowRight
                                            className="size-3.5 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
