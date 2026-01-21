'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, ExternalLink, Clock } from 'lucide-react';
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
        <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-chart-2 via-chart-3 to-chart-4 opacity-0 transition-opacity group-hover:opacity-100" />
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Newspaper className="size-4 text-muted-foreground" />
                        Local News
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs font-normal">
                        Real Estate
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Featured article */}
                <a
                    href={featuredArticle.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/featured block space-y-2 rounded-lg border p-3 transition-all hover:border-primary/30 hover:bg-muted/50"
                >
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium leading-tight line-clamp-2 group-hover/featured:text-primary">
                            {featuredArticle.headline}
                        </h4>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/featured:opacity-100" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {featuredArticle.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{featuredArticle.source}</span>
                        <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {getTimeAgo(featuredArticle.publishedAt)}
                        </span>
                    </div>
                </a>

                {/* Other articles - compact list */}
                <div className="space-y-2">
                    {otherArticles.map((article) => (
                        <a
                            key={article.id}
                            href={article.articleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                'group/item flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50'
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium group-hover/item:text-primary">
                                    {article.headline}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    {article.source} · {getTimeAgo(article.publishedAt)}
                                </p>
                            </div>
                            <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100" />
                        </a>
                    ))}
                </div>

                {/* View all button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs hover:bg-muted"
                >
                    View All News
                </Button>
            </CardContent>
        </Card>
    );
}

function NewsArticleCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            </CardContent>
        </Card>
    );
}

function NewsArticleCardEmpty() {
    return (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
            <Newspaper className="mb-4 size-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
                No news articles available
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
                Local real estate news will appear here
            </p>
        </Card>
    );
}
