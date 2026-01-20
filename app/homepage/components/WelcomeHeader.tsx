'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

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

    // Motivational message instead of redundant date
    const getMotivationalMessage = () => {
        if (!mounted) return '';
        const messages = [
            'Ready to close some deals today?',
            'Make today count!',
            'Your success starts now.',
            'Let\'s make it happen!',
            'Time to shine!',
        ];
        const hour = new Date().getHours();
        return messages[hour % messages.length];
    };

    return (
        <div className='relative mb-6'>
            {/* Decorative background blobs */}
            <div
                className='absolute -top-20 -left-20 size-60 rounded-full bg-primary/5 blur-3xl'
                aria-hidden='true'
            />
            <div
                className='absolute -top-10 right-20 size-40 rounded-full bg-accent/10 blur-2xl'
                aria-hidden='true'
            />

            <div className='relative flex items-center justify-between flex-wrap gap-4'>
                <div>
                    <h1 className='text-3xl md:text-4xl font-bold tracking-tight'>
                        <span className='bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent'>
                            {getTimeBasedGreeting()}
                        </span>
                    </h1>
                    <p className='mt-1 text-sm text-muted-foreground flex items-center gap-1.5'>
                        <Sparkles className='size-3.5' aria-hidden='true' />
                        {mounted ? getMotivationalMessage() : <span className='invisible'>Loading...</span>}
                    </p>
                </div>

                {/* Decorative line */}
                <div
                    className='hidden md:block h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent'
                    aria-hidden='true'
                />
            </div>
        </div>
    );
}
