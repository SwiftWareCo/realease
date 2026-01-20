'use client';

import { useEffect, useState } from 'react';

export function WelcomeHeader() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const getTimeBasedGreeting = () => {
        if (!mounted) return 'Welcome';
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getCurrentDate = () => {
        if (!mounted) return '';
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className='relative mb-8'>
            {/* Decorative background blobs */}
            <div
                className='absolute -top-20 -left-20 size-60 rounded-full bg-primary/5 blur-3xl'
                aria-hidden='true'
            />
            <div
                className='absolute -top-10 right-20 size-40 rounded-full bg-accent/10 blur-2xl'
                aria-hidden='true'
            />

            <div className='relative'>
                <h1 className='text-4xl md:text-5xl font-bold tracking-tight'>
                    <span className='bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent'>
                        {getTimeBasedGreeting()}
                    </span>
                </h1>
                <p className='mt-2 text-lg text-muted-foreground'>
                    {mounted ? getCurrentDate() : <span className='invisible'>Loading...</span>}
                </p>

                {/* Decorative line */}
                <div
                    className='mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-primary to-accent'
                    aria-hidden='true'
                />
            </div>
        </div>
    );
}
