"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    const [deleteCampaignId, setDeleteCampaignId] =
        useState<Id<"outreachCampaigns"> | null>(null);

    const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
    const [isSavingCampaign, setIsSavingCampaign] = useState(false);
    const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);
    const [isTogglingOutreach, setIsTogglingOutreach] = useState(false);
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
    const deleteCampaign = useMutation(api.outreach.mutations.deleteCampaign);
    const startOutreach = useAction(api.outreach.actions.startCampaignOutreach);

    const editingCampaign =
        campaigns?.find((campaign) => campaign._id === editingCampaignId) ??
        null;
    const wizardCampaign =
        campaigns?.find((campaign) => campaign._id === wizardCampaignId) ??
        null;
    const campaignPendingDelete =
        campaigns?.find((campaign) => campaign._id === deleteCampaignId) ??
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
                follow_up_sms: {
                    enabled: input.followUpSmsEnabled,
                    delay_minutes: 3,
                    default_template:
                        input.followUpSmsDefaultTemplate.trim() || undefined,
                    send_only_on_outcomes: input.followUpSmsEnabled
                        ? ["no_answer", "voicemail_left"]
                        : [],
                },
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

            if (result.enrolledCount > 0) {
                toast.success(
                    `Enrolled ${result.enrolledCount} leads in campaign.`,
                );
            }
            if (result.skippedCount > 0) {
                toast.warning(`Skipped ${result.skippedCount} leads.`);
            }

            if (result.enrolledCount > 0) {
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

    const handleCampaignPrimaryAction = async (campaign: CampaignRow) => {
        if (campaign.hasCallHistory && campaign.status === "active") {
            setIsTogglingOutreach(true);
            try {
                await updateCampaign({
                    campaignId: campaign._id,
                    status: "paused",
                });
                toast.success(`Outreach stopped for "${campaign.name}".`);
            } catch (error) {
                console.error("Failed to stop outreach", error);
                toast.error("Failed to stop outreach.");
            } finally {
                setIsTogglingOutreach(false);
            }
            return;
        }

        if (campaign.hasCallHistory && campaign.status === "paused") {
            setIsTogglingOutreach(true);
            try {
                await updateCampaign({
                    campaignId: campaign._id,
                    status: "active",
                });
                toast.success(`Outreach resumed for "${campaign.name}".`);
            } catch (error) {
                console.error("Failed to resume outreach", error);
                toast.error("Failed to resume outreach.");
            } finally {
                setIsTogglingOutreach(false);
            }
            return;
        }

        setWizardCampaignId(campaign._id);
    };

    const handleDeleteCampaign = (campaign: CampaignRow) => {
        setDeleteCampaignId(campaign._id);
    };

    const getCampaignActionErrorMessage = (error: unknown): string => {
        if (!(error instanceof Error)) {
            return "Failed to update campaign.";
        }

        if (
            error.message.includes(
                "Cannot delete campaign with call history. Archive it instead.",
            )
        ) {
            return "This campaign has call history and cannot be deleted. Archive it instead.";
        }

        return error.message || "Failed to update campaign.";
    };

    const handleConfirmDeleteCampaign = async () => {
        if (!campaignPendingDelete || isDeletingCampaign) {
            return;
        }

        const targetCampaign = campaignPendingDelete;
        const shouldArchive = targetCampaign.hasCallHistory;
        setIsDeletingCampaign(true);
        try {
            await toast.promise(
                shouldArchive
                    ? updateCampaign({
                          campaignId: targetCampaign._id,
                          status: "archived",
                      })
                    : deleteCampaign({ campaignId: targetCampaign._id }),
                {
                    loading: shouldArchive
                        ? `Archiving "${targetCampaign.name}"...`
                        : `Deleting "${targetCampaign.name}"...`,
                    success: shouldArchive
                        ? `Campaign "${targetCampaign.name}" archived.`
                        : `Campaign "${targetCampaign.name}" deleted.`,
                    error: getCampaignActionErrorMessage,
                },
            );

            if (editingCampaignId === targetCampaign._id) {
                setEditingCampaignId(null);
            }
            if (wizardCampaignId === targetCampaign._id) {
                setWizardCampaignId(null);
            }
            setDeleteCampaignId(null);
        } catch (error) {
            console.error("Failed to delete campaign", error);
        } finally {
            setIsDeletingCampaign(false);
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
                onOpenCampaign={(campaign) =>
                    router.push(`/leads/outreach/${campaign._id}`)
                }
                onEditCampaign={(campaign) =>
                    setEditingCampaignId(campaign._id)
                }
                onStartOutreach={handleCampaignPrimaryAction}
                onDeleteCampaign={handleDeleteCampaign}
                isDeletingCampaign={isDeletingCampaign || isTogglingOutreach}
            />

            <AlertDialog
                open={deleteCampaignId !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeletingCampaign) {
                        setDeleteCampaignId(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {campaignPendingDelete?.hasCallHistory
                                ? "Archive Campaign?"
                                : "Delete Campaign?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {campaignPendingDelete
                                ? campaignPendingDelete.hasCallHistory
                                    ? `Archive "${campaignPendingDelete.name}"? It has call history and will be hidden from active views.`
                                    : `Delete "${campaignPendingDelete.name}" permanently? This cannot be undone.`
                                : "Are you sure?"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingCampaign}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDeleteCampaign}
                            disabled={isDeletingCampaign}
                            className={
                                campaignPendingDelete?.hasCallHistory
                                    ? undefined
                                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            }
                        >
                            {isDeletingCampaign
                                ? campaignPendingDelete?.hasCallHistory
                                    ? "Archiving..."
                                    : "Deleting..."
                                : campaignPendingDelete?.hasCallHistory
                                  ? "Archive"
                                  : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {lastStartResult && (
                <Card>
                    <CardContent className="flex flex-wrap items-center gap-2 pt-4 text-sm">
                        <Badge variant="outline">
                            Requested: {lastStartResult.requestedCount}
                        </Badge>
                        <Badge variant="outline">
                            Enrolled: {lastStartResult.enrolledCount}
                        </Badge>
                        <Badge variant="outline">
                            Skipped: {lastStartResult.skippedCount}
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
                            Provider defaults come from environment config. You
                            only set campaign behavior here.
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
                            Update calling windows, retry policy, and follow-up
                            SMS behavior.
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
