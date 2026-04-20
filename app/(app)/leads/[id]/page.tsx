import { LeadProfile } from '@/app/(app)/leads/components/LeadProfile';
import type { Id } from '@/convex/_generated/dataModel';

interface LeadPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function LeadPage({ params }: LeadPageProps) {
    const { id } = await params;

    return (
        <div className="h-[calc(100vh-64px)] overflow-hidden bg-[#050c1d] px-4 py-4 md:px-6 md:py-5">
            <LeadProfile leadId={id as Id<'leads'>} />
        </div>
    );
}
