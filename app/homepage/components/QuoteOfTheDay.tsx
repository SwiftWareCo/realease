'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Quote } from 'lucide-react';

const quotes = [
    {
        text: 'The best time to buy a home was 10 years ago. The second best time is now.',
        author: 'Real Estate Wisdom',
    },
    {
        text: 'Don\'t wait to buy real estate, buy real estate and wait.',
        author: 'Will Rogers',
    },
    {
        text: 'Real estate cannot be lost or stolen, nor can it be carried away.',
        author: 'Franklin D. Roosevelt',
    },
    {
        text: 'Buying real estate is not only the best way, the quickest way, the safest way, but the only way to become wealthy.',
        author: 'Marshall Field',
    },
    {
        text: 'Landlords grow rich in their sleep without working, risking, or economizing.',
        author: 'John Stuart Mill',
    },
    {
        text: 'In the real estate business you learn more about people, and you learn more about community issues.',
        author: 'Johnny Isakson',
    },
    {
        text: 'Every person who invests in well-selected real estate in a growing section of a prosperous community adopts the surest and safest method of becoming independent.',
        author: 'Theodore Roosevelt',
    },
];

export function QuoteOfTheDay() {
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Get a "daily" quote based on the date
        const today = new Date();
        const dayOfYear = Math.floor(
            (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        setQuoteIndex(dayOfYear % quotes.length);
    }, []);

    // Animation effect
    useEffect(() => {
        setIsVisible(true);
    }, [quoteIndex]);

    const currentQuote = quotes[quoteIndex];

    return (
        <Card className='relative overflow-hidden bg-gradient-to-br from-accent/20 via-background to-secondary/10 border-accent/30'>
            {/* Decorative quote icon */}
            <div className='absolute top-4 right-4 opacity-10' aria-hidden='true'>
                <Quote className='size-16 text-primary' />
            </div>

            <CardContent className='relative p-6'>
                <div
                    className={`transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'
                        }`}
                >
                    <blockquote className='space-y-4'>
                        <p className='font-serif text-lg leading-relaxed text-foreground italic'>
                            &ldquo;{currentQuote.text}&rdquo;
                        </p>
                        <footer className='flex items-center gap-2'>
                            <div className='h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent' aria-hidden='true' />
                            <cite className='text-sm font-medium text-muted-foreground not-italic'>
                                — {currentQuote.author}
                            </cite>
                        </footer>
                    </blockquote>
                </div>

                {/* Label */}
                <div className='absolute top-4 left-4'>
                    <span className='text-xs font-semibold uppercase tracking-widest text-primary/70'>
                        Quote of the Day
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
