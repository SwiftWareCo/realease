'use client';

import { Building2 } from 'lucide-react';
import { MarketReportCard } from '../components/MarketReportCard';
import { NewsArticleCard } from '../components/NewsArticleCard';
import { MarketMomentumIndex } from '../components/MarketMomentumIndex';
import { RegionalTrendsWidget } from '../components/RegionalTrendsWidget';
import { InsightsSection } from '../components/InsightsSection';

export default function MarketIntelligencePage() {
    return (
        <div className="flex h-[calc(100vh-5rem)] flex-col gap-3 p-3">
            {/* Top Row: Market Report & News - 55% to prevent cutoff */}
            <div className="grid h-[55%] min-h-0 grid-cols-2 gap-3">
                <MarketReportCard />
                <NewsArticleCard />
            </div>

            {/* Bottom Row: Split - Momentum (Vertical) & Trends */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1.5fr]">
                <MarketMomentumIndex />
                <RegionalTrendsWidget />
            </div>
        </div>
    );
}
