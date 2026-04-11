"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WizardStep } from "./constants";
import type { CampaignTemplate, CreateCampaignInput } from "./types";

export function CampaignCreateWizard({
    templates,
    isCreating,
    onCreate,
}: {
    templates: CampaignTemplate[];
    isCreating: boolean;
    onCreate: (input: CreateCampaignInput) => Promise<void>;
}) {
    const [step, setStep] = useState<"template" | "details">("template");
    const [selectedTemplateKey, setSelectedTemplateKey] = useState<
        CampaignTemplate["key"] | null
    >(templates[0]?.key ?? null);
    const [name, setName] = useState(templates[0]?.defaultName ?? "");
    const [description, setDescription] = useState("");

    const selectedTemplate = useMemo(
        () =>
            templates.find((template) => template.key === selectedTemplateKey) ??
            null,
        [selectedTemplateKey, templates],
    );

    const handleCreate = async () => {
        if (!selectedTemplate) {
            toast.error("Select a campaign template.");
            return;
        }
        if (!name.trim()) {
            toast.error("Campaign name is required.");
            return;
        }
        await onCreate({
            name: name.trim(),
            description: description.trim() || undefined,
            template_key: selectedTemplate.key,
            template_version: selectedTemplate.version,
        });
        setStep("template");
        setSelectedTemplateKey(templates[0]?.key ?? null);
        setName(templates[0]?.defaultName ?? "");
        setDescription("");
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <WizardStep
                    active={step === "template"}
                    done={step === "details"}
                    label="Template"
                />
                <WizardStep
                    active={step === "details"}
                    done={false}
                    label="Details"
                />
            </div>

            {step === "template" && (
                <div className="grid gap-3 md:grid-cols-2">
                    {templates.map((template) => {
                        const selected = template.key === selectedTemplateKey;
                        return (
                            <button
                                key={template.key}
                                type="button"
                                onClick={() => {
                                    setSelectedTemplateKey(template.key);
                                    setName(template.defaultName);
                                }}
                                className={`rounded-xl border p-4 text-left transition-colors ${
                                    selected
                                        ? "border-primary bg-primary/5"
                                        : "hover:border-primary/40 hover:bg-muted/30"
                                }`}
                            >
                                <p className="text-base font-semibold">{template.label}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Template v{template.version}
                                </p>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    {template.description}
                                </p>
                            </button>
                        );
                    })}
                </div>
            )}

            {step === "details" && (
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
                        rows={3}
                    />
                    {selectedTemplate && (
                        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            This campaign will start with the {selectedTemplate.label.toLowerCase()} defaults. Safe settings can be adjusted after creation.
                        </p>
                    )}
                </div>
            )}

            <div className="flex justify-end gap-2">
                {step === "details" && (
                    <Button variant="outline" onClick={() => setStep("template")}>
                        Back
                    </Button>
                )}
                {step === "template" ? (
                    <Button
                        onClick={() => setStep("details")}
                        disabled={!selectedTemplate}
                    >
                        Next
                    </Button>
                ) : (
                    <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
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
