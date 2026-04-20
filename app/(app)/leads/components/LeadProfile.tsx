'use client';

import { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
    ArrowDownLeft,
    ArrowLeft,
    ArrowUpRight,
    CalendarClock,
    Clock3,
    FileText,
    Mail,
    MapPin,
    MessageSquare,
    Pencil,
    Phone,
    PhoneCall,
    Send,
} from 'lucide-react';
import Link from 'next/link';
import { AddLeadModal } from './AddLeadModal';
import { deriveTier, formatOrigin } from './leads-ui';
import {
    VerticalTimeline,
    VerticalTimelineItem,
} from './outreach/campaign-ui';

interface LeadProfileProps {
    leadId: Id<'leads'>;
}

function formatStatus(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTimeline(timeline?: string) {
    if (!timeline) return 'Not specified';
    return timeline
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCreatedAt(timestamp: number) {
    return new Date(timestamp).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatCurrencyRange(lead: Doc<'leads'>) {
    if (lead.budget) return lead.budget;
    if (typeof lead.list_price === 'number') {
        const amount = lead.list_price / 100;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    }
    return 'Unspecified';
}

function formatHistoryTimestamp(timestamp: number) {
    return new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function LeadProfile({ leadId }: LeadProfileProps) {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
    const [messageBody, setMessageBody] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);

    const lead = useQuery(api.leads.queries.getLeadById, {
        id: leadId,
    }) as Doc<'leads'> | null | undefined;

    const eventBuckets = useQuery(api.events.queries.getLeadEventsBuckets, {
        leadId,
    }) as { upcoming: Doc<'events'>[]; past: Doc<'events'>[] } | undefined;

    const communicationHistory = useQuery(
        api.leads.queries.getLeadCommunicationHistory,
        { leadId },
    );

    const sendLeadDirectSms = useAction(api.outreach.actions.sendLeadDirectSms);

    if (lead === undefined) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64 bg-slate-800/70" />
                <Skeleton className="h-[220px] rounded-3xl bg-slate-800/70" />
                <Skeleton className="h-[420px] rounded-3xl bg-slate-800/70" />
            </div>
        );
    }

    if (lead === null) {
        return (
            <div className="rounded-3xl border border-slate-800 bg-[#111a2e] p-10 text-center">
                <p className="text-slate-300">Lead not found</p>
                <Button
                    asChild
                    className="mt-4 bg-[#ffb08a] text-[#211108] hover:bg-[#ffc2a3]"
                >
                    <Link href="/leads/network">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Leads
                    </Link>
                </Button>
            </div>
        );
    }

    const tier = deriveTier(lead);
    const normalizedMessage = messageBody.trim();
    const hasComplianceBlock = Boolean(lead.do_not_call || lead.sms_opt_out);

    const lastEvent = eventBuckets?.past[0] ?? null;
    const nextEvent = eventBuckets?.upcoming[0] ?? null;
    const historyItems = communicationHistory ?? [];
    const historyPreview = historyItems.slice(0, 8);

    const handleSendMessage = async () => {
        if (!normalizedMessage) {
            toast.error('Message body cannot be empty.');
            return;
        }
        setIsSendingMessage(true);
        try {
            await sendLeadDirectSms({
                leadId,
                body: normalizedMessage,
            });
            toast.success(`Message sent to ${lead.name}.`);
            setMessageBody('');
            setIsContactSheetOpen(false);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to send message.';
            toast.error(message);
        } finally {
            setIsSendingMessage(false);
        }
    };

    return (
        <>
            <div className="space-y-6 text-slate-100">
                <header className="border-b border-slate-800/90 pb-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                                CRM {'>'} Active Lead
                            </div>
                            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-white md:text-5xl">
                                {lead.name}
                            </h1>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                                    {lead.intent}
                                </Badge>
                                <Badge className="rounded-full border border-orange-400/35 bg-orange-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-200">
                                    {tier}
                                </Badge>
                                <Badge className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                                    {formatStatus(lead.status)}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl border-slate-700 bg-[#0d1a34] px-5 text-slate-100 hover:bg-[#132345]"
                                onClick={() => setIsEditOpen(true)}
                            >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Profile
                            </Button>
                            <Button
                                className="h-11 rounded-xl bg-[#ffb08a] px-5 font-semibold text-[#2d170d] hover:bg-[#ffc3a5]"
                                onClick={() => setIsContactSheetOpen(true)}
                            >
                                <PhoneCall className="mr-2 h-4 w-4" />
                                Contact
                            </Button>
                        </div>
                    </div>
                </header>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-5">
                        <article className="rounded-3xl border border-slate-800 bg-[#111a33]/95 p-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                                    Contact & Core Information
                                </h2>
                                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]" />
                            </div>
                            <div className="mt-6 grid gap-5 md:grid-cols-2">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                        Email Address
                                    </p>
                                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-100">
                                        <Mail className="h-4 w-4 text-slate-500" />
                                        {lead.email ?? 'Not provided'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                        Phone Number
                                    </p>
                                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-100">
                                        <Phone className="h-4 w-4 text-slate-500" />
                                        {lead.phone}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                        Property Address
                                    </p>
                                    <p className="mt-2 flex items-start gap-2 text-sm text-slate-100">
                                        <MapPin className="mt-0.5 h-4 w-4 text-slate-500" />
                                        <span>{lead.property_address ?? 'Not specified'}</span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                        Lead Source
                                    </p>
                                    <p className="mt-2 text-sm text-slate-100">
                                        {formatOrigin(lead.source)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                        Timeline
                                    </p>
                                    <div className="mt-2 flex items-center gap-3">
                                        <div className="h-1.5 w-[110px] overflow-hidden rounded-full bg-slate-800">
                                            <div
                                                className="h-full rounded-full bg-[#ffb08a]"
                                                style={{
                                                    width: `${Math.max(8, Math.min(100, lead.urgency_score ?? 0))}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs text-[#ffb08a]">
                                            {formatTimeline(lead.timeline)}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                        Budget Bracket
                                    </p>
                                    <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-50">
                                        {formatCurrencyRange(lead)}
                                    </p>
                                </div>
                            </div>
                        </article>

                        <article className="rounded-3xl border border-slate-800 bg-[#111a33]/95 p-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                                    Client Notes & Dossier
                                </h2>
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                                    Updated {formatCreatedAt(lead.created_at)}
                                </span>
                            </div>
                            <div className="mt-4 space-y-3">
                                {lead.notes ? (
                                    <div className="rounded-2xl border border-emerald-400/25 bg-[#0d162d] p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                                            Notes
                                        </p>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                                            {lead.notes}
                                        </p>
                                    </div>
                                ) : null}
                                {lead.last_message_content ? (
                                    <div className="rounded-2xl border border-slate-700 bg-[#0b1429] p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                            Last Message Snapshot
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-slate-300">
                                            {lead.last_message_content}
                                        </p>
                                    </div>
                                ) : null}
                                {!lead.notes && !lead.last_message_content ? (
                                    <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">
                                        No notes or message context yet.
                                    </div>
                                ) : null}
                                <div className="rounded-2xl border border-slate-700 bg-[#0b1429] p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                            Communication Timeline
                                        </p>
                                        <span className="text-[11px] text-slate-500">
                                            {historyItems.length} interactions
                                        </span>
                                    </div>
                                    <div className="mt-3 max-h-[340px] overflow-y-auto pr-1">
                                        {historyItems.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-500">
                                                No communication history yet.
                                            </div>
                                        ) : (
                                            <VerticalTimeline>
                                                {historyItems.map((item) => (
                                                    <VerticalTimelineItem
                                                        key={item.id}
                                                        contentClassName="rounded-xl border border-slate-800 bg-[#091225] px-3 py-3"
                                                        markerClassName="border-[#0b1429] bg-[#091121]"
                                                        markerInnerClassName="bg-emerald-300"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {item.type === 'call' ? (
                                                                    <PhoneCall className="h-4 w-4 text-[#ffb08a]" />
                                                                ) : (
                                                                    <MessageSquare className="h-4 w-4 text-emerald-300" />
                                                                )}
                                                                <span className="text-sm font-semibold text-slate-100">
                                                                    {item.type === 'call'
                                                                        ? 'Call'
                                                                        : 'SMS'}
                                                                </span>
                                                                {item.type === 'sms' ? (
                                                                    item.direction ===
                                                                    'inbound' ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                                                            <ArrowDownLeft className="h-3 w-3" />{' '}
                                                                            Inbound
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                                                            <ArrowUpRight className="h-3 w-3" />{' '}
                                                                            Outbound
                                                                        </span>
                                                                    )
                                                                ) : null}
                                                                {item.campaignName ? (
                                                                    <Badge className="border-slate-700 bg-slate-900 text-[10px] text-slate-300">
                                                                        {item.campaignName}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="border-slate-700 bg-slate-900 text-[10px] text-slate-400">
                                                                        Direct
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="mt-1 text-sm text-slate-300">
                                                                {item.summary ??
                                                                    item.status ??
                                                                    'No details'}
                                                            </p>
                                                            {item.errorMessage ? (
                                                                <p className="mt-1 text-xs text-rose-300">
                                                                    {
                                                                        item.errorMessage
                                                                    }
                                                                </p>
                                                            ) : null}
                                                            <p className="mt-2 text-xs text-slate-500">
                                                                {formatHistoryTimestamp(
                                                                    item.timestamp,
                                                                )}
                                                            </p>
                                                        </div>
                                                    </VerticalTimelineItem>
                                                ))}
                                            </VerticalTimeline>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </article>
                    </div>

                    <div className="space-y-5">
                        <article className="rounded-3xl border border-slate-800 bg-[#111a33]/95 p-5">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                                Engagement Log
                            </h2>
                            <div className="mt-4 space-y-4">
                                <div className="rounded-2xl border border-slate-700 bg-[#0b1429] p-3.5">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Last Contact
                                    </p>
                                    <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-100">
                                        <Clock3 className="h-4 w-4 text-slate-500" />
                                        {lastEvent
                                            ? new Date(lastEvent.start_time).toLocaleString(
                                                  'en-US',
                                                  {
                                                      month: 'short',
                                                      day: 'numeric',
                                                      hour: 'numeric',
                                                      minute: '2-digit',
                                                  },
                                              )
                                            : 'No past event logged'}
                                    </p>
                                    {lastEvent ? (
                                        <p className="mt-1 text-xs text-slate-400">
                                            {lastEvent.title}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="rounded-2xl border border-slate-700 bg-[#0b1429] p-3.5">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Next Event
                                    </p>
                                    <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-100">
                                        <CalendarClock className="h-4 w-4 text-emerald-300" />
                                        {nextEvent
                                            ? new Date(nextEvent.start_time).toLocaleString(
                                                  'en-US',
                                                  {
                                                      month: 'short',
                                                      day: 'numeric',
                                                      hour: 'numeric',
                                                      minute: '2-digit',
                                                  },
                                              )
                                            : 'No upcoming event'}
                                    </p>
                                    {nextEvent ? (
                                        <p className="mt-1 text-xs text-emerald-300">
                                            {nextEvent.title}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </article>

                        <article className="rounded-3xl border border-slate-800 bg-[#111a33]/95 p-5">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                                Verified Dossier
                            </h2>
                            <div className="mt-4 space-y-2.5">
                                <div className="flex items-center gap-3 rounded-xl bg-[#0b1429] px-3 py-2.5">
                                    <FileText className="h-4 w-4 text-emerald-300" />
                                    <div>
                                        <p className="text-sm text-slate-100">Lead Profile</p>
                                        <p className="text-[11px] text-slate-500">
                                            {formatStatus(lead.status)} / {lead.intent}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-xl bg-[#0b1429] px-3 py-2.5">
                                    <FileText className="h-4 w-4 text-emerald-300" />
                                    <div>
                                        <p className="text-sm text-slate-100">Source Record</p>
                                        <p className="text-[11px] text-slate-500">
                                            {formatOrigin(lead.source)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-xl bg-[#0b1429] px-3 py-2.5">
                                    <FileText className="h-4 w-4 text-emerald-300" />
                                    <div>
                                        <p className="text-sm text-slate-100">
                                            Communication Compliance
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            {hasComplianceBlock
                                                ? 'Restricted'
                                                : 'Clear to contact'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </article>

                    </div>
                </section>

                <div className="border-t border-slate-800/80 pt-4">
                    <Button
                        variant="ghost"
                        asChild
                        className="text-slate-400 hover:bg-slate-900/60 hover:text-slate-100"
                    >
                        <Link href="/leads/network">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Leads
                        </Link>
                    </Button>
                </div>
            </div>

            <AddLeadModal
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                mode="edit"
                lead={lead}
            />

            <Sheet open={isContactSheetOpen} onOpenChange={setIsContactSheetOpen}>
                <SheetContent
                    className="w-full max-w-[500px] border-l-slate-800 bg-[#071025] p-0 text-slate-100 sm:max-w-[500px]"
                    side="right"
                >
                    <SheetHeader className="border-b border-slate-800 px-6 py-5 text-left">
                        <SheetTitle className="text-xl text-slate-100">
                            Contact Lead
                        </SheetTitle>
                        <SheetDescription className="text-slate-400">
                            Send a direct text message without selecting a campaign.
                        </SheetDescription>
                        <p className="text-sm text-slate-300">
                            {lead.name} • {lead.phone}
                        </p>
                    </SheetHeader>

                    <div className="space-y-5 px-6 py-5">
                        <div className="space-y-2">
                            <Label htmlFor="message" className="text-slate-300">
                                Message
                            </Label>
                            <Textarea
                                id="message"
                                value={messageBody}
                                onChange={(event) => setMessageBody(event.target.value)}
                                placeholder="Write an SMS message..."
                                className="min-h-[140px] border-slate-700 bg-[#0e1731] text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-500"
                                maxLength={1200}
                            />
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    {hasComplianceBlock
                                        ? 'This lead is currently blocked from SMS.'
                                        : 'Reply STOP handling remains active via Twilio webhook.'}
                                </span>
                                <span>{messageBody.length}/1200</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                Recent Outreach
                            </h3>
                            <div className="mt-2 max-h-[280px] overflow-y-auto pr-1">
                                {historyPreview.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500">
                                        No communication history yet.
                                    </div>
                                ) : (
                                    <VerticalTimeline>
                                        {historyPreview.map((item) => (
                                            <VerticalTimelineItem
                                                key={`sheet-${item.id}`}
                                                contentClassName="rounded-lg border border-slate-800 bg-[#0b1429] px-3 py-2.5"
                                                markerClassName="border-[#071025] bg-[#091121]"
                                                markerInnerClassName="bg-[#ffb08a]"
                                            >
                                                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                                                    <span className="inline-flex items-center gap-1">
                                                        {item.type === 'call' ? (
                                                            <PhoneCall className="h-3.5 w-3.5 text-[#ffb08a]" />
                                                        ) : (
                                                            <MessageSquare className="h-3.5 w-3.5 text-emerald-300" />
                                                        )}
                                                        {item.type === 'call'
                                                            ? 'Call'
                                                            : 'SMS'}
                                                    </span>
                                                    <span>
                                                        {formatHistoryTimestamp(
                                                            item.timestamp,
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-sm text-slate-300">
                                                    {item.summary ??
                                                        item.status ??
                                                        'No details'}
                                                </p>
                                            </VerticalTimelineItem>
                                        ))}
                                    </VerticalTimeline>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto border-t border-slate-800 px-6 py-4">
                        <Button
                            className="h-11 w-full rounded-xl bg-[#ffb08a] font-semibold text-[#2d170d] hover:bg-[#ffc3a5]"
                            onClick={handleSendMessage}
                            disabled={
                                isSendingMessage ||
                                !normalizedMessage ||
                                hasComplianceBlock
                            }
                        >
                            {isSendingMessage ? (
                                'Sending...'
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send Text Message
                                </>
                            )}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
