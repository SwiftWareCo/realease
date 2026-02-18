"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WizardStep } from "./constants";
import type { CreateCampaignInput } from "./types";

export function CampaignCreateWizard({
    isCreating,
    onCreate,
}: {
    isCreating: boolean;
    onCreate: (input: CreateCampaignInput) => Promise<void>;
}) {
    const [step, setStep] = useState<1 | 2>(1);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [followUpSmsEnabled, setFollowUpSmsEnabled] = useState(true);
    const [followUpSmsDefaultTemplate, setFollowUpSmsDefaultTemplate] =
        useState("");

    const canContinue = name.trim().length > 0;

    const handleCreate = async () => {
        if (!name.trim()) {
            toast.error("Campaign name is required.");
            return;
        }
        await onCreate({
            name: name.trim(),
            description: description.trim() || undefined,
            follow_up_sms: {
                enabled: followUpSmsEnabled,
                delay_minutes: 3,
                default_template:
                    followUpSmsDefaultTemplate.trim() || undefined,
                send_only_on_outcomes: followUpSmsEnabled ? ["no_answer"] : [],
            },
        });

        setStep(1);
        setName("");
        setDescription("");
        setFollowUpSmsEnabled(true);
        setFollowUpSmsDefaultTemplate("");
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <WizardStep
                    active={step === 1}
                    done={step > 1}
                    label="Basics"
                />
                <WizardStep
                    active={step === 2}
                    done={false}
                    label="Follow-up SMS"
                />
            </div>

            {step === 1 && (
                <div className="space-y-3">
                    <Input
                        placeholder="Campaign name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                    <Textarea
                        placeholder="Description (optional)"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={2}
                    />
                </div>
            )}

            {step === 2 && (
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                        <div className="space-y-1">
                            <Label
                                htmlFor="create-follow-up-sms-enabled"
                                className="text-sm font-medium"
                            >
                                Enable follow-up SMS
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Sends only after 3 no-answer attempts in this
                                campaign.
                            </p>
                        </div>
                        <Checkbox
                            id="create-follow-up-sms-enabled"
                            checked={followUpSmsEnabled}
                            onCheckedChange={(checked) =>
                                setFollowUpSmsEnabled(checked === true)
                            }
                        />
                    </div>
                    <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        Follow-up SMS sends 3 minutes after final call outcome.
                    </p>
                    <div className="space-y-2">
                        <Label
                            htmlFor="create-follow-up-sms-template"
                            className="text-xs text-muted-foreground"
                        >
                            Default SMS template
                        </Label>
                        <Textarea
                            id="create-follow-up-sms-template"
                            rows={3}
                            value={followUpSmsDefaultTemplate}
                            onChange={(event) =>
                                setFollowUpSmsDefaultTemplate(
                                    event.target.value,
                                )
                            }
                            disabled={!followUpSmsEnabled}
                            placeholder="Hi {{lead_name}}, sorry we missed you. This is {{campaign_name}}. Reply STOP to opt out."
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Variables: {`{{lead_name}}`}, {`{{campaign_name}}`},{" "}
                            {`{{outcome}}`}, {`{{call_summary}}`}.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2">
                {step === 2 && (
                    <Button variant="outline" onClick={() => setStep(1)}>
                        Back
                    </Button>
                )}
                {step === 1 ? (
                    <Button onClick={() => setStep(2)} disabled={!canContinue}>
                        Next
                    </Button>
                ) : (
                    <Button
                        onClick={handleCreate}
                        disabled={isCreating || !canContinue}
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Create Campaign"
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}
