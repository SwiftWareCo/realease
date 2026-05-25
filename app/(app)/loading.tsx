import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-background">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    );
}
