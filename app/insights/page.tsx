'use client';

import { Building2, Briefcase, Sparkles, TrendingUp } from 'lucide-react';
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
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/5 via-primary/3 to-transparent p-6">
                {/* Decorative background elements */}
                <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-20 -left-10 size-60 rounded-full bg-chart-2/5 blur-3xl" />

                <div className="relative flex items-start gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-1 shadow-lg shadow-primary/25">
                        <TrendingUp className="size-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Insights
                        </h1>
                        <p className="mt-1 text-muted-foreground">
                            Analytics and intelligence to grow your real estate business
                        </p>
                    </div>
                </div>
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
