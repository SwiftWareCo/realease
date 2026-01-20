import { WelcomeHeader } from './homepage/components/WelcomeHeader';
import { LiveClock } from './homepage/components/LiveClock';
import { QuoteOfTheDay } from './homepage/components/QuoteOfTheDay';
import { AnalyticsCard } from './homepage/components/AnalyticsCard';
import { TodaysTasks } from './homepage/components/TodaysTasks';
import { TodoChecklist } from './homepage/components/TodoChecklist';

export default function Home() {
  return (
    <div className='p-6 md:p-8 max-w-7xl mx-auto'>
      <WelcomeHeader />

      {/* Main Grid Layout - 4 columns on xl, 2 on md, 1 on mobile */}
      <div className='grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4'>
        {/* Clock */}
        <div className='xl:col-span-1'>
          <LiveClock />
        </div>

        {/* Analytics */}
        <div className='xl:col-span-1'>
          <AnalyticsCard />
        </div>

        {/* Today's Schedule */}
        <div className='xl:col-span-1'>
          <TodaysTasks />
        </div>

        {/* To-Do Checklist */}
        <div className='xl:col-span-1'>
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
