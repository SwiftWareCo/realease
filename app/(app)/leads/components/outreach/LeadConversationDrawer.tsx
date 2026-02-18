"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { CampaignLeadConversationDetails } from "./types";
import { formatDateTimeHumanReadable } from "@/utils/dateandtimes";

function formatDateTime(timestamp: number | null): string {
    if (!timestamp) {
        return "-";
    }
    return formatDateTimeHumanReadable(timestamp);
}

export function LeadConversationDrawer({
    campaignId,
    leadId,
    open,
    onOpenChange,
}: {
    campaignId: Id<"outreachCampaigns">;
    leadId: Id<"leads"> | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const sendCampaignConversationSms = useAction(
        api.outreach.actions.sendCampaignConversationSms,
    );
    const detailsRaw = useQuery(
        api.outreach.queries.getCampaignLeadConversation,
        open && leadId ? { campaignId, leadId } : "skip",
    );
    const details = detailsRaw as CampaignLeadConversationDetails | undefined;

    const [draft, setDraft] = useState("");
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        setDraft("");
    }, [leadId, open]);

    const blockedReason = useMemo(() => {
        if (!details) {
            return "Loading lead context.";
        }
        if (details.lead.doNotCall) {
            return "Lead is marked do-not-call.";
        }
        if (details.lead.smsOptOut) {
            return "Lead has opted out of SMS.";
        }
        return null;
    }, [details]);

    const handleSend = async () => {
        if (!details) {
            return;
        }
        const body = draft.trim();
        if (!body) {
            toast.error("SMS body cannot be empty.");
            return;
        }
        if (blockedReason) {
            toast.error(blockedReason);
            return;
        }

        setIsSending(true);
        try {
            await sendCampaignConversationSms({
                campaignId,
                leadId: details.lead._id,
                callId: details.latestCallId ?? undefined,
                body,
            });
            setDraft("");
            toast.success("SMS sent.");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to send SMS.";
            toast.error(message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
                <SheetHeader className="px-6 pt-6 pb-4">
                    <SheetTitle>Lead Conversation</SheetTitle>
                    <SheetDescription>
                        Shared-number SMS thread for this campaign lead.
                    </SheetDescription>
                </SheetHeader>
                <Separator />
                {open && details === undefined ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : details ? (
                    <ScrollArea className="h-[calc(100vh-120px)]">
                        <div className="space-y-4 py-4 pl-6 pr-8 sm:pr-6">
                            <div className="rounded-md border p-3">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                        {details.lead.name}
                                    </Badge>
                                    <Badge variant="outline">
                                        {details.lead.phone}
                                    </Badge>
                                    <Badge variant="secondary">
                                        {details.lead.status}
                                    </Badge>
                                    {details.lead.doNotCall && (
                                        <Badge variant="destructive">
                                            Do Not Call
                                        </Badge>
                                    )}
                                    {details.lead.smsOptOut && (
                                        <Badge variant="destructive">
                                            SMS Opted Out
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Campaign: {details.campaign.name}
                                </p>
                            </div>

                            <div className="space-y-2 rounded-md border p-3">
                                <p className="text-xs text-muted-foreground">
                                    SMS Conversation
                                </p>
                                <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-md border p-2">
                                    {details.smsConversation.length === 0 ? (
                                        <p className="p-2 text-xs text-muted-foreground">
                                            No SMS messages recorded yet.
                                        </p>
                                    ) : (
                                        details.smsConversation.map(
                                            (message) => (
                                                <div
                                                    key={message.messageId}
                                                    className={
                                                        message.direction ===
                                                        "outbound"
                                                            ? "ml-6 rounded-md border bg-muted/30 p-2"
                                                            : "mr-6 rounded-md border p-2"
                                                    }
                                                >
                                                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                        <Badge variant="outline">
                                                            {message.direction}
                                                        </Badge>
                                                        <Badge variant="secondary">
                                                            {message.status}
                                                        </Badge>
                                                        <span>
                                                            {formatDateTime(
                                                                message.receivedAt ??
                                                                    message.sentAt ??
                                                                    message.createdAt,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs whitespace-pre-wrap">
                                                        {message.body}
                                                    </p>
                                                    {(message.errorMessage ||
                                                        message.providerMessageSid) && (
                                                        <div className="mt-1 text-[11px] text-muted-foreground">
                                                            {message.providerMessageSid && (
                                                                <p>
                                                                    SID:{" "}
                                                                    {
                                                                        message.providerMessageSid
                                                                    }
                                                                </p>
                                                            )}
                                                            {message.errorMessage && (
                                                                <p className="text-destructive">
                                                                    Error:{" "}
                                                                    {
                                                                        message.errorMessage
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ),
                                        )
                                    )}
                                </div>
                                <Textarea
                                    value={draft}
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                    rows={3}
                                    placeholder="Type a message..."
                                    disabled={
                                        isSending || Boolean(blockedReason)
                                    }
                                />
                                {blockedReason && (
                                    <p className="text-xs text-destructive">
                                        {blockedReason}
                                    </p>
                                )}
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        onClick={handleSend}
                                        disabled={
                                            isSending ||
                                            Boolean(blockedReason) ||
                                            draft.trim().length === 0
                                        }
                                    >
                                        {isSending ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="mr-2 h-4 w-4" />
                                        )}
                                        Send SMS
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="p-6 text-sm text-muted-foreground">
                        Lead conversation unavailable.
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
