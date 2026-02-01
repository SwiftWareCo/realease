'use client';

import { Briefcase } from 'lucide-react';
import { RevenueWidget } from '../components/RevenueWidget';
import { LeadSourceEfficiencyWidget } from '../components/LeadSourceEfficiencyWidget';
import { FunnelVelocityWidget } from '../components/FunnelVelocityWidget';
import { DropOffAnalysisWidget } from '../components/DropOffAnalysisWidget';
import { LeadHealthWidget } from '../components/LeadHealthWidget';
import { InsightsSection } from '../components/InsightsSection';

export default function MyBusinessPage() {
    return (
        <div className="flex h-[calc(100vh-2rem)] flex-col gap-4 p-4">
            {/* Top Banner: Revenue */}
            <div className="h-[35%] shrink-0">
                <RevenueWidget />
            </div>

            {/* Bottom Grid: 3 columns. Funnel (Middle) taller? No, make them equal. */}
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
                <FunnelVelocityWidget />
                <DropOffAnalysisWidget />
                <LeadHealthWidget />
            </div>
        </div>
    );
}
