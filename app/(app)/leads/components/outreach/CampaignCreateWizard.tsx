"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    const [status, setStatus] = useState<"active" | "draft">("active");
    const [timezone, setTimezone] = useState("");
    const [retellAgentId, setRetellAgentId] = useState("");
    const [retellPhoneNumberId, setRetellPhoneNumberId] = useState("");
    const [twilioMessagingServiceSid, setTwilioMessagingServiceSid] =
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
            status,
            timezone: timezone.trim() || undefined,
            retell_agent_id: retellAgentId.trim() || undefined,
            retell_phone_number_id: retellPhoneNumberId.trim() || undefined,
            twilio_messaging_service_sid:
                twilioMessagingServiceSid.trim() || undefined,
        });

        setStep(1);
        setName("");
        setDescription("");
        setStatus("active");
        setTimezone("");
        setRetellAgentId("");
        setRetellPhoneNumberId("");
        setTwilioMessagingServiceSid("");
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
                    label="Providers"
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
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Select
                            value={status}
                            onValueChange={(value) =>
                                setStatus(value as "active" | "draft")
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Initial status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Timezone override (optional)"
                            value={timezone}
                            onChange={(event) =>
                                setTimezone(event.target.value)
                            }
                        />
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                        Optional overrides. Leave blank to use shared defaults
                        from environment variables.
                    </p>
                    <Input
                        placeholder="Retell agent ID override (optional)"
                        value={retellAgentId}
                        onChange={(event) =>
                            setRetellAgentId(event.target.value)
                        }
                    />
                    <Input
                        placeholder="Retell outbound number override (E.164, optional)"
                        value={retellPhoneNumberId}
                        onChange={(event) =>
                            setRetellPhoneNumberId(event.target.value)
                        }
                    />
                    <Input
                        placeholder="Twilio messaging service SID override (optional)"
                        value={twilioMessagingServiceSid}
                        onChange={(event) =>
                            setTwilioMessagingServiceSid(event.target.value)
                        }
                    />
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
