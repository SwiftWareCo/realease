'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    User,
    Phone,
    Mail,
    MapPin,
    ArrowLeft,
    TrendingUp,
    MessageSquare,
    Clock,
} from 'lucide-react';
import Link from 'next/link';
import { LeadEventsSection } from './LeadEventsSection';

interface LeadProfileProps {
    leadId: Id<'leads'>;
}

export function LeadProfile({ leadId }: LeadProfileProps) {
    const lead = useQuery(api.leads.queries.getLeadById, { id: leadId }) as Doc<'leads'> | null | undefined;
    
    if (lead === undefined) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (lead === null) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Lead not found</p>
                    <Button asChild className="mt-4">
                        <Link href="/dashboard">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'new':
                return <Badge className="bg-blue-500">New</Badge>;
            case 'contacted':
                return <Badge className="bg-yellow-500">Contacted</Badge>;
            case 'qualified':
                return <Badge className="bg-green-500">Qualified</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const getIntentBadge = (intent: string) => {
        switch (intent) {
            case 'buyer':
                return <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300">Buyer</Badge>;
            case 'seller':
                return <Badge variant="outline" className="border-green-300 text-green-700 dark:text-green-300">Seller</Badge>;
            case 'investor':
                return <Badge variant="outline" className="border-purple-300 text-purple-700 dark:text-purple-300">Investor</Badge>;
            default:
                return <Badge variant="outline">{intent}</Badge>;
        }
    };

    const getSentimentBadge = (sentiment?: string) => {
        if (!sentiment) return null;
        switch (sentiment) {
            case 'positive':
                return <Badge variant="outline" className="border-green-300 text-green-700 dark:text-green-300">Positive</Badge>;
            case 'negative':
                return <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-300">Negative</Badge>;
            default:
                return <Badge variant="outline" className="border-gray-300 text-gray-700 dark:text-gray-300">Neutral</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" asChild>
                        <Link href="/dashboard">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            {lead.name}
                            {getStatusBadge(lead.status)}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            {getIntentBadge(lead.intent)}
                            <Badge variant="secondary" className="text-xs">
                                {lead.urgency_score}% Urgency
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Contact Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="h-5 w-5" />
                            Contact Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.phone}</span>
                        </div>
                        {lead.email && (
                            <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{lead.email}</span>
                            </div>
                        )}
                        {lead.property_address && (
                            <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <span>{lead.property_address}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Source: {lead.source}</span>
                        </div>
                        {lead.timeline && (
                            <div className="text-sm text-muted-foreground">
                                Timeline: {lead.timeline}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* AI Insights Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <TrendingUp className="h-5 w-5" />
                            AI Insights
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {lead.conversion_prediction && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                    Conversion Prediction
                                </p>
                                <p className="text-blue-700 dark:text-blue-300">
                                    {lead.conversion_prediction}
                                </p>
                            </div>
                        )}
                        {lead.ai_suggestion && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                                    💡 AI Suggestion
                                </p>
                                <p className="text-yellow-700 dark:text-yellow-300">
                                    {lead.ai_suggestion}
                                </p>
                            </div>
                        )}
                        {lead.last_message_content && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Latest Message</span>
                                    {getSentimentBadge(lead.last_message_sentiment)}
                                </div>
                                <p className="text-sm text-muted-foreground italic">
                                    &quot;{lead.last_message_content}&quot;
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Notes Card */}
                {lead.notes && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <MessageSquare className="h-5 w-5" />
                                Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Events Section */}
                <LeadEventsSection leadId={leadId} leadName={lead.name} />
            </div>
        </div>
    );
}
