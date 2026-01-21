'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, ExternalLink, Clock, Flame, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Placeholder interface for future API integration
export interface NewsArticle {
    id: string;
    headline: string;
    excerpt: string;
    source: string;
    publishedAt: Date;
    imageUrl?: string;
    articleUrl: string;
    relevanceScore?: number;
    isBreaking?: boolean;
}

// Mock data for UI demonstration
const mockArticles: NewsArticle[] = [
    {
        id: '1',
        headline: 'New Zoning Laws May Impact Suburban Development',
        excerpt:
            'City council approved changes to residential zoning that could affect future development plans in the greater metropolitan area. Developers are reacting to the news with mixed responses.',
        source: 'Local Real Estate Journal',
        publishedAt: new Date('2026-01-19'),
        articleUrl: '#',
        relevanceScore: 92,
        isBreaking: true,
    },
    {
        id: '2',
        headline: 'Interest Rates Hold Steady as Fed Monitors Inflation',
        excerpt:
            'The Federal Reserve announced no changes to current interest rates, maintaining the benchmark rate. Mortgage rates are expected to remain stable through Q1.',
        source: 'Financial Times',
        publishedAt: new Date('2026-01-18'),
        articleUrl: '#',
        relevanceScore: 88,
    },
    {
        id: '3',
        headline: 'Local Housing Market Shows Strong January Activity',
        excerpt:
            'Despite seasonal trends, real estate transactions increased 12% compared to last January, signaling continued buyer interest in the region.',
        source: 'Real Estate Weekly',
        publishedAt: new Date('2026-01-17'),
        articleUrl: '#',
        relevanceScore: 95,
    },
];

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays}d ago`;
    }
    if (diffHours > 0) {
        return `${diffHours}h ago`;
    }
    return 'Just now';
}

interface NewsArticleCardProps {
    articles?: NewsArticle[];
    isLoading?: boolean;
}

export function NewsArticleCard({
    articles = mockArticles,
    isLoading = false,
}: NewsArticleCardProps) {
    if (isLoading) {
        return <NewsArticleCardSkeleton />;
    }

    if (articles.length === 0) {
        return <NewsArticleCardEmpty />;
    }

    const featuredArticle = articles[0];
    const otherArticles = articles.slice(1, 3);

    return (
        <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            {/* Decorative gradient border */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-chart-2/20 via-transparent to-chart-3/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-[1px] rounded-xl bg-card" />

            <CardContent className="relative p-0">
                {/* Header with gradient accent */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                                <Newspaper className="size-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold tracking-tight">Local News</h3>
                                <p className="text-xs text-muted-foreground">Real estate headlines</p>
                            </div>
                        </div>
                        {featuredArticle.isBreaking && (
                            <Badge className="gap-1 bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 shadow-sm animate-pulse">
                                <Flame className="size-3" />
                                Breaking
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Featured article */}
                <div className="p-5">
                    <a
                        href={featuredArticle.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/featured block"
                    >
                        <div className="space-y-3">
                            <h4 className="text-lg font-semibold leading-tight transition-colors group-hover/featured:text-primary line-clamp-2">
                                {featuredArticle.headline}
                            </h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {featuredArticle.excerpt}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground/80">{featuredArticle.source}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {getTimeAgo(featuredArticle.publishedAt)}
                                </span>
                            </div>
                        </div>
                    </a>

                    {/* Other articles - compact list */}
                    {otherArticles.length > 0 && (
                        <div className="mt-4 space-y-2 border-t pt-4">
                            {otherArticles.map((article) => (
                                <a
                                    key={article.id}
                                    href={article.articleUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group/item flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                                >
                                    <div className="mt-1 size-2 shrink-0 rounded-full bg-primary/30" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium transition-colors group-hover/item:text-primary line-clamp-1">
                                            {article.headline}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {article.source} • {getTimeAgo(article.publishedAt)}
                                        </p>
                                    </div>
                                    <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100" />
                                </a>
                            ))}
                        </div>
                    )}

                    {/* View all button */}
                    <div className="mt-4 border-t pt-4">
                        <Button variant="ghost" size="sm" className="w-full gap-1 text-xs text-primary hover:text-primary">
                            Browse All Headlines
                            <ArrowRight className="size-3" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function NewsArticleCardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <div className="bg-muted/30 p-5">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-xl" />
                    <div>
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="mt-1 h-3 w-28" />
                    </div>
                </div>
            </div>
            <div className="p-5 space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="space-y-2 border-t pt-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        </Card>
    );
}

function NewsArticleCardEmpty() {
    return (
        <Card className="flex flex-col items-center justify-center py-16 text-center bg-gradient-to-br from-card to-muted/20">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                <Newspaper className="size-8 text-muted-foreground/50" />
            </div>
            <p className="mt-4 font-medium text-muted-foreground">
                No news articles yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
                Local real estate news will appear here
            </p>
        </Card>
    );
}
