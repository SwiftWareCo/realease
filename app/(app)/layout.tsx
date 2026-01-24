import { ConvexClientProvider } from "../providers/ConvexClientProvider";
import { Sidebar } from "../../components/layout/Sidebar";
import { TopBar } from "../../components/layout/TopBar";
import { Toaster } from "sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ConvexClientProvider>
            <SidebarProvider className="h-svh overflow-hidden">
                <Sidebar />
                <SidebarInset className="min-h-0">
                    <TopBar />
                    <main className="flex-1 min-h-0 overflow-y-auto">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
            <Toaster richColors position="top-right" />
        </ConvexClientProvider>
    );
}
