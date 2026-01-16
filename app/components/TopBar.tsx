'use client';

import ModeToggle from '@/components/mode-toggle';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function TopBar() {
  return (
    <div className='flex h-16 items-center justify-between border-b border-border bg-background px-6'>
      <SidebarTrigger />
      <ModeToggle />
    </div>
  );
}
