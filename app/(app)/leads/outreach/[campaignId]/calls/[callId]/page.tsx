import { CampaignCallReportPage } from "../../../../components/outreach/CampaignCallReportPage";

interface CampaignCallReportRouteProps {
    params: Promise<{
        campaignId: string;
        callId: string;
    }>;
}

export default async function CampaignCallReportRoute({
    params,
}: CampaignCallReportRouteProps) {
    const { campaignId, callId } = await params;
    return <CampaignCallReportPage campaignId={campaignId} callId={callId} />;
}
