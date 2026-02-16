"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CampaignCreateWizard } from "./outreach/CampaignCreateWizard";
import { CampaignSettingsForm } from "./outreach/CampaignSettingsForm";
import { CampaignsTable } from "./outreach/CampaignsTable";
import { StartOutreachWizardModal } from "./outreach/StartOutreachWizardModal";
import type {
    CampaignRow,
    CampaignSettingsInput,
    CreateCampaignInput,
    StartOutreachResult,
} from "./outreach/types";

export function OutreachLeadPicker({
    createDialogOpen,
    onCreateDialogOpenChange,
}: {
    createDialogOpen: boolean;
    onCreateDialogOpenChange: (open: boolean) => void;
}) {
    const router = useRouter();
    const [editingCampaignId, setEditingCampaignId] =
        useState<Id<"outreachCampaigns"> | null>(null);
    const [wizardCampaignId, setWizardCampaignId] =
        useState<Id<"outreachCampaigns"> | null>(null);

    const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
    const [isSavingCampaign, setIsSavingCampaign] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [lastStartResult, setLastStartResult] =
        useState<StartOutreachResult | null>(null);

    const campaignsRaw = useQuery(api.outreach.queries.getCampaignsForPicker, {
        includeInactive: false,
    });
    const campaigns = campaignsRaw as CampaignRow[] | undefined;

    const createCampaign = useMutation(api.outreach.mutations.createCampaign);
    const updateCampaign = useMutation(
        api.outreach.mutations.updateCampaignSettings,
    );
    const startOutreach = useAction(api.outreach.actions.startCampaignOutreach);

    const editingCampaign =
        campaigns?.find((campaign) => campaign._id === editingCampaignId) ??
        null;
    const wizardCampaign =
        campaigns?.find((campaign) => campaign._id === wizardCampaignId) ??
        null;

    const handleCreateCampaign = async (input: CreateCampaignInput) => {
        setIsCreatingCampaign(true);
        try {
            const campaignId = await createCampaign(input);
            onCreateDialogOpenChange(false);
            setWizardCampaignId(campaignId);
            toast.success("Campaign created.");
        } catch (error) {
            console.error("Failed to create campaign", error);
            toast.error("Failed to create campaign.");
        } finally {
            setIsCreatingCampaign(false);
        }
    };

    const handleSaveCampaign = async (input: CampaignSettingsInput) => {
        if (!editingCampaign) {
            return;
        }

        setIsSavingCampaign(true);
        try {
            await updateCampaign({
                campaignId: editingCampaign._id,
                name: input.name.trim(),
                description: input.description.trim() || null,
                status: input.status,
                timezone: input.timezone.trim(),
                calling_window: {
                    start_hour_local: input.startHour,
                    end_hour_local: input.endHour,
                    allowed_weekdays: input.allowedWeekdays,
                },
                retry_policy: {
                    max_attempts: input.maxAttempts,
                    min_minutes_between_attempts: input.cooldownMinutes,
                },
                retell_agent_id: input.retellAgentId.trim() || null,
                retell_phone_number_id:
                    input.retellPhoneNumberId.trim() || null,
                twilio_messaging_service_sid:
                    input.twilioMessagingServiceSid.trim() || null,
            });
            toast.success("Campaign settings updated.");
            setEditingCampaignId(null);
        } catch (error) {
            console.error("Failed to update campaign", error);
            toast.error("Failed to update campaign settings.");
        } finally {
            setIsSavingCampaign(false);
        }
    };

    const handleStartOutreach = async (
        campaignId: Id<"outreachCampaigns">,
        leadIds: Id<"leads">[],
    ) => {
        if (leadIds.length === 0) {
            return;
        }

        setIsStarting(true);
        try {
            const result = (await startOutreach({
                campaignId,
                leadIds,
            })) as StartOutreachResult;

            setLastStartResult(result);

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

            if (result.startedCount > 0) {
                router.push(`/leads/outreach/${result.campaignId}`);
            }
            setWizardCampaignId(null);
        } catch (error) {
            console.error("Failed to start outreach", error);
            toast.error("Failed to start outreach.");
        } finally {
            setIsStarting(false);
        }
    };

    if (campaigns === undefined) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-[640px]" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <CampaignsTable
                campaigns={campaigns}
                onEditCampaign={(campaign) =>
                    setEditingCampaignId(campaign._id)
                }
                onStartOutreach={(campaign) =>
                    setWizardCampaignId(campaign._id)
                }
                onViewCampaign={(campaign) =>
                    router.push(`/leads/outreach/${campaign._id}`)
                }
            />

            {lastStartResult && (
                <Card>
                    <CardContent className="flex flex-wrap items-center gap-2 pt-4 text-sm">
                        <Badge variant="outline">
                            Requested: {lastStartResult.requestedCount}
                        </Badge>
                        <Badge variant="outline">
                            Queued: {lastStartResult.startedCount}
                        </Badge>
                        <Badge variant="outline">
                            Dispatched: {lastStartResult.dispatchedCount}
                        </Badge>
                        <Badge variant="outline">
                            Skipped: {lastStartResult.skippedCount}
                        </Badge>
                        <Badge variant="outline">
                            Dispatch Failed:{" "}
                            {lastStartResult.dispatchFailedCount}
                        </Badge>
                    </CardContent>
                </Card>
            )}

            <Dialog
                open={createDialogOpen}
                onOpenChange={onCreateDialogOpenChange}
            >
                <DialogContent className="sm:max-w-[620px]">
                    <DialogHeader>
                        <DialogTitle>Create Campaign</DialogTitle>
                        <DialogDescription>
                            Shared provider defaults are applied unless you
                            override them.
                        </DialogDescription>
                    </DialogHeader>
                    <CampaignCreateWizard
                        isCreating={isCreatingCampaign}
                        onCreate={handleCreateCampaign}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!editingCampaign}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingCampaignId(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>Edit Campaign</DialogTitle>
                        <DialogDescription>
                            Update campaign settings, windows, and provider
                            overrides.
                        </DialogDescription>
                    </DialogHeader>
                    {editingCampaign && (
                        <CampaignSettingsForm
                            campaign={editingCampaign}
                            isSaving={isSavingCampaign}
                            onSave={handleSaveCampaign}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <StartOutreachWizardModal
                campaign={wizardCampaign}
                open={!!wizardCampaign}
                isStarting={isStarting}
                onOpenChange={(open) => {
                    if (!open) {
                        setWizardCampaignId(null);
                    }
                }}
                onStart={handleStartOutreach}
            />
        </div>
    );
}
