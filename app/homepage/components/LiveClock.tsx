'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function LiveClock() {
    const [time, setTime] = useState<Date | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setTime(new Date());

        const interval = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Prevent hydration mismatch
    if (!mounted || !time) {
        return (
            <Card className='relative overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 h-full'>
                <CardContent className='p-5 flex flex-col items-center justify-center'>
                    <div className='w-28 h-28 rounded-full bg-muted animate-pulse flex-shrink-0' />
                    <div className='mt-3 space-y-2 text-center'>
                        <div className='h-8 w-24 bg-muted animate-pulse rounded mx-auto' />
                        <div className='h-4 w-20 bg-muted animate-pulse rounded mx-auto' />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const hours = time.getHours();
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();

    // Analog clock calculations
    const secondDeg = seconds * 6;
    const minuteDeg = minutes * 6 + seconds * 0.1;
    const hourDeg = (hours % 12) * 30 + minutes * 0.5;

    // Format time with tabular nums for stable width
    const formatTime = () => {
        const h = hours % 12 || 12;
        const m = minutes.toString().padStart(2, '0');
        const s = seconds.toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return { h, m, s, ampm };
    };

    const { h, m, s, ampm } = formatTime();

    const dayOfWeek = time.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = time.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });

    return (
        <Card className='relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10 border-primary/20 dark:border-primary/30 h-full'>
            {/* Decorative background elements */}
            <div className='absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary/5 blur-2xl' aria-hidden='true' />

            <CardContent className='relative p-5 flex flex-col items-center justify-center'>
                {/* Analog Clock - Fixed aspect ratio circle */}
                <div
                    className='relative flex-shrink-0'
                    style={{ width: '112px', height: '112px' }}
                    role='img'
                    aria-label={`Current time: ${h}:${m}:${s} ${ampm}`}
                >
                    <div className='absolute inset-0 rounded-full border-2 border-primary/30 bg-card shadow-lg'>
                        {/* Clock face markers */}
                        {[...Array(12)].map((_, i) => (
                            <div
                                key={i}
                                className='absolute w-1.5 h-1.5 rounded-full bg-muted-foreground/40'
                                style={{
                                    top: '50%',
                                    left: '50%',
                                    transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-46px)`,
                                }}
                                aria-hidden='true'
                            />
                        ))}

                        {/* Hour hand */}
                        <div
                            className='absolute left-1/2 bottom-1/2 w-1 rounded-full bg-foreground origin-bottom transition-transform duration-300'
                            style={{
                                height: '28px',
                                transform: `translateX(-50%) rotate(${hourDeg}deg)`,
                            }}
                            aria-hidden='true'
                        />

                        {/* Minute hand */}
                        <div
                            className='absolute left-1/2 bottom-1/2 w-0.5 rounded-full bg-primary origin-bottom transition-transform duration-300'
                            style={{
                                height: '38px',
                                transform: `translateX(-50%) rotate(${minuteDeg}deg)`,
                            }}
                            aria-hidden='true'
                        />

                        {/* Second hand */}
                        <div
                            className='absolute left-1/2 bottom-1/2 w-0.5 rounded-full bg-destructive/70 origin-bottom'
                            style={{
                                height: '42px',
                                transform: `translateX(-50%) rotate(${secondDeg}deg)`,
                                transition: seconds === 0 ? 'none' : 'transform 200ms ease-out',
                            }}
                            aria-hidden='true'
                        />

                        {/* Center dot */}
                        <div
                            className='absolute top-1/2 left-1/2 w-2.5 h-2.5 rounded-full bg-primary -translate-x-1/2 -translate-y-1/2'
                            aria-hidden='true'
                        />
                    </div>
                </div>

                {/* Digital Time & Date */}
                <div className='text-center mt-4'>
                    <div className='flex items-baseline justify-center gap-0.5 font-mono'>
                        <span
                            className='text-2xl font-bold tracking-tight text-foreground'
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                            {h}:{m}
                        </span>
                        <span
                            className='text-lg font-semibold text-muted-foreground'
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                            :{s}
                        </span>
                        <span className='text-sm font-medium text-primary ml-1'>{ampm}</span>
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                        {dayOfWeek}, {formattedDate}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
