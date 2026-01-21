'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ExternalLink, Calendar, Building2, ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Placeholder interface for future API integration
export interface MarketReport {
    id: string;
    title: string;
    summary: string;
    source: string;
    publishedAt: Date;
    category: 'market-trends' | 'pricing' | 'inventory' | 'forecasts';
    thumbnailUrl?: string;
    fullReportUrl?: string;
    keyInsight?: string;
}

// Mock data for UI demonstration
const mockReports: MarketReport[] = [
    {
        id: '1',
        title: 'Q4 2025 Market Trends Analysis',
        summary:
            'Housing prices showed steady growth in the metropolitan area with a 3.2% increase quarter-over-quarter. Inventory levels remain tight with only 2.1 months of supply.',
        source: 'National Association of Realtors',
        publishedAt: new Date('2026-01-15'),
        category: 'market-trends',
        keyInsight: '+3.2% price growth',
    },
    {
        id: '2',
        title: 'Regional Pricing Forecast 2026',
        summary:
            'Experts predict continued appreciation in suburban markets with projected 5-7% annual growth. Urban cores expected to stabilize.',
        source: 'CoreLogic',
        publishedAt: new Date('2026-01-10'),
        category: 'forecasts',
        keyInsight: '5-7% projected growth',
    },
];

const categoryConfig = {
    'market-trends': {
        label: 'Trends',
        gradient: 'from-blue-500 to-cyan-500',
        bgGradient: 'from-blue-500/10 to-cyan-500/10',
    },
    pricing: {
        label: 'Pricing',
        gradient: 'from-emerald-500 to-teal-500',
        bgGradient: 'from-emerald-500/10 to-teal-500/10',
    },
    inventory: {
        label: 'Inventory',
        gradient: 'from-amber-500 to-orange-500',
        bgGradient: 'from-amber-500/10 to-orange-500/10',
    },
    forecasts: {
        label: 'Forecasts',
        gradient: 'from-violet-500 to-purple-500',
        bgGradient: 'from-violet-500/10 to-purple-500/10',
    },
};

interface MarketReportCardProps {
    reports?: MarketReport[];
    isLoading?: boolean;
}

export function MarketReportCard({
    reports = mockReports,
    isLoading = false,
}: MarketReportCardProps) {
    if (isLoading) {
        return <MarketReportCardSkeleton />;
    }

    if (reports.length === 0) {
        return <MarketReportCardEmpty />;
    }

    const featuredReport = reports[0];
    const config = categoryConfig[featuredReport.category];

    return (
        <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            {/* Decorative gradient border */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-chart-1/20 via-transparent to-chart-2/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-[1px] rounded-xl bg-card" />

            <CardContent className="relative p-0">
                {/* Header with gradient accent */}
                <div className={cn('bg-gradient-to-r px-5 py-4', config.bgGradient)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn('flex size-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg', config.gradient)}>
                                <TrendingUp className="size-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold tracking-tight">Market Reports</h3>
                                <p className="text-xs text-muted-foreground">Latest industry insights</p>
                            </div>
                        </div>
                        <Badge className={cn('bg-gradient-to-r text-white border-0 shadow-sm', config.gradient)}>
                            {reports.length} New
                        </Badge>
                    </div>
                </div>

                {/* Featured report */}
                <div className="p-5">
                    <div className="space-y-4">
                        {/* Key insight callout */}
                        {featuredReport.keyInsight && (
                            <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
                                <div className="size-2 animate-pulse rounded-full bg-primary" />
                                <span className="text-sm font-semibold text-primary">{featuredReport.keyInsight}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <h4 className="font-semibold leading-tight line-clamp-2">
                                {featuredReport.title}
                            </h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {featuredReport.summary}
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Building2 className="size-3" />
                                    {featuredReport.source}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {featuredReport.publishedAt.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Other reports preview */}
                    {reports.length > 1 && (
                        <div className="mt-4 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">
                                    +{reports.length - 1} more reports available
                                </p>
                                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary hover:text-primary">
                                    View All
                                    <ArrowRight className="size-3" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function MarketReportCardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <div className="bg-muted/30 p-5">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-xl" />
                    <div>
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="mt-1 h-3 w-32" />
                    </div>
                </div>
            </div>
            <div className="p-5 space-y-4">
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        </Card>
    );
}

function MarketReportCardEmpty() {
    return (
        <Card className="flex flex-col items-center justify-center py-16 text-center bg-gradient-to-br from-card to-muted/20">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                <FileText className="size-8 text-muted-foreground/50" />
            </div>
            <p className="mt-4 font-medium text-muted-foreground">
                No market reports yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
                Connect a data source to see market insights
            </p>
        </Card>
    );
}
