import { CampaignStudioPage } from "../../../components/outreach/CampaignStudioPage";

interface CampaignEditPageProps {
    params: Promise<{
        campaignId: string;
    }>;
}

export default async function CampaignEditPage({
    params,
}: CampaignEditPageProps) {
    const { campaignId } = await params;
    return <CampaignStudioPage mode="edit" campaignId={campaignId} />;
}
