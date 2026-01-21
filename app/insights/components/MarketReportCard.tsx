'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ExternalLink, Calendar, Building2 } from 'lucide-react';
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
    },
    {
        id: '2',
        title: 'Regional Pricing Forecast 2026',
        summary:
            'Experts predict continued appreciation in suburban markets with projected 5-7% annual growth. Urban cores expected to stabilize.',
        source: 'CoreLogic',
        publishedAt: new Date('2026-01-10'),
        category: 'forecasts',
    },
];

const categoryConfig = {
    'market-trends': {
        label: 'Trends',
        className: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
    },
    pricing: {
        label: 'Pricing',
        className: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
    },
    inventory: {
        label: 'Inventory',
        className: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
    },
    forecasts: {
        label: 'Forecasts',
        className: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
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

    return (
        <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-chart-1 via-chart-2 to-chart-3 opacity-0 transition-opacity group-hover:opacity-100" />
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="size-4 text-muted-foreground" />
                        Market Reports
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs font-normal">
                        {reports.length} available
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {reports.slice(0, 2).map((report, index) => (
                    <div
                        key={report.id}
                        className={cn(
                            'group/item space-y-2 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/50',
                            index !== reports.length - 1 && 'border-b border-border pb-4'
                        )}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium leading-tight line-clamp-2 group-hover/item:text-primary">
                                {report.title}
                            </h4>
                            <Badge
                                variant="outline"
                                className={cn(
                                    'shrink-0 text-[10px]',
                                    categoryConfig[report.category].className
                                )}
                            >
                                {categoryConfig[report.category].label}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {report.summary}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                    <Building2 className="size-3" />
                                    {report.source}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {report.publishedAt.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </span>
                            </div>
                            {report.fullReportUrl && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-[10px] text-primary hover:bg-transparent hover:underline"
                                    asChild
                                >
                                    <a
                                        href={report.fullReportUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        View Full Report
                                        <ExternalLink className="ml-1 size-3" />
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function MarketReportCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {[1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function MarketReportCardEmpty() {
    return (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 size-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
                No market reports available
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
                Reports will appear here once connected to a data source
            </p>
        </Card>
    );
}
