import { CampaignStudioPage } from "../../components/outreach/CampaignStudioPage";

interface CampaignNewPageProps {
    searchParams: Promise<{
        template?: string;
    }>;
}

export default async function CampaignNewPage({
    searchParams,
}: CampaignNewPageProps) {
    const params = await searchParams;

    return (
        <CampaignStudioPage
            mode="create"
            initialTemplateSelectionKey={params.template ?? null}
        />
    );
}
