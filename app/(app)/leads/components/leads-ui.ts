import type { Doc } from "@/convex/_generated/dataModel";
import {
    Building2,
    Facebook,
    Globe2,
    Instagram,
    Linkedin,
    Phone,
    Users,
    type LucideIcon,
} from "lucide-react";

export type LeadTier = "Executive" | "Hot Lead" | "Urgent" | "Warm" | "Cold";

export interface TierColor {
    accent: string;
    bar: string;
    badgeText: string;
    badgeBg: string;
    badgeBorder: string;
    glow: string;
}

export function deriveTier(lead: Doc<"leads">): LeadTier {
    if (lead.status === "qualified") return "Executive";
    const score = lead.urgency_score ?? 0;
    if (score >= 80) return "Hot Lead";
    if (score >= 65) return "Urgent";
    if (score >= 50) return "Warm";
    return "Cold";
}

export function getTierColor(tier: LeadTier): TierColor {
    switch (tier) {
        case "Hot Lead":
            return {
                accent: "bg-orange-500",
                bar: "bg-orange-500",
                badgeText: "text-orange-300",
                badgeBg: "bg-orange-500/15",
                badgeBorder: "border-orange-500/40",
                glow: "shadow-[0_0_24px_-12px_rgba(249,115,22,0.8)]",
            };
        case "Urgent":
            return {
                accent: "bg-amber-400",
                bar: "bg-amber-400",
                badgeText: "text-amber-300",
                badgeBg: "bg-amber-400/15",
                badgeBorder: "border-amber-400/40",
                glow: "shadow-[0_0_24px_-12px_rgba(251,191,36,0.7)]",
            };
        case "Warm":
            return {
                accent: "bg-yellow-500",
                bar: "bg-yellow-500",
                badgeText: "text-yellow-300",
                badgeBg: "bg-yellow-500/15",
                badgeBorder: "border-yellow-500/40",
                glow: "shadow-[0_0_24px_-12px_rgba(234,179,8,0.6)]",
            };
        case "Cold":
            return {
                accent: "bg-sky-500",
                bar: "bg-sky-500",
                badgeText: "text-sky-300",
                badgeBg: "bg-sky-500/15",
                badgeBorder: "border-sky-500/40",
                glow: "shadow-[0_0_24px_-12px_rgba(14,165,233,0.6)]",
            };
        case "Executive":
            return {
                accent: "bg-emerald-400",
                bar: "bg-emerald-400",
                badgeText: "text-emerald-300",
                badgeBg: "bg-emerald-400/15",
                badgeBorder: "border-emerald-400/40",
                glow: "shadow-[0_0_24px_-12px_rgba(52,211,153,0.7)]",
            };
    }
}

export function parseMarket(lead: Doc<"leads">): string {
    if (lead.property_address) {
        const first = lead.property_address.split(",")[0]?.trim();
        if (first) return first;
    }
    if (lead.preferred_location) return lead.preferred_location;
    return "—";
}

export function formatOrigin(source: string | undefined | null): string {
    if (!source) return "Unknown";
    return source
        .replace(/[_-]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
}

export function getOriginIcon(source: string | undefined | null): LucideIcon {
    const s = (source ?? "").toLowerCase();
    if (s.includes("zillow")) return Building2;
    if (s.includes("instagram")) return Instagram;
    if (s.includes("facebook")) return Facebook;
    if (s.includes("linkedin")) return Linkedin;
    if (s.includes("referral")) return Users;
    if (s.includes("cold")) return Phone;
    return Globe2;
}
