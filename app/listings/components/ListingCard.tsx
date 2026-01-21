'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import {
    Bed,
    Bath,
    Square,
    TrendingUp,
    TrendingDown,
    Minus,
    Calendar,
    Clock,
    Eye,
    MessageSquare,
    Flame,
    Tag,
    Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ListingStatus, PropertyType } from './ListingsFilter';

export interface Listing {
    id: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    price: number;
    previousPrice?: number;
    beds: number;
    baths: number;
    sqft: number;
    propertyType: PropertyType;
    status: ListingStatus;
    imageUrl: string;
    daysOnMarket: number;
    lastActivity?: {
        type: 'showing' | 'inquiry' | 'offer' | 'price_change' | 'open_house';
        date: Date;
        description: string;
    };
    upcomingActivity?: {
        type: 'showing' | 'open_house' | 'inspection' | 'closing';
        date: Date;
        description: string;
    };
    metrics: {
        views: number;
        inquiries: number;
        showings: number;
        viewsTrend: 'up' | 'down' | 'stable';
    };
    tags: ('hot' | 'price-drop' | 'new' | 'open-house' | 'multiple-offers')[];
    agentNotes?: string;
    listedDate: Date;
}

const statusConfig: Record<ListingStatus, { label: string; color: string; bgColor: string }> = {
    active: { label: 'Active', color: 'text-emerald-600', bgColor: 'bg-emerald-500' },
    pending: { label: 'Pending', color: 'text-amber-600', bgColor: 'bg-amber-500' },
    sold: { label: 'Sold', color: 'text-violet-600', bgColor: 'bg-violet-500' },
    'off-market': { label: 'Off Market', color: 'text-gray-600', bgColor: 'bg-gray-500' },
};

const propertyTypeLabels: Record<PropertyType, string> = {
    house: 'House',
    condo: 'Condo',
    townhouse: 'Townhouse',
    'multi-family': 'Multi-family',
};

