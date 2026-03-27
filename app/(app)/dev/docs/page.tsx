import { DevDocsViewer } from "@/components/dev-docs/dev-docs-viewer";
import { listArchitectureDocs } from "@/lib/dev-docs";

export default async function DevDocsPage() {
    const docs = await listArchitectureDocs();
    return <DevDocsViewer docs={docs} />;
}
