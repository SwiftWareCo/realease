import type { Metadata } from "next";
import { Open_Sans, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./providers/ThemeProvider";
import { ClerkProvider } from "@clerk/nextjs";

const openSans = Open_Sans({
    variable: "--font-sans",
    subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
    variable: "--font-mono",
    weight: ["400", "500", "600", "700"],
    subsets: ["latin"],
});

const sourceSerif4 = Source_Serif_4({
    variable: "--font-serif",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Realty - Real Estate Application",
    description: "Real estate application built with Next.js and Convex",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning className="h-svh">
            <body
                className={`${openSans.variable} ${ibmPlexMono.variable} ${sourceSerif4.variable} h-svh overflow-hidden antialiased`}
            >
                <ClerkProvider afterSignOutUrl={"/"}>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {children}
                    </ThemeProvider>
                </ClerkProvider>
            </body>
        </html>
    );
}
