'use client';

import { Building2, Briefcase, Sparkles } from 'lucide-react';
import { InsightsSection } from './components/InsightsSection';
import { MarketReportCard } from './components/MarketReportCard';
import { NewsArticleCard } from './components/NewsArticleCard';
import { LeadSourceROICard } from './components/LeadSourceROICard';
import { ConversionMetricsCard } from './components/ConversionMetricsCard';
import { AutomationMetricsCard } from './components/AutomationMetricsCard';

export default function InsightsPage() {
    return (
        <div className="space-y-10 p-8">
            {/* Page header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
                <p className="mt-1 text-muted-foreground">
                    Analytics and intelligence to grow your real estate business
                </p>
            </div>

            {/* Your Market section */}
            <InsightsSection
                title="Your Market"
                subtitle="Stay informed with the latest market trends and local news"
                icon={Building2}
            >
                <MarketReportCard />
                <NewsArticleCard />
            </InsightsSection>

            {/* Your Business section */}
            <InsightsSection
                title="Your Business"
                subtitle="Track your lead performance and conversion metrics"
                icon={Briefcase}
            >
                <LeadSourceROICard />
                <ConversionMetricsCard />
            </InsightsSection>

            {/* Your Automations section */}
            <InsightsSection
                title="Your Automations"
                subtitle="See how AI and automation are helping your workflow"
                icon={Sparkles}
            >
                <AutomationMetricsCard />
            </InsightsSection>
        </div>
    );
}
