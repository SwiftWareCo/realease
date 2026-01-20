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
            <Card className='relative overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20'>
                <CardContent className='p-6'>
                    <div className='flex items-center gap-6'>
                        <div className='size-24 rounded-full bg-muted animate-pulse' />
                        <div className='space-y-2'>
                            <div className='h-10 w-40 bg-muted animate-pulse rounded' />
                            <div className='h-5 w-32 bg-muted animate-pulse rounded' />
                        </div>
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

    // Greeting based on time
    const getGreeting = () => {
        if (hours < 12) return 'Good morning';
        if (hours < 17) return 'Good afternoon';
        return 'Good evening';
    };

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
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <Card className='relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10 border-primary/20 dark:border-primary/30'>
            {/* Decorative background elements */}
            <div className='absolute -top-8 -right-8 size-32 rounded-full bg-primary/5 blur-2xl' aria-hidden='true' />
            <div className='absolute -bottom-4 -left-4 size-20 rounded-full bg-accent/10 blur-xl' aria-hidden='true' />

            <CardContent className='relative p-6'>
                <div className='flex flex-col sm:flex-row items-center gap-6'>
                    {/* Analog Clock */}
                    <div
                        className='relative size-24 rounded-full border-2 border-primary/30 bg-card shadow-lg'
                        role='img'
                        aria-label={`Current time: ${h}:${m}:${s} ${ampm}`}
                    >
                        {/* Clock face markers */}
                        {[...Array(12)].map((_, i) => (
                            <div
                                key={i}
                                className='absolute size-1 rounded-full bg-muted-foreground/40'
                                style={{
                                    top: '50%',
                                    left: '50%',
                                    transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-40px)`,
                                }}
                                aria-hidden='true'
                            />
                        ))}

                        {/* Hour hand */}
                        <div
                            className='absolute left-1/2 bottom-1/2 w-1 h-6 bg-foreground rounded-full origin-bottom transition-transform duration-300'
                            style={{ transform: `translateX(-50%) rotate(${hourDeg}deg)` }}
                            aria-hidden='true'
                        />

                        {/* Minute hand */}
                        <div
                            className='absolute left-1/2 bottom-1/2 w-0.5 h-8 bg-primary rounded-full origin-bottom transition-transform duration-300'
                            style={{ transform: `translateX(-50%) rotate(${minuteDeg}deg)` }}
                            aria-hidden='true'
                        />

                        {/* Second hand */}
                        <div
                            className='absolute left-1/2 bottom-1/2 w-0.5 h-9 bg-destructive/70 rounded-full origin-bottom'
                            style={{
                                transform: `translateX(-50%) rotate(${secondDeg}deg)`,
                                transition: seconds === 0 ? 'none' : 'transform 200ms ease-out',
                            }}
                            aria-hidden='true'
                        />

                        {/* Center dot */}
                        <div
                            className='absolute top-1/2 left-1/2 size-2 rounded-full bg-primary -translate-x-1/2 -translate-y-1/2'
                            aria-hidden='true'
                        />
                    </div>

                    {/* Digital Time & Date */}
                    <div className='text-center sm:text-left'>
                        <p className='text-sm font-medium text-muted-foreground mb-1'>
                            {getGreeting()}
                        </p>
                        <div className='flex items-baseline gap-1 font-mono'>
                            <span
                                className='text-4xl font-bold tracking-tight text-foreground'
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                                {h}:{m}
                            </span>
                            <span
                                className='text-2xl font-semibold text-muted-foreground'
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                                :{s}
                            </span>
                            <span className='text-lg font-medium text-primary ml-1.5'>{ampm}</span>
                        </div>
                        <p className='text-sm text-muted-foreground mt-1'>
                            <span className='font-medium'>{dayOfWeek}</span>, {formattedDate}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
