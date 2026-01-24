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
        <div className="p-8">
            <LeadProfile leadId={id as Id<'leads'>} />
        </div>
    );
}
