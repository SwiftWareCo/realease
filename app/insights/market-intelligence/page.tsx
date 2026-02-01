'use client';

import { Building2 } from 'lucide-react';
import { MarketReportCard } from '../components/MarketReportCard';
import { NewsArticleCard } from '../components/NewsArticleCard';
import { MarketMomentumIndex } from '../components/MarketMomentumIndex';
import { InsightsSection } from '../components/InsightsSection';

export default function MarketIntelligencePage() {
    return (
        <div className="flex h-[calc(100vh-5rem)] flex-col gap-3 p-3">
            {/* Top Row: Market Report & News - Adjusted for no-scroll */}
            <div className="grid h-[48%] min-h-0 grid-cols-2 gap-3">
                <MarketReportCard />
                <NewsArticleCard />
            </div>

            {/* Bottom Row: Momentum - Reduced space */}
            <div className="min-h-0 flex-1">
                <MarketMomentumIndex />
            </div>
        </div>
    );
}
