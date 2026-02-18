"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { OUTCOME_LABELS, getCampaignStatusBadge } from "./constants";
import type {
    CampaignCallsData,
    CampaignLeadConversationDetails,
    StartOutreachResult,
} from "./types";
import { formatDateTimeHumanReadable } from "@/utils/dateandtimes";
import { CallAttemptDetailsDrawer } from "./CallAttemptDetailsDrawer";
import { LeadConversationDrawer } from "./LeadConversationDrawer";
import { StartOutreachWizardModal } from "./StartOutreachWizardModal";
import { toast } from "sonner";

function formatDateTime(timestamp: number): string {
    return formatDateTimeHumanReadable(timestamp);
}

export function CampaignRunView({
    data,
    onBack,
}: {
    data: CampaignCallsData;
    onBack: () => void;
}) {
    const [selectedCallId, setSelectedCallId] =
        useState<Id<"outreachCalls"> | null>(null);
    const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(
        null,
    );
    const [conversationOpen, setConversationOpen] = useState(false);
    const [addLeadsOpen, setAddLeadsOpen] = useState(false);
    const [isStartingOutreach, setIsStartingOutreach] = useState(false);
    const [leadSearch, setLeadSearch] = useState("");
    const startOutreach = useAction(api.outreach.actions.startCampaignOutreach);

    useEffect(() => {
        if (data.campaignLeads.length === 0) {
            setSelectedLeadId(null);
            setConversationOpen(false);
            return;
        }
        if (
            !selectedLeadId ||
            !data.campaignLeads.some((lead) => lead.leadId === selectedLeadId)
        ) {
            setSelectedLeadId(data.campaignLeads[0].leadId);
        }
    }, [data.campaignLeads, selectedLeadId]);

    const selectedLead =
        data.campaignLeads.find((lead) => lead.leadId === selectedLeadId) ??
        null;
    const selectedLeadConversationRaw = useQuery(
        api.outreach.queries.getCampaignLeadConversation,
        selectedLeadId
            ? {
                  campaignId: data.campaign._id,
                  leadId: selectedLeadId,
              }
            : "skip",
    );
    const selectedLeadConversation = selectedLeadConversationRaw as
        | CampaignLeadConversationDetails
        | undefined;
    const selectedLeadAttempts =
        selectedLeadConversation?.communicationAttempts ?? [];
    const selectedLeadAttemptsLoading =
        Boolean(selectedLeadId) && selectedLeadConversation === undefined;
    const selectedLeadSummaryBadges = useMemo(() => {
        if (!selectedLead) {
            return [];
        }
        return [
            { label: "Attempts", value: String(selectedLead.attempts) },
            { label: "Active Calls", value: String(selectedLead.activeCalls) },
            {
                label: "Last Status",
                value: selectedLead.latestCallStatus,
            },
            {
                label: "Last Outcome",
                value: selectedLead.latestOutcome
                    ? (OUTCOME_LABELS[selectedLead.latestOutcome] ??
                      selectedLead.latestOutcome)
                    : "-",
            },
        ];
    }, [selectedLead]);
    const filteredCampaignLeads = useMemo(() => {
        const query = leadSearch.trim().toLowerCase();
        if (!query) {
            return data.campaignLeads;
        }
        return data.campaignLeads.filter((lead) => {
            const name = lead.leadName.toLowerCase();
            const phone = lead.leadPhone.toLowerCase();
            return name.includes(query) || phone.includes(query);
        });
    }, [data.campaignLeads, leadSearch]);

    const handleStartOutreach = async (
        campaignId: Id<"outreachCampaigns">,
        leadIds: Id<"leads">[],
    ) => {
        if (leadIds.length === 0) {
            return;
        }

        setIsStartingOutreach(true);
        try {
            const result = (await startOutreach({
                campaignId,
                leadIds,
            })) as StartOutreachResult;

            if (result.startedCount > 0) {
                toast.success(
                    `Queued ${result.startedCount} calls. Provider dispatched ${result.dispatchedCount}.`,
                );
            }
            if (result.skippedCount > 0) {
                toast.warning(`Skipped ${result.skippedCount} leads.`);
            }
            if (result.dispatchFailedCount > 0) {
                toast.error(
                    `${result.dispatchFailedCount} queued calls failed provider dispatch.`,
                );
            }

            setAddLeadsOpen(false);
        } catch (error) {
            console.error("Failed to start outreach", error);
            toast.error("Failed to start outreach.");
        } finally {
            setIsStartingOutreach(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="flex flex-col gap-3 pt-5 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 h-8"
                            onClick={onBack}
                        >
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back to Campaigns
                        </Button>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold">
                                {data.campaign.name}
                            </h2>
                            {getCampaignStatusBadge(data.campaign.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Live view of communication attempts for this started
                            campaign.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <Badge
                            variant="outline"
                            className="justify-center py-1.5"
                        >
                            Total: {data.summary.total}
                        </Badge>
                        <Badge
                            variant="outline"
                            className="justify-center py-1.5"
                        >
                            Active:{" "}
                            {data.summary.queued +
                                data.summary.ringing +
                                data.summary.in_progress}
                        </Badge>
                        <Badge
                            variant="outline"
                            className="justify-center py-1.5"
                        >
                            Completed: {data.summary.completed}
                        </Badge>
                        <Badge
                            variant="outline"
                            className="justify-center py-1.5"
                        >
                            Failed: {data.summary.failed}
                        </Badge>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddLeadsOpen(true)}
                    >
                        Add Leads
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="border-muted-foreground/20 shadow-sm lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-220px)] lg:flex-col">
                    <CardHeader className="space-y-2 pb-2">
                        <CardTitle className="text-base">
                            Contacted Leads
                        </CardTitle>
                        <Input
                            value={leadSearch}
                            onChange={(event) =>
                                setLeadSearch(event.target.value)
                            }
                            placeholder="Search lead by name or phone"
                            className="h-8 text-xs"
                        />
                        <p className="text-xs text-muted-foreground">
                            Showing {filteredCampaignLeads.length} of{" "}
                            {data.campaignLeads.length} leads.
                        </p>
                    </CardHeader>
                    <CardContent className="lg:flex-1">
                        <ScrollArea className="h-full rounded-md border">
                            <div className="space-y-1 p-2">
                                {filteredCampaignLeads.length === 0 && (
                                    <div className="p-4 text-sm text-muted-foreground">
                                        {data.campaignLeads.length === 0
                                            ? "No contacted leads in this campaign yet."
                                            : "No leads match this search."}
                                    </div>
                                )}
                                {filteredCampaignLeads.map((lead) => {
                                    const selected =
                                        selectedLeadId === lead.leadId;
                                    return (
                                        <button
                                            key={lead.leadId}
                                            type="button"
                                            onClick={() =>
                                                setSelectedLeadId(lead.leadId)
                                            }
                                            className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                                                selected
                                                    ? "border-primary bg-primary/10 shadow-sm"
                                                    : "hover:bg-muted/40"
                                            }`}
                                        >
                                            <p className="text-sm font-medium">
                                                {lead.leadName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {lead.leadPhone}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <Badge variant="outline">
                                                    {lead.attempts} attempts
                                                </Badge>
                                                {lead.activeCalls > 0 && (
                                                    <Badge variant="secondary">
                                                        {lead.activeCalls}{" "}
                                                        active
                                                    </Badge>
                                                )}
                                                {lead.latestOutcome && (
                                                    <Badge variant="secondary">
                                                        {OUTCOME_LABELS[
                                                            lead.latestOutcome
                                                        ] ?? lead.latestOutcome}
                                                    </Badge>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="text-base">
                                Communication Attempts
                            </CardTitle>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConversationOpen(true)}
                                disabled={!selectedLead}
                            >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Open Conversation
                            </Button>
                        </div>
                        {selectedLead && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                <Badge variant="outline">
                                    Lead: {selectedLead.leadName}
                                </Badge>
                                <Badge variant="outline">
                                    {selectedLead.leadPhone}
                                </Badge>
                                {selectedLeadSummaryBadges.map((item) => (
                                    <Badge
                                        key={`${item.label}-${item.value}`}
                                        variant="secondary"
                                    >
                                        {item.label}: {item.value}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[520px] rounded-md border">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background">
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Outcome</TableHead>
                                        <TableHead>Retell Call ID</TableHead>
                                        <TableHead>Initiated</TableHead>
                                        <TableHead>Error</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedLeadAttempts.map((attempt) => (
                                        <TableRow
                                            key={attempt.callId}
                                            className="cursor-pointer hover:bg-muted/40"
                                            onClick={() =>
                                                setSelectedCallId(
                                                    attempt.callId,
                                                )
                                            }
                                        >
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {attempt.callStatus}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {attempt.outcome ? (
                                                    <Badge variant="secondary">
                                                        {OUTCOME_LABELS[
                                                            attempt.outcome
                                                        ] ?? attempt.outcome}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        -
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-[220px] truncate text-xs">
                                                {attempt.retellCallId ?? "-"}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {formatDateTime(
                                                    attempt.initiatedAt,
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-[260px] text-xs text-destructive">
                                                {attempt.errorMessage ?? "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {!selectedLead && (
                                <div className="p-10 text-center text-sm text-muted-foreground">
                                    Select a lead from the sidebar.
                                </div>
                            )}
                            {selectedLeadAttemptsLoading && (
                                <div className="p-10 text-center text-sm text-muted-foreground">
                                    Loading lead communication attempts...
                                </div>
                            )}
                            {selectedLead &&
                                !selectedLeadAttemptsLoading &&
                                selectedLeadAttempts.length === 0 && (
                                    <div className="p-10 text-center text-sm text-muted-foreground">
                                        No communication attempts recorded for
                                        this lead yet.
                                    </div>
                                )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            <CallAttemptDetailsDrawer
                campaignId={data.campaign._id}
                callId={selectedCallId}
                open={selectedCallId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedCallId(null);
                    }
                }}
                onSelectCall={setSelectedCallId}
            />
            <LeadConversationDrawer
                campaignId={data.campaign._id}
                leadId={selectedLeadId}
                open={conversationOpen && selectedLeadId !== null}
                onOpenChange={(open) => {
                    setConversationOpen(open);
                }}
            />
            <StartOutreachWizardModal
                campaign={{
                    _id: data.campaign._id,
                    name: data.campaign.name,
                }}
                open={addLeadsOpen}
                isStarting={isStartingOutreach}
                onOpenChange={setAddLeadsOpen}
                onStart={handleStartOutreach}
            />
        </div>
    );
}
