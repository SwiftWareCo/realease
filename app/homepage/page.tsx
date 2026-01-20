import { WelcomeHeader } from './components/WelcomeHeader';
import { LiveClock } from './components/LiveClock';
import { QuoteOfTheDay } from './components/QuoteOfTheDay';
import { AnalyticsCard } from './components/AnalyticsCard';
import { TodaysTasks } from './components/TodaysTasks';
import { TodoChecklist } from './components/TodoChecklist';

export default function Homepage() {
    return (
        <div className='p-6 md:p-8 max-w-7xl mx-auto'>
            <WelcomeHeader />

            {/* Main Grid Layout */}
            <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
                {/* Left Column - Clock & Quote */}
                <div className='space-y-6 lg:col-span-1'>
                    <LiveClock />
                    <QuoteOfTheDay />
                </div>

                {/* Middle Column - Analytics & Tasks */}
                <div className='space-y-6 lg:col-span-1'>
                    <AnalyticsCard />
                    <TodaysTasks />
                </div>

                {/* Right Column - To-Do */}
                <div className='space-y-6 md:col-span-2 lg:col-span-1'>
                    <TodoChecklist />
                </div>
            </div>
        </div>
    );
}