const tagConfig: Record<string, { label: string; icon: typeof Flame; color: string }> = {
    hot: { label: 'Hot', icon: Flame, color: 'bg-red-500/10 text-red-500 border-red-500/30' },
    'price-drop': { label: 'Price Drop', icon: Tag, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
    new: { label: 'New', icon: Sparkles, color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
    'open-house': { label: 'Open House', icon: Calendar, color: 'bg-violet-500/10 text-violet-500 border-violet-500/30' },
    'multiple-offers': { label: 'Multiple Offers', icon: TrendingUp, color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
};

interface ListingCardProps {
    listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
    const priceChange = useMemo(() => {
        if (!listing.previousPrice) return null;
        const diff = listing.price - listing.previousPrice;
        const percent = ((diff / listing.previousPrice) * 100).toFixed(1);
        return { diff, percent, isUp: diff > 0 };
    }, [listing.price, listing.previousPrice]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(price);
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatFutureDate = (date: Date) => {
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays < 7) return `In ${diffDays}d`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const status = statusConfig[listing.status];

    return (
        <HoverCard openDelay={300} closeDelay={100}>
            <HoverCardTrigger asChild>
                <article
                    className="group relative cursor-pointer overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${listing.address}`}
                >
                    {/* Image container */}
                    <div className="relative aspect-[4/3] overflow-hidden">
                        <Image
                            src={listing.imageUrl}
                            alt={`Property at ${listing.address}`}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                        {/* Status badge */}
                        <div className="absolute left-3 top-3">
                            <Badge className={cn('border-0 shadow-sm', status.bgColor, 'text-white')}>
                                {status.label}
                            </Badge>
                        </div>

                        {/* Tags */}
                        {listing.tags.length > 0 && (
                            <div className="absolute right-3 top-3 flex flex-col gap-1">
                                {listing.tags.slice(0, 2).map((tag) => {
                                    const cfg = tagConfig[tag];
                                    const Icon = cfg.icon;
                                    return (
                                        <Badge
                                            key={tag}
                                            variant="outline"
                                            className={cn('gap-1 border bg-background/90 backdrop-blur-sm text-xs', cfg.color)}
                                        >
                                            <Icon className="size-3" />
                                            {cfg.label}
                                        </Badge>
                                    );
                                })}
                            </div>
                        )}

                        {/* Price on image */}
                        <div className="absolute bottom-3 left-3 right-3">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-white tabular-nums drop-shadow-sm">
                                        {formatPrice(listing.price)}
                                    </p>
                                    {priceChange && (
                                        <div className={cn('flex items-center gap-1 text-xs', priceChange.isUp ? 'text-red-400' : 'text-emerald-400')}>
                                            {priceChange.isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                                            <span>{priceChange.isUp ? '+' : ''}{priceChange.percent}%</span>
                                        </div>
                                    )}
                                </div>
                                <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur-sm border-0">
                                    {propertyTypeLabels[listing.propertyType]}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-3">
                        {/* Address */}
                        <div>
                            <h3 className="font-semibold leading-tight truncate" title={listing.address}>
                                {listing.address}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                                {listing.city}, {listing.state} {listing.zipCode}
                            </p>
                        </div>

                        {/* Property specs */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5" title={`${listing.beds} bedrooms`}>
                                <Bed className="size-4" />
                                <span className="tabular-nums">{listing.beds}</span>
                            </div>
                            <div className="flex items-center gap-1.5" title={`${listing.baths} bathrooms`}>
                                <Bath className="size-4" />
                                <span className="tabular-nums">{listing.baths}</span>
                            </div>
                            <div className="flex items-center gap-1.5" title={`${listing.sqft.toLocaleString()} sq ft`}>
                                <Square className="size-4" />
                                <span className="tabular-nums">{listing.sqft.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Activity row */}
                        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Clock className="size-3.5" />
                                {listing.lastActivity ? (
                                    <span className="truncate max-w-[120px]" title={listing.lastActivity.description}>
                                        {formatDate(listing.lastActivity.date)}
                                    </span>
                                ) : (
                                    <span>{listing.daysOnMarket}d on market</span>
                                )}
                            </div>

                            {/* Interest indicator */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1" title={`${listing.metrics.views} views`}>
                                    <Eye className="size-3.5" />
                                    <span className="tabular-nums">{listing.metrics.views}</span>
                                    <TrendIndicator trend={listing.metrics.viewsTrend} />
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            </HoverCardTrigger>

            {/* Hover card content */}
            <HoverCardContent
                side="right"
                align="start"
                className="w-80 p-0 overflow-hidden"
                sideOffset={8}
            >
                <ListingHoverContent listing={listing} formatPrice={formatPrice} formatFutureDate={formatFutureDate} />
            </HoverCardContent>
        </HoverCard>
    );
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'stable' }) {
    if (trend === 'up') return <TrendingUp className="size-3 text-emerald-500" />;
    if (trend === 'down') return <TrendingDown className="size-3 text-red-500" />;
    return <Minus className="size-3 text-muted-foreground" />;
}

interface ListingHoverContentProps {
    listing: Listing;
    formatPrice: (price: number) => string;
    formatFutureDate: (date: Date) => string;
}

function ListingHoverContent({ listing, formatPrice, formatFutureDate }: ListingHoverContentProps) {
    return (
        <div className="space-y-0">
            {/* Header with image */}
            <div className="relative h-32 w-full">
                <Image
                    src={listing.imageUrl}
                    alt={listing.address}
                    fill
                    className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-lg font-semibold text-white truncate">{listing.address}</p>
                    <p className="text-sm text-white/80">{listing.city}, {listing.state}</p>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Metrics grid */}
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-muted/50 p-2">
                        <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                            <Eye className="size-4 text-muted-foreground" />
                            {listing.metrics.views}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Views</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                        <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                            <MessageSquare className="size-4 text-muted-foreground" />
                            {listing.metrics.inquiries}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Inquiries</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                        <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                            <Calendar className="size-4 text-muted-foreground" />
                            {listing.metrics.showings}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Showings</p>
                    </div>
                </div>

                {/* Days on market */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Days on Market</span>
                    <span className="font-medium tabular-nums">{listing.daysOnMarket}</span>
                </div>

                {/* Upcoming activity */}
                {listing.upcomingActivity && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-primary" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{listing.upcomingActivity.description}</p>
                                <p className="text-xs text-muted-foreground">{formatFutureDate(listing.upcomingActivity.date)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Agent notes */}
                {listing.agentNotes && (
                    <div className="text-xs text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Notes</p>
                        <p className="line-clamp-2">{listing.agentNotes}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" className="flex-1">
                        View Details
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                        Schedule Showing
                    </Button>
                </div>
            </div>
        </div>
    );
}
