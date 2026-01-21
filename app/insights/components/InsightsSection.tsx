'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface InsightsSectionProps {
    title: string;
    subtitle?: string;
    icon: LucideIcon;
    children: React.ReactNode;
    className?: string;
}

export function InsightsSection({
    title,
    subtitle,
    icon: Icon,
    children,
    className,
}: InsightsSectionProps) {
    return (
        <section className={cn('space-y-6', className)}>
            <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                    <Icon className="size-5" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                    )}
                </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">{children}</div>
        </section>
    );
}
