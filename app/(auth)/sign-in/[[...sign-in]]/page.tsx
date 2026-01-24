import { SignInCard } from "../SignInCard";
import { ClerkLoaded } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <div className="relative grid min-h-svh place-items-center overflow-hidden px-6 py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklch,var(--primary)_22%,transparent)_0%,transparent_55%),radial-gradient(circle_at_80%_70%,color-mix(in_oklch,var(--accent)_28%,transparent)_0%,transparent_60%),linear-gradient(180deg,var(--background)_0%,color-mix(in_oklch,var(--muted)_35%,var(--background))_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,color-mix(in_oklch,var(--foreground)_12%,transparent)_100%)] opacity-40" />

            <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-border/70 bg-background/85 shadow-2xl backdrop-blur">
                <div className="grid min-h-[560px] gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="relative hidden flex-col justify-between p-10 text-foreground lg:flex lg:py-14">
                        <div className="space-y-4">
                            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                                RealEase
                            </p>
                            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                                Welcome back to your deal desk.
                            </h1>
                            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                                Track leads, schedule viewings, and keep every
                                deal moving with one focused workspace.
                            </p>
                        </div>
                        <div className="mt-10 space-y-3 text-xs text-muted-foreground">
                            <p className="uppercase tracking-[0.2em]">
                                Built for agents
                            </p>
                            <p>
                                Real-time updates. Clean handoffs. No busywork.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-center bg-card/60 p-6 md:p-10">
                        <ClerkLoaded>
                            <SignInCard />
                        </ClerkLoaded>
                    </div>
                </div>
            </div>
        </div>
    );
}
