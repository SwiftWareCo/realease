'use client';

import { Sparkles } from 'lucide-react';
import { AutomationMetricsCard } from '../components/AutomationMetricsCard';
import { AutomationSuccessWidget } from '../components/AutomationSuccessWidget';
import { CoverageWidget } from '../components/CoverageWidget';
import { InsightsSection } from '../components/InsightsSection';

export default function AutomationsPage() {
    return (
        <div className="flex h-[calc(100vh-2rem)] flex-col gap-4 p-4">
            {/* Top Banner: Metrics */}
            <div className="h-[280px] shrink-0">
                <AutomationMetricsCard />
            </div>

            {/* Bottom Row: Coverage & Success */}
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
                <CoverageWidget />
                <AutomationSuccessWidget />
            </div>
        </div>
    );
}
