'use client';

import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

interface RegionBadgeProps {
  city: string;
  state?: string;
  country: string;
}

export function RegionBadge({ city, state, country }: RegionBadgeProps) {
  return (
    <Link href="/settings">
      <Badge 
        variant="outline" 
        className="cursor-pointer hover:bg-accent transition-colors"
      >
        <MapPin className="h-3 w-3 mr-1" />
        {city}
        {state && `, ${state}`}
        <span className="ml-1 text-muted-foreground">({country})</span>
      </Badge>
    </Link>
  );
}
