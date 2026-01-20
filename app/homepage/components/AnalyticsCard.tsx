'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Home, DollarSign, BarChart3, ArrowUpRight } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string;
    change: string;
    trend: 'up' | 'down';
    icon: React.ReactNode;
}

function MetricCard({ title, value, change, trend, icon }: MetricCardProps) {
    return (
        <div className='flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors'>
            <div className='flex items-center gap-3'>
                <div className='p-2 rounded-lg bg-primary/10 text-primary'>
                    {icon}
                </div>
                <div>
                    <p className='text-xs text-muted-foreground'>{title}</p>
                    <p className='text-lg font-bold' style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {value}
                    </p>
                </div>
            </div>
            <div
                className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
            >
                {trend === 'up' ? (
                    <TrendingUp className='size-3' aria-hidden='true' />
                ) : (
                    <TrendingDown className='size-3' aria-hidden='true' />
                )}
                <span>{change}</span>
            </div>
        </div>
    );
}

export function AnalyticsCard() {
    // Mock data - will be replaced with real API data later
    const metrics = [
        {
            title: 'Active Listings',
            value: '247',
            change: '+12%',
            trend: 'up' as const,
            icon: <Home className='size-4' aria-hidden='true' />,
        },
        {
            title: 'Avg. Price',
            value: '$485K',
            change: '+5.2%',
            trend: 'up' as const,
            icon: <DollarSign className='size-4' aria-hidden='true' />,
        },
        {
            title: 'Days on Market',
            value: '32',
            change: '-8%',
            trend: 'up' as const,
            icon: <BarChart3 className='size-4' aria-hidden='true' />,
        },
    ];

    return (
        <Card className='relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/20 h-full flex flex-col'>
            {/* Animated gradient border effect */}
            <div
                className='absolute inset-0 rounded-xl opacity-30'
                style={{
                    background:
                        'linear-gradient(90deg, transparent, var(--primary), transparent)',
                    backgroundSize: '200% 100%',
                }}
                aria-hidden='true'
            />

            <CardHeader className='pb-3'>
                <div className='flex items-center justify-between'>
                    <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                        <BarChart3 className='size-5 text-primary' aria-hidden='true' />
                        Market Analytics
                    </CardTitle>
                    <button
                        className='flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded'
                        type='button'
                    >
                        View Report
                        <ArrowUpRight className='size-3' aria-hidden='true' />
                    </button>
                </div>
                <p className='text-xs text-muted-foreground mt-1'>
                    Real-time market overview
                </p>
            </CardHeader>

            <CardContent className='space-y-3'>
                {metrics.map((metric) => (
                    <MetricCard key={metric.title} {...metric} />
                ))}

                {/* Placeholder chart area */}
                <div className='mt-4 p-4 rounded-lg bg-muted/20 border border-dashed border-muted-foreground/20'>
                    <div className='flex items-center justify-center h-20'>
                        <p className='text-xs text-muted-foreground text-center'>
                            📊 Chart visualization coming soon
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
