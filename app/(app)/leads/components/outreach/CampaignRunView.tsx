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
import { getCampaignStatusBadge } from "./constants";
import type {
    CampaignRow,
    CampaignCallsData,
    CampaignLeadConversationDetails,
    CampaignTemplate,
    StartOutreachResult,
} from "./types";
import { formatDateTimeHumanReadable } from "@/utils/dateandtimes";
import { CallAttemptDetailsDrawer } from "./CallAttemptDetailsDrawer";
import { LeadConversationDrawer } from "./LeadConversationDrawer";
import { StartOutreachWizardModal } from "./StartOutreachWizardModal";
import { toast } from "sonner";
import { getOutreachOutcomeLabel } from "@/lib/outreach/outcomes";

function formatDateTime(timestamp: number): string {
    return formatDateTimeHumanReadable(timestamp);
}

export function CampaignRunView({
    campaign,
    data,
    onBack,
}: {
    campaign: CampaignRow;
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
    const templatesRaw = useQuery(api.outreach.queries.getCampaignTemplates, {});
    const templates = templatesRaw as CampaignTemplate[] | undefined;

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
                    ? (getOutreachOutcomeLabel(selectedLead.latestOutcome) ??
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

    const handleStartOutreach = async (input: {
        templateKey?: CampaignTemplate["key"];
        campaignId?: Id<"outreachCampaigns">;
        campaignName?: string;
        leadIds: Id<"leads">[];
    }) => {
        setIsStartingOutreach(true);
        try {
            const result = (await startOutreach(input)) as StartOutreachResult;

            if (result.enrolledCount > 0) {
                toast.success(
                    result.review.target.dispatchMode === "next_window"
                        ? `Enrolled ${result.enrolledCount} leads. Calls are queued for the next valid window.`
                        : `Enrolled ${result.enrolledCount} leads and scheduled outreach.`,
                );
            }
            if (result.skippedCount > 0) {
                toast.warning(
                    `${result.skippedCount} selected leads were skipped.`,
                );
            }

            setAddLeadsOpen(false);
        } catch (error) {
            console.error("Failed to start outreach", error);
            toast.error("Failed to enroll and schedule outreach.");
        } finally {
            setIsStartingOutreach(false);
        }
    };

    return (
        <div className="space-y-3">
            <Card>
                <CardContent className="flex flex-col gap-2 pt-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-0.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 h-7"
                            onClick={onBack}
                        >
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back to Campaigns
                        </Button>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold">
                                {data.campaign.name}
                            </h2>
                            {getCampaignStatusBadge(data.campaign.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Campaign run view with latest attempts and lead state.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-4">
                        <Badge
                            variant="outline"
                            className="justify-center py-1"
                        >
                            Total: {data.summary.total}
                        </Badge>
                        <Badge
                            variant="outline"
                            className="justify-center py-1"
                        >
                            Active:{" "}
                            {data.summary.queued +
                                data.summary.ringing +
                                data.summary.in_progress}
                        </Badge>
                        <Badge
                            variant="outline"
                            className="justify-center py-1"
                        >
                            Completed: {data.summary.completed}
                        </Badge>
                        <Badge
                            variant="outline"
                            className="justify-center py-1"
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

            <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
                <Card className="border-muted-foreground/20 shadow-sm lg:sticky lg:top-3 lg:flex lg:h-[calc(100vh-184px)] lg:flex-col lg:min-h-0">
                    <CardHeader className="space-y-2 pb-2 pt-4">
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
                    <CardContent className="lg:flex-1 lg:min-h-0">
                        <ScrollArea className="h-[280px] rounded-md border lg:h-full">
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
                                            className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                                                selected
                                                    ? "border-primary bg-primary/10 shadow-sm"
                                                    : "hover:bg-muted/40"
                                            }`}
                                        >
                                            <p className="text-sm font-medium leading-tight">
                                                {lead.leadName}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {lead.leadPhone}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                                    {lead.attempts} attempts
                                                </Badge>
                                                {lead.activeCalls > 0 && (
                                                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                                        {lead.activeCalls}{" "}
                                                        active
                                                    </Badge>
                                                )}
                                                {lead.latestOutcome && (
                                                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                                        {getOutreachOutcomeLabel(
                                                            lead.latestOutcome,
                                                        ) ?? lead.latestOutcome}
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
                    <CardHeader className="pb-2 pt-4">
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
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                                <Badge variant="outline" className="py-0">
                                    Lead: {selectedLead.leadName}
                                </Badge>
                                <Badge variant="outline" className="py-0">
                                    {selectedLead.leadPhone}
                                </Badge>
                                {selectedLeadSummaryBadges.map((item) => (
                                    <Badge
                                        key={`${item.label}-${item.value}`}
                                        variant="secondary"
                                        className="py-0"
                                    >
                                        {item.label}: {item.value}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[calc(100vh-290px)] min-h-[360px] rounded-md border">
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
                                                        {getOutreachOutcomeLabel(
                                                            attempt.outcome,
                                                        ) ?? attempt.outcome}
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
            {templates && (
                <StartOutreachWizardModal
                    campaigns={[campaign]}
                    templates={templates}
                    fixedCampaign={campaign}
                    open={addLeadsOpen}
                    isSubmitting={isStartingOutreach}
                    onOpenChange={setAddLeadsOpen}
                    onSubmit={handleStartOutreach}
                />
            )}
        </div>
    );
}
