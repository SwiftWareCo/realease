import { SignInCard } from "../SignInCard";
import { ClerkLoaded } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <div className="flex min-h-svh items-center justify-center bg-muted p-4">
            <ClerkLoaded>
                <SignInCard />
            </ClerkLoaded>
        </div>
    );
}
