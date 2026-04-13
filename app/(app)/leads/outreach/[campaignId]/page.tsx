import { CampaignDetailPage } from "../../components/outreach/CampaignDetailPage";

interface OutreachCampaignPageProps {
    params: Promise<{
        campaignId: string;
    }>;
}

export default async function OutreachCampaignPage({
    params,
}: OutreachCampaignPageProps) {
    const { campaignId } = await params;
    return <CampaignDetailPage campaignId={campaignId} />;
}
