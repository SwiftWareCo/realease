import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

const quote = {
    text: "The best time to buy a home was 10 years ago. The second best time is now.",
    author: "Real Estate Wisdom",
};

export function QuoteOfTheDay() {
    return (
        <Card className="relative overflow-hidden bg-gradient-to-br from-accent/20 via-background to-secondary/10 border-accent/30">
            {/* Decorative quote icon */}
            <div
                className="absolute top-4 right-4 opacity-10"
                aria-hidden="true"
            >
                <Quote className="size-12 text-primary" />
            </div>

            <CardContent className="relative p-5">
                {/* Label */}
                <div className="mb-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary/70">
                        Quote of the Day
                    </span>
                </div>

                <div className="transition-opacity duration-500 opacity-100">
                    <blockquote className="space-y-3">
                        <p className="font-serif text-base leading-relaxed text-foreground italic">
                            &ldquo;{quote.text}&rdquo;
                        </p>
                        <footer className="flex items-center gap-2">
                            <div
                                className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent"
                                aria-hidden="true"
                            />
                            <cite className="text-sm font-medium text-muted-foreground not-italic">
                                — {quote.author}
                            </cite>
                        </footer>
                    </blockquote>
                </div>
            </CardContent>
        </Card>
    );
}
