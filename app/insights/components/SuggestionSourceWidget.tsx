'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, TrendingDown, MessageCircle, AlertCircle, Clock } from "lucide-react";

export function SuggestionSourceWidget() {
    const suggestions = [
        {
            id: 1,
            type: "Risk",
            title: "Seller Price Reduction",
            description: "Property at 123 Maple Ave has 50% less views this week. Market comparison suggests a 5% cut.",
            lead: "Sarah Johnson",
            confidence: "High",
            icon: TrendingDown,
            color: "text-orange-500",
            bg: "bg-orange-500/10",
            action: "Review Pricing"
        },
        {
            id: 2,
            type: "Opportunity",
            title: "Rising Engagement",
            description: "Michael Smith opened 3 emails and visited the site 5 times today. Call now.",
            lead: "Michael Smith",
            confidence: "Very High",
            icon: MessageCircle,
            color: "text-green-500",
            bg: "bg-green-500/10",
            action: "Call Lead"
        },
        {
            id: 3,
            type: "Warning",
            title: "Deal Risk",
            description: "Contract period ending for 456 Oak St without financing contingency removed.",
            lead: "David Brown",
            confidence: "Medium",
            icon: AlertCircle,
            color: "text-red-500",
            bg: "bg-red-500/10",
            action: "Check Status"
        },
        {
            id: 4,
            type: "Engagement",
            title: "Ghosting Risk",
            description: "No response from Jennifer Lee for 10 days after initial high interest.",
            lead: "Jennifer Lee",
            confidence: "High",
            icon: Clock,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            action: "Send Breakup Email"
        }
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            {suggestions.map((item) => (
                <Card key={item.id} className="flex flex-col">
                    <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                        <div className={`rounded-md p-2 ${item.bg} ${item.color}`}>
                            <item.icon className="size-5" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <Badge variant="outline" className="mb-2">{item.type}</Badge>
                                <span className="text-xs text-muted-foreground">{item.confidence} Confidence</span>
                            </div>
                            <CardTitle className="text-base">{item.title}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <p className="mb-2 text-sm text-muted-foreground">{item.description}</p>
                        <div className="mt-2 text-xs font-medium">Re: {item.lead}</div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" size="sm" variant="secondary">
                            {item.action} <ArrowRight className="ml-2 size-4" />
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
