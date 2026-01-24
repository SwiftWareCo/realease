"use client";

import ModeToggle from "@/components/mode-toggle";
import { UpcomingEventsWidget } from "@/components/events/UpcomingEventsWidget";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserButton } from "@clerk/nextjs";
import { Authenticated } from "convex/react";

export function TopBar() {
    return (
        <div className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
                <UpcomingEventsWidget />
                <ModeToggle />
                <Authenticated>
                    <UserButton  />
                </Authenticated>
            </div>
        </div>
    );
}
