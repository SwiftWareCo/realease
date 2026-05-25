'use client';

import { useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
    FileText,
    Mail,
    MapPin,
    MessageSquare,
    Pencil,
    Phone,
    PhoneCall,
    Plus,
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
    const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
    const [messageBody, setMessageBody] = useState('');
    const [noteBody, setNoteBody] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [isSavingNote, setIsSavingNote] = useState(false);

    const lead = useQuery(api.leads.queries.getLeadById, {
        id: leadId,
    }) as Doc<'leads'> | null | undefined;

    const communicationHistory = useQuery(
        api.leads.queries.getLeadCommunicationHistory,
        { leadId },
    );
    const leadNotes = useQuery(api.leads.queries.getLeadNotes, {
        leadId,
    }) as Doc<'leadNotes'>[] | undefined;

    const sendLeadDirectSms = useAction(api.outreach.actions.sendLeadDirectSms);
    const addLeadNote = useMutation(api.leads.mutations.addLeadNote);

    if (lead === undefined) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64 bg-muted" />
                <Skeleton className="h-[220px] rounded-3xl bg-muted" />
                <Skeleton className="h-[420px] rounded-3xl bg-muted" />
            </div>
        );
    }

    if (lead === null) {
        return (
            <div className="rounded-3xl border border-border bg-card p-10 text-center">
                <p className="text-foreground/70">Lead not found</p>
                <Button
                    asChild
                    className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
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
    const normalizedNoteBody = noteBody.trim();
    const hasComplianceBlock = Boolean(lead.do_not_call || lead.sms_opt_out);

    const noteItems: Array<{ _id: string; body: string; created_at: number }> =
        leadNotes && leadNotes.length > 0
            ? leadNotes.map((note) => ({
                  _id: String(note._id),
                  body: note.body,
                  created_at: note.created_at,
              }))
            : lead.notes
              ? [
                    {
                        _id: `legacy-${String(lead._id)}`,
                        body: lead.notes,
                        created_at: lead.created_at,
                    },
                ]
              : [];
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

    const handleAddNote = async () => {
        if (!normalizedNoteBody) {
            toast.error('Note cannot be empty.');
            return;
        }
        setIsSavingNote(true);
        try {
            await addLeadNote({
                leadId,
                body: normalizedNoteBody,
            });
            toast.success('Note added.');
            setNoteBody('');
            setIsAddNoteOpen(false);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to add note.';
            toast.error(message);
        } finally {
            setIsSavingNote(false);
        }
    };

    return (
        <>
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden text-foreground">
                <header className="border-b border-border pb-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                CRM {'>'} Active Lead
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2.5">
                                <h1 className="text-4xl font-semibold tracking-[-0.06em] text-foreground md:text-5xl">
                                    {lead.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="rounded-full border border-[color:var(--status-good)]/30 bg-[color:var(--status-good)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--status-good)]">
                                        {lead.intent}
                                    </Badge>
                                    <Badge className="rounded-full border border-[color:var(--status-special)]/30 bg-[color:var(--status-special)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--status-special)]">
                                        {tier}
                                    </Badge>
                                    <Badge className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        {formatStatus(lead.status)}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            <Button
                                variant="ghost"
                                asChild
                                className="h-11 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <Link href="/leads/network">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Leads
                                </Link>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl border-border bg-muted px-5 text-foreground hover:bg-accent"
                                onClick={() => setIsEditOpen(true)}
                            >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Profile
                            </Button>
                            <Button
                                className="h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
                                onClick={() => setIsContactSheetOpen(true)}
                            >
                                <PhoneCall className="mr-2 h-4 w-4" />
                                Contact
                            </Button>
                        </div>
                    </div>
                </header>

                <section className="grid min-h-0 flex-1 gap-6 overflow-hidden xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[auto_minmax(0,1fr)]">
                    <article className="rounded-3xl border border-border bg-card p-5 xl:col-start-1 xl:row-start-1">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                Contact & Core Information
                            </h2>
                            <div className="h-2.5 w-2.5 rounded-full bg-[color:var(--status-good)] shadow-[0_0_14px_color-mix(in_oklab,var(--status-good)_70%,transparent)]" />
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    Email Address
                                </p>
                                <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    {lead.email ?? 'Not provided'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    Phone Number
                                </p>
                                <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    {lead.phone}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    Property Address
                                </p>
                                <p className="mt-2 flex items-start gap-2 text-sm text-foreground">
                                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                    <span>{lead.property_address ?? 'Not specified'}</span>
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    Lead Source
                                </p>
                                <p className="mt-2 text-sm text-foreground">
                                    {formatOrigin(lead.source)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    Timeline
                                </p>
                                <div className="mt-2 flex items-center gap-3">
                                    <div className="h-1.5 w-[110px] overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{
                                                width: `${Math.max(8, Math.min(100, lead.urgency_score ?? 0))}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs text-primary">
                                        {formatTimeline(lead.timeline)}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    Budget Bracket
                                </p>
                                <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-foreground">
                                    {formatCurrencyRange(lead)}
                                </p>
                            </div>
                        </div>
                    </article>

                    <article className="rounded-3xl border border-border bg-card p-4 xl:col-start-2 xl:row-start-1">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                            Verified Dossier
                        </h2>
                        <div className="mt-4 space-y-2.5">
                            <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5">
                                <FileText className="h-4 w-4 text-[color:var(--status-good)]" />
                                <div>
                                    <p className="text-sm text-foreground">Lead Profile</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {formatStatus(lead.status)} / {lead.intent}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5">
                                <FileText className="h-4 w-4 text-[color:var(--status-good)]" />
                                <div>
                                    <p className="text-sm text-foreground">Source Record</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {formatOrigin(lead.source)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5">
                                <FileText className="h-4 w-4 text-[color:var(--status-good)]" />
                                <div>
                                    <p className="text-sm text-foreground">
                                        Communication Compliance
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {hasComplianceBlock
                                            ? 'Restricted'
                                            : 'Clear to contact'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </article>

                    <article className="order-3 flex min-h-0 flex-col rounded-3xl border border-border bg-card p-5 xl:col-start-1 xl:row-start-2 xl:order-none">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                Client Notes
                            </h2>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsAddNoteOpen(true)}
                                className="h-7 rounded-lg border-border bg-muted px-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--status-good)] hover:bg-accent"
                            >
                                Add Entry
                                <Plus className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                            {noteItems.length > 0 ? (
                                noteItems.map((note) => (
                                    <div
                                        key={note._id}
                                        className="rounded-2xl border border-[color:var(--status-good)]/30 bg-muted p-4"
                                    >
                                        <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--status-good)]">
                                            Added {formatCreatedAt(note.created_at)}
                                        </p>
                                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-foreground/80">
                                            {note.body}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                                    No notes yet.
                                </div>
                            )}
                        </div>
                    </article>

                    <article className="order-4 flex min-h-0 flex-col rounded-3xl border border-border bg-card p-4 xl:col-start-2 xl:row-start-2 xl:order-none">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                Engagement Log
                            </h2>
                            <span className="text-[11px] text-muted-foreground">
                                {historyItems.length} interactions
                            </span>
                        </div>
                        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                            {historyItems.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                                    No communication history yet.
                                </div>
                            ) : (
                                <VerticalTimeline>
                                    {historyItems.map((item) => {
                                        const callId =
                                            item.type === 'call'
                                                ? item.id.replace('call:', '')
                                                : null;
                                        const reportHref =
                                            item.type === 'call' &&
                                            item.campaignId &&
                                            callId
                                                ? `/leads/outreach/${item.campaignId}/calls/${callId}`
                                                : null;

                                        return (
                                            <VerticalTimelineItem
                                                key={item.id}
                                                contentClassName="rounded-xl border border-border bg-muted px-3 py-3"
                                                markerClassName="border-border bg-background"
                                                markerInnerClassName="bg-[color:var(--status-good)]"
                                            >
                                                <div className="min-w-0 space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {item.type === 'call' ? (
                                                            <PhoneCall className="h-4 w-4 text-primary" />
                                                        ) : (
                                                            <MessageSquare className="h-4 w-4 text-[color:var(--status-good)]" />
                                                        )}
                                                        <span className="text-sm font-semibold text-foreground">
                                                            {item.type === 'call'
                                                                ? 'Call'
                                                                : 'SMS'}
                                                        </span>
                                                        {item.type === 'sms' ? (
                                                            item.direction ===
                                                            'inbound' ? (
                                                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <ArrowDownLeft className="h-3 w-3" />{' '}
                                                                    Inbound
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <ArrowUpRight className="h-3 w-3" />{' '}
                                                                    Outbound
                                                                </span>
                                                            )
                                                        ) : null}
                                                    </div>
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatHistoryTimestamp(
                                                                item.timestamp,
                                                            )}
                                                        </p>
                                                        {item.type === 'call' ? (
                                                            reportHref ? (
                                                                <Button
                                                                    asChild
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs text-[color:var(--status-good)] hover:bg-[color:var(--status-good)]/10"
                                                                >
                                                                    <Link
                                                                        href={
                                                                            reportHref
                                                                        }
                                                                    >
                                                                        Open call report
                                                                    </Link>
                                                                </Button>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">
                                                                    No report link
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">
                                                                SMS record
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </VerticalTimelineItem>
                                        );
                                    })}
                                </VerticalTimeline>
                            )}
                        </div>
                    </article>
                </section>
            </div>

            <AddLeadModal
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                mode="edit"
                lead={lead}
            />

            <Dialog
                open={isAddNoteOpen}
                onOpenChange={(open) => {
                    setIsAddNoteOpen(open);
                    if (!open) {
                        setNoteBody('');
                    }
                }}
            >
                <DialogContent className="border-border bg-background text-foreground sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Add Note</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Add a timestamped note to {lead.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="lead-note-body" className="text-foreground/80">
                            Note
                        </Label>
                        <Textarea
                            id="lead-note-body"
                            value={noteBody}
                            onChange={(event) => setNoteBody(event.target.value)}
                            placeholder="Capture context, objections, or follow-up details..."
                            className="min-h-[140px] border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                            maxLength={2000}
                        />
                        <p className="text-right text-xs text-muted-foreground">
                            {noteBody.length}/2000
                        </p>
                    </div>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            className="text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => setIsAddNoteOpen(false)}
                            disabled={isSavingNote}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleAddNote}
                            disabled={isSavingNote || !normalizedNoteBody}
                            className="bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                            {isSavingNote ? 'Adding...' : 'Add note'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet open={isContactSheetOpen} onOpenChange={setIsContactSheetOpen}>
                <SheetContent
                    className="w-full max-w-[500px] border-l-border bg-background p-0 text-foreground sm:max-w-[500px]"
                    side="right"
                >
                    <SheetHeader className="border-b border-border px-6 py-5 text-left">
                        <SheetTitle className="text-xl text-foreground">
                            Contact Lead
                        </SheetTitle>
                        <SheetDescription className="text-muted-foreground">
                            Send a direct text message without selecting a campaign.
                        </SheetDescription>
                        <p className="text-sm text-foreground/80">
                            {lead.name} • {lead.phone}
                        </p>
                    </SheetHeader>

                    <div className="space-y-5 px-6 py-5">
                        <div className="space-y-2">
                            <Label htmlFor="message" className="text-foreground/80">
                                Message
                            </Label>
                            <Textarea
                                id="message"
                                value={messageBody}
                                onChange={(event) => setMessageBody(event.target.value)}
                                placeholder="Write an SMS message..."
                                className="min-h-[140px] border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                                maxLength={1200}
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                    {hasComplianceBlock
                                        ? 'This lead is currently blocked from SMS.'
                                        : 'Reply STOP handling remains active via Twilio webhook.'}
                                </span>
                                <span>{messageBody.length}/1200</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Recent Outreach
                            </h3>
                            <div className="mt-2 max-h-[280px] overflow-y-auto pr-1">
                                {historyPreview.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                                        No communication history yet.
                                    </div>
                                ) : (
                                    <VerticalTimeline>
                                        {historyPreview.map((item) => (
                                            <VerticalTimelineItem
                                                key={`sheet-${item.id}`}
                                                contentClassName="rounded-lg border border-border bg-muted px-3 py-2.5"
                                                markerClassName="border-border bg-background"
                                                markerInnerClassName="bg-primary"
                                            >
                                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                    <span className="inline-flex items-center gap-1">
                                                        {item.type === 'call' ? (
                                                            <PhoneCall className="h-3.5 w-3.5 text-primary" />
                                                        ) : (
                                                            <MessageSquare className="h-3.5 w-3.5 text-[color:var(--status-good)]" />
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
                                                <p className="mt-1 line-clamp-2 text-sm text-foreground/80">
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

                    <div className="mt-auto border-t border-border px-6 py-4">
                        <Button
                            className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
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
