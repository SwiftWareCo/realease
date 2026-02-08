'use client';

import { RevenueWidget } from '../components/RevenueWidget';
import { FunnelVelocityWidget } from '../components/FunnelVelocityWidget';
import { LeadSourcePerformanceWidget } from '../components/LeadSourcePerformanceWidget';

export default function MyBusinessPage() {
    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col gap-2 p-3 overflow-hidden">
            {/* Top: Revenue Widget - 40% height */}
            <div className="h-[40%]">
                <RevenueWidget />
            </div>

            {/* Bottom: Two widgets side by side */}
            <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
                <FunnelVelocityWidget />
                <LeadSourcePerformanceWidget />
            </div>
        </div>
    );
}
