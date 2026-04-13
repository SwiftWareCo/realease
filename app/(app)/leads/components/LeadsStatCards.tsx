"use client";

import { CheckCircle2, MessageCircle, Sparkles } from "lucide-react";

interface LeadsStatCardsProps {
    newCount: number;
    contactedCount: number;
    qualifiedCount: number;
}

export function LeadsStatCards({
    newCount,
    contactedCount,
    qualifiedCount,
}: LeadsStatCardsProps) {
    const cards = [
        {
            label: "New Inquiries",
            value: newCount,
            icon: Sparkles,
            accent: "text-sky-300",
            ring: "ring-sky-500/30",
        },
        {
            label: "Contacted",
            value: contactedCount,
            icon: MessageCircle,
            accent: "text-amber-300",
            ring: "ring-amber-400/30",
        },
        {
            label: "Qualified",
            value: qualifiedCount,
            icon: CheckCircle2,
            accent: "text-emerald-300",
            ring: "ring-emerald-400/30",
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {cards.map((c) => {
                const Icon = c.icon;
                return (
                    <div
                        key={c.label}
                        className={`flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-3 ring-1 ${c.ring}`}
                    >
                        <div>
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                {c.label}
                            </div>
                            <div className="mt-1 text-2xl font-bold text-foreground">
                                {c.value}
                            </div>
                        </div>
                        <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 ${c.accent}`}
                        >
                            <Icon className="h-4 w-4" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
