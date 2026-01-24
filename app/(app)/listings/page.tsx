'use client';

import { useState, useMemo } from 'react';
import { Home, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListingsFilter, ListingStatus, PropertyType, SortOption } from './components/ListingsFilter';
import { ListingCard, Listing } from './components/ListingCard';

// Mock data for UI demonstration
const mockListings: Listing[] = [
    {
        id: '1',
        address: '123 Oak Street',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        price: 1250000,
        previousPrice: 1295000,
        beds: 4,
        baths: 3,
        sqft: 2400,
        propertyType: 'house',
        status: 'active',
        imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&auto=format&fit=crop&q=60',
        daysOnMarket: 12,
        lastActivity: {
            type: 'showing',
            date: new Date('2026-01-20'),
            description: 'Showing with the Johnsons',
        },
        upcomingActivity: {
            type: 'open_house',
            date: new Date('2026-01-25'),
            description: 'Open House 1-4 PM',
        },
        metrics: { views: 234, inquiries: 12, showings: 5, viewsTrend: 'up' },
        tags: ['hot', 'price-drop'],
        agentNotes: 'Motivated seller, recently reduced price. Great school district.',
        listedDate: new Date('2026-01-09'),
    },
    {
        id: '2',
        address: '456 Pine Avenue',
        city: 'Oakland',
        state: 'CA',
        zipCode: '94610',
        price: 875000,
        beds: 3,
        baths: 2,
        sqft: 1800,
        propertyType: 'townhouse',
        status: 'pending',
        imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=60',
        daysOnMarket: 28,
        lastActivity: {
            type: 'offer',
            date: new Date('2026-01-19'),
            description: 'Offer accepted - $890,000',
        },
        metrics: { views: 456, inquiries: 24, showings: 8, viewsTrend: 'stable' },
        tags: [],
        listedDate: new Date('2026-12-24'),
    },
    {
        id: '3',
        address: '789 Maple Drive',
        city: 'Berkeley',
        state: 'CA',
        zipCode: '94704',
        price: 1450000,
        beds: 5,
        baths: 4,
        sqft: 3200,
        propertyType: 'house',
        status: 'active',
        imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=60',
        daysOnMarket: 3,
        lastActivity: {
            type: 'inquiry',
            date: new Date('2026-01-21'),
            description: '3 new inquiries',
        },
        upcomingActivity: {
            type: 'showing',
            date: new Date('2026-01-22'),
            description: 'Showing at 2 PM',
        },
        metrics: { views: 89, inquiries: 6, showings: 2, viewsTrend: 'up' },
        tags: ['new', 'multiple-offers'],
        agentNotes: 'Premium location near UC Berkeley. Expecting bidding war.',
        listedDate: new Date('2026-01-18'),
    },
    {
        id: '4',
        address: '321 Cedar Lane',
        city: 'San Jose',
        state: 'CA',
        zipCode: '95123',
        price: 650000,
        beds: 2,
        baths: 2,
        sqft: 1100,
        propertyType: 'condo',
        status: 'active',
        imageUrl: 'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800&auto=format&fit=crop&q=60',
        daysOnMarket: 45,
        metrics: { views: 312, inquiries: 8, showings: 3, viewsTrend: 'down' },
        tags: [],
        agentNotes: 'Consider price adjustment if no movement this week.',
        listedDate: new Date('2025-12-07'),
    },
    {
        id: '5',
        address: '555 Birch Court',
        city: 'Palo Alto',
        state: 'CA',
        zipCode: '94301',
        price: 2150000,
        beds: 4,
        baths: 3.5,
        sqft: 2800,
        propertyType: 'house',
        status: 'sold',
        imageUrl: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&auto=format&fit=crop&q=60',
        daysOnMarket: 21,
        lastActivity: {
            type: 'showing',
            date: new Date('2026-01-15'),
            description: 'Closed at $2.2M',
        },
        metrics: { views: 567, inquiries: 32, showings: 12, viewsTrend: 'stable' },
        tags: [],
        listedDate: new Date('2025-12-25'),
    },
    {
        id: '6',
        address: '888 Redwood Blvd',
        city: 'Mountain View',
        state: 'CA',
        zipCode: '94040',
        price: 1850000,
        beds: 3,
        baths: 2.5,
        sqft: 2100,
        propertyType: 'townhouse',
        status: 'active',
        imageUrl: 'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800&auto=format&fit=crop&q=60',
        daysOnMarket: 7,
        upcomingActivity: {
            type: 'open_house',
            date: new Date('2026-01-26'),
            description: 'Open House Saturday 12-3 PM',
        },
        metrics: { views: 178, inquiries: 9, showings: 4, viewsTrend: 'up' },
        tags: ['open-house'],
        listedDate: new Date('2026-01-14'),
    },
];

export default function ListingsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState<ListingStatus[]>([]);
    const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<PropertyType[]>([]);
    const [selectedSort, setSelectedSort] = useState<SortOption>('newest');

    const filteredListings = useMemo(() => {
        let result = [...mockListings];

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            result = result.filter(
                (l) =>
                    l.address.toLowerCase().includes(search) ||
                    l.city.toLowerCase().includes(search) ||
                    l.zipCode.includes(search)
            );
        }

        // Status filter
        if (selectedStatuses.length > 0) {
            result = result.filter((l) => selectedStatuses.includes(l.status));
        }

        // Property type filter
        if (selectedPropertyTypes.length > 0) {
            result = result.filter((l) => selectedPropertyTypes.includes(l.propertyType));
        }

        // Sort
        result.sort((a, b) => {
            switch (selectedSort) {
                case 'newest':
                    return b.listedDate.getTime() - a.listedDate.getTime();
                case 'price-high':
                    return b.price - a.price;
                case 'price-low':
                    return a.price - b.price;
                case 'most-interest':
                    return b.metrics.views - a.metrics.views;
                default:
                    return 0;
            }
        });

        return result;
    }, [searchTerm, selectedStatuses, selectedPropertyTypes, selectedSort]);

    return (
        <div className="space-y-6 p-8">
            {/* Page header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/5 via-primary/3 to-transparent p-6">
                {/* Decorative background */}
                <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-20 -left-10 size-60 rounded-full bg-chart-2/5 blur-3xl" />

                <div className="relative flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-1 shadow-lg shadow-primary/25">
                            <Home className="size-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Listings</h1>
                            <p className="mt-1 text-muted-foreground">
                                Track and manage your property listings
                            </p>
                        </div>
                    </div>

                    <Button className="gap-2">
                        <Plus className="size-4" />
                        Add Listing
                    </Button>
                </div>
            </div>

            {/* Filter bar */}
            <ListingsFilter
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedStatuses={selectedStatuses}
                onStatusChange={setSelectedStatuses}
                selectedPropertyTypes={selectedPropertyTypes}
                onPropertyTypeChange={setSelectedPropertyTypes}
                selectedSort={selectedSort}
                onSortChange={setSelectedSort}
                totalListings={mockListings.length}
                filteredCount={filteredListings.length}
            />

            {/* Listings grid */}
            {filteredListings.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredListings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                        <Home className="size-8 text-muted-foreground/50" />
                    </div>
                    <p className="mt-4 font-medium text-muted-foreground">No listings found</p>
                    <p className="mt-1 text-sm text-muted-foreground/70">
                        Try adjusting your filters or add a new listing
                    </p>
                </div>
            )}
        </div>
    );
}
