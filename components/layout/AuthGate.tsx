"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import type { ReactNode } from "react";
import { AppShellSkeleton } from "./AppShellSkeleton";

export function AuthGate({ children }: { children: ReactNode }) {
    return (
        <>
            <AuthLoading>
                <AppShellSkeleton />
            </AuthLoading>
            <Unauthenticated>
                <AppShellSkeleton />
            </Unauthenticated>
            <Authenticated>{children}</Authenticated>
        </>
    );
}
