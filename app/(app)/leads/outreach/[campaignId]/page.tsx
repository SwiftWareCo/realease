import { OutreachCampaignRunPage } from "../../components/outreach/OutreachCampaignRunPage";

interface OutreachCampaignPageProps {
    params: Promise<{
        campaignId: string;
    }>;
}

export default async function OutreachCampaignPage({
    params,
}: OutreachCampaignPageProps) {
    const { campaignId } = await params;

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-y-auto bg-gradient-to-br from-background via-background to-muted/20">
            <div className="flex-1 min-h-0 px-6 pb-5 pt-5">
                <OutreachCampaignRunPage campaignId={campaignId} />
            </div>
        </div>
    );
}
