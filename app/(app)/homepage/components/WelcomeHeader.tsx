"use client";

import { Sparkles } from "lucide-react";

export function WelcomeHeader() {
    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    };

    // Motivational message instead of redundant date
    const getMotivationalMessage = () => {
        const messages = [
            "Ready to close some deals today?",
            "Make today count!",
            "Your success starts now.",
            "Let's make it happen!",
            "Time to shine!",
        ];
        const hour = new Date().getHours();
        return messages[hour % messages.length];
    };

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                        {getTimeBasedGreeting()}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5" aria-hidden="true" />
                        {getMotivationalMessage()}
                    </p>
                </div>

                <div
                    className="hidden md:block h-1 w-16 rounded-full bg-primary/30"
                    aria-hidden="true"
                />
            </div>
        </div>
    );
}
