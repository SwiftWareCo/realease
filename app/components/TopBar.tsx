'use client';

import ModeToggle from '@/components/mode-toggle';

export function TopBar() {
  return (
    <div className="flex h-16 items-center justify-end border-b border-border bg-background px-6">
      <ModeToggle />
    </div>
  );
}
