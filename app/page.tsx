import { WelcomeHeader } from './homepage/components/WelcomeHeader';
import { LiveClock } from './homepage/components/LiveClock';
import { RevenueGoal } from './homepage/components/RevenueGoal';
import { QuoteOfTheDay } from './homepage/components/QuoteOfTheDay';
import { AnalyticsCard } from './homepage/components/AnalyticsCard';
import { TodaysTasks } from './homepage/components/TodaysTasks';
import { TodoChecklist } from './homepage/components/TodoChecklist';

export default function Home() {
  return (
    <div className='p-6 md:p-8 max-w-7xl mx-auto'>
      <WelcomeHeader />

      {/* Main Grid Layout - 4 columns on xl, 2 on md, 1 on mobile */}
      {/* Using items-stretch to align bottoms */}
      <div className='grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-stretch'>
        {/* Column 1: Clock + Revenue Goal */}
        <div className='flex flex-col gap-4 md:gap-5'>
          <LiveClock />
          <RevenueGoal />
        </div>

        {/* Column 2: Analytics */}
        <div className='flex flex-col'>
          <AnalyticsCard />
        </div>

        {/* Column 3: Today's Schedule */}
        <div className='flex flex-col'>
          <TodaysTasks />
        </div>

        {/* Column 4: To-Do Checklist */}
        <div className='flex flex-col'>
          <TodoChecklist />
        </div>
      </div>

      {/* Quote of the Day - Full width below */}
      <div className='mt-5'>
        <QuoteOfTheDay />
      </div>
    </div>
  );
}
