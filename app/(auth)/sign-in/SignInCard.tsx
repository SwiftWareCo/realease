"use client";

import { SignIn } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export function SignInCard() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 150);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            className={`transition-all duration-500 ease-in-out ${
                mounted
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-3"
            }`}
        >
            <SignIn
                routing="path"
                path="/sign-in"
                appearance={{
                    variables: {
                        fontFamily: "var(--font-sans)",
                        fontFamilyButtons: "var(--font-sans)",
                        fontSize: "0.9rem",
                        colorPrimary: "hsl(var(--primary))",
                        colorPrimaryForeground:
                            "hsl(var(--primary-foreground))",
                        colorForeground: "hsl(var(--foreground))",
                        colorMutedForeground: "hsl(var(--muted-foreground))",
                        colorMuted: "hsl(var(--muted))",
                        colorBackground: "hsl(var(--background))",
                        colorInput: "hsl(var(--input))",
                        colorBorder: "white",
                        colorInputForeground: "hsl(var(--foreground))",
                        colorNeutral: "hsl(var(--muted-foreground))",
                    },
                }}
            />
        </div>
    );
}
