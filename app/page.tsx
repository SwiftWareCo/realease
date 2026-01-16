import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Welcome to Realty
          </h1>
          <p className="max-w-md text-lg leading-8 text-muted-foreground">
            Your modern real estate management platform. Manage properties,
            listings, and more from one convenient dashboard.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 size-5" />
              Go to Dashboard
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
