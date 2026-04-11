"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { CampaignSettingsForm } from "./outreach/CampaignSettingsForm";
import { CampaignsTable } from "./outreach/CampaignsTable";
import { StartOutreachWizardModal } from "./outreach/StartOutreachWizardModal";
import type {
    CampaignRow,
    CampaignSettingsInput,
    CampaignTemplate,
    StartOutreachResult,
} from "./outreach/types";

export function OutreachLeadPicker({
    startDialogOpen,
    onStartDialogOpenChange,
}: {
    startDialogOpen: boolean;
    onStartDialogOpenChange: (open: boolean) => void;
}) {
    const router = useRouter();
    const [editingCampaignId, setEditingCampaignId] = useState<
        Id<"outreachCampaigns"> | null
    >(null);
    const [deleteCampaignId, setDeleteCampaignId] = useState<
        Id<"outreachCampaigns"> | null
    >(null);
    const [isSavingCampaign, setIsSavingCampaign] = useState(false);
    const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);
    const [isUpdatingCampaignStatus, setIsUpdatingCampaignStatus] =
        useState(false);
    const [isSubmittingOutreach, setIsSubmittingOutreach] = useState(false);

    const campaignsRaw = useQuery(api.outreach.queries.getCampaignsForPicker, {
        includeInactive: false,
    });
    const campaigns = campaignsRaw as CampaignRow[] | undefined;

    const templatesRaw = useQuery(api.outreach.queries.getCampaignTemplates, {});
    const templates = templatesRaw as CampaignTemplate[] | undefined;

    const updateCampaign = useMutation(
        api.outreach.mutations.updateCampaignSettings,
    );
    const deleteCampaign = useMutation(api.outreach.mutations.deleteCampaign);
    const startOutreach = useAction(api.outreach.actions.startCampaignOutreach);

    const editingCampaign =
        campaigns?.find((campaign) => campaign._id === editingCampaignId) ?? null;
    const campaignPendingDelete =
        campaigns?.find((campaign) => campaign._id === deleteCampaignId) ?? null;

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
                outcome_routing: input.outcomeRouting.map((rule) => ({
                    outcome: rule.outcome,
                    ...(rule.nextLeadStatus
                        ? { next_lead_status: rule.nextLeadStatus }
                        : {}),
                    ...(rule.nextBuyerPipelineStage
                        ? {
                              next_buyer_pipeline_stage:
                                  rule.nextBuyerPipelineStage,
                          }
                        : {}),
                    ...(rule.nextSellerPipelineStage
                        ? {
                              next_seller_pipeline_stage:
                                  rule.nextSellerPipelineStage,
                          }
                        : {}),
                    ...(rule.sendFollowUpSms !== null
                        ? { send_follow_up_sms: rule.sendFollowUpSms }
                        : {}),
                    ...(rule.customSmsTemplate?.trim()
                        ? { custom_sms_template: rule.customSmsTemplate.trim() }
                        : {}),
                    ...(rule.campaignLeadAction
                        ? { campaign_lead_action: rule.campaignLeadAction }
                        : {}),
                })),
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

    const handleSubmitOutreach = async (input: {
        templateKey?: CampaignTemplate["key"];
        customTemplateId?: Id<"outreachCampaignTemplates">;
        campaignId?: Id<"outreachCampaigns">;
        campaignName?: string;
        leadIds: Id<"leads">[];
    }) => {
        setIsSubmittingOutreach(true);
        try {
            const result = (await startOutreach(input)) as StartOutreachResult;
            if (result.enrolledCount > 0) {
                if (result.review.target.dispatchMode === "next_window") {
                    toast.success(
                        `Enrolled ${result.enrolledCount} leads. Calls are queued for the next valid window.`,
                    );
                } else {
                    toast.success(
                        `Enrolled ${result.enrolledCount} leads and scheduled outreach.`,
                    );
                }
            }
            if (result.skippedCount > 0) {
                toast.warning(`${result.skippedCount} selected leads were skipped.`);
            }
            if (result.campaignId) {
                router.push(`/leads/outreach/${result.campaignId}`);
            }
            onStartDialogOpenChange(false);
        } catch (error) {
            console.error("Failed to start outreach", error);
            toast.error("Failed to enroll and schedule outreach.");
        } finally {
            setIsSubmittingOutreach(false);
        }
    };

    const handleToggleCampaignStatus = async (campaign: CampaignRow) => {
        const nextStatus = campaign.status === "active" ? "paused" : "active";
        setIsUpdatingCampaignStatus(true);
        try {
            await updateCampaign({
                campaignId: campaign._id,
                status: nextStatus,
            });
            toast.success(
                nextStatus === "active"
                    ? `Campaign "${campaign.name}" resumed.`
                    : `Campaign "${campaign.name}" paused.`,
            );
        } catch (error) {
            console.error("Failed to update campaign status", error);
            toast.error("Failed to update campaign status.");
        } finally {
            setIsUpdatingCampaignStatus(false);
        }
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

        setIsDeletingCampaign(true);
        try {
            const shouldArchive = campaignPendingDelete.hasCallHistory;
            await toast.promise(
                shouldArchive
                    ? updateCampaign({
                          campaignId: campaignPendingDelete._id,
                          status: "archived",
                      })
                    : deleteCampaign({ campaignId: campaignPendingDelete._id }),
                {
                    loading: shouldArchive
                        ? `Archiving "${campaignPendingDelete.name}"...`
                        : `Deleting "${campaignPendingDelete.name}"...`,
                    success: shouldArchive
                        ? `Campaign "${campaignPendingDelete.name}" archived.`
                        : `Campaign "${campaignPendingDelete.name}" deleted.`,
                    error: getCampaignActionErrorMessage,
                },
            );
            setDeleteCampaignId(null);
        } catch (error) {
            console.error("Failed to delete campaign", error);
        } finally {
            setIsDeletingCampaign(false);
        }
    };

    if (campaigns === undefined || templates === undefined) {
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
                onEditCampaign={(campaign) => setEditingCampaignId(campaign._id)}
                onToggleCampaignStatus={handleToggleCampaignStatus}
                onDeleteCampaign={(campaign) => setDeleteCampaignId(campaign._id)}
                isDeletingCampaign={isDeletingCampaign || isUpdatingCampaignStatus}
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

            <Dialog
                open={!!editingCampaign}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingCampaignId(null);
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[980px]">
                    <DialogHeader>
                        <DialogTitle>Edit Campaign</DialogTitle>
                        <DialogDescription>
                            Update calling windows, retry policy, and follow-up
                            SMS behavior.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[calc(90vh-8rem)] overflow-y-auto pr-2">
                        {editingCampaign && (
                            <CampaignSettingsForm
                                campaign={editingCampaign}
                                isSaving={isSavingCampaign}
                                onSave={handleSaveCampaign}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <StartOutreachWizardModal
                campaigns={campaigns}
                templates={templates}
                open={startDialogOpen}
                isSubmitting={isSubmittingOutreach}
                onOpenChange={onStartDialogOpenChange}
                onSubmit={handleSubmitOutreach}
            />
        </div>
    );
}
