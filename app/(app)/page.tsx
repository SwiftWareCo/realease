import { WelcomeHeader } from "./homepage/components/WelcomeHeader";
import { LiveClock } from "./homepage/components/LiveClock";
import { QuoteOfTheDay } from "./homepage/components/QuoteOfTheDay";
import { AnalyticsCard } from "./homepage/components/AnalyticsCard";
import { LeadActionBoard } from "./homepage/components/LeadActionBoard";
import { TodaysTasks } from "./homepage/components/TodaysTasks";

export default function Home() {
    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <WelcomeHeader />

            <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12 lg:auto-rows-[220px]">
                <div className="lg:col-span-8 lg:row-span-2 lg:col-start-1 lg:row-start-1">
                    <TodaysTasks />
                </div>

                <div className="lg:col-span-4 lg:row-span-2 lg:col-start-9 lg:row-start-1">
                    <LeadActionBoard />
                </div>

                <div className="lg:col-span-8 lg:row-span-1 lg:col-start-1 lg:row-start-3">
                    <AnalyticsCard />
                </div>

                <div className="lg:col-span-4 lg:row-span-1 lg:col-start-9 lg:row-start-3">
                    <LiveClock />
                </div>
            </div>

            <div className="mt-6">
                <QuoteOfTheDay />
            </div>
        </div>
    );
}
