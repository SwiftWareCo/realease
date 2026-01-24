'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, TrendingUp } from 'lucide-react';

// Mock data - will be connected to backend later
const revenueData = {
    current: 127500,
    goal: 200000,
    currency: '$',
};

export function RevenueGoal() {
    const percentage = Math.min((revenueData.current / revenueData.goal) * 100, 100);
    const remaining = revenueData.goal - revenueData.current;

    const formatCurrency = (amount: number) => {
        if (amount >= 1000) {
            return `${revenueData.currency}${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
        }
        return `${revenueData.currency}${amount.toLocaleString()}`;
    };

    return (
        <Card className='relative overflow-hidden h-full bg-gradient-to-br from-green-500/5 via-background to-emerald-500/10 border-green-500/20 dark:border-green-500/30'>
            {/* Decorative background */}
            <div
                className='absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-green-500/10 blur-2xl'
                aria-hidden='true'
            />

            <CardHeader className='pb-2 pt-4 px-5'>
                <CardTitle className='text-sm font-semibold flex items-center gap-2 text-muted-foreground'>
                    <Target className='size-4 text-green-600 dark:text-green-400' aria-hidden='true' />
                    Monthly Revenue Goal
                </CardTitle>
            </CardHeader>

            <CardContent className='px-5 pb-5'>
                {/* Current / Goal */}
                <div className='flex items-end justify-between mb-3'>
                    <div>
                        <p
                            className='text-2xl font-bold text-foreground'
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                            {formatCurrency(revenueData.current)}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                            of {formatCurrency(revenueData.goal)} goal
                        </p>
                    </div>
                    <div className='flex items-center gap-1 text-green-600 dark:text-green-400'>
                        <TrendingUp className='size-4' aria-hidden='true' />
                        <span className='text-sm font-semibold' style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {percentage.toFixed(0)}%
                        </span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className='h-3 bg-muted rounded-full overflow-hidden'>
                    <div
                        className='h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500 rounded-full'
                        style={{ width: `${percentage}%` }}
                        role='progressbar'
                        aria-valuenow={revenueData.current}
                        aria-valuemin={0}
                        aria-valuemax={revenueData.goal}
                        aria-label='Revenue progress'
                    />
                </div>

                {/* Remaining */}
                <p className='text-xs text-muted-foreground mt-2 text-center'>
                    {formatCurrency(remaining)} to go
                </p>
            </CardContent>
        </Card>
    );
}
