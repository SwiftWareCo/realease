"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const INTEREST_OPTIONS = [
    {
        id: "home_prices",
        label: "Home Prices",
        description: "Show benchmark price trend modules and pricing context.",
    },
    {
        id: "inventory",
        label: "Inventory Levels",
        description: "Show listings/sales supply modules and absorption context.",
    },
    {
        id: "mortgage_rates",
        label: "Mortgage Rates",
        description: "Show rate trend modules tied to borrowing costs.",
    },
    {
        id: "market_trend",
        label: "Market Trends",
        description:
            "Show the Market Sentiment + Actionable Intel module for strategic context.",
    },
] as const;

type InterestOptionId = (typeof INTEREST_OPTIONS)[number]["id"];

interface InsightsSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function sameInterests(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const left = [...a].sort();
    const right = [...b].sort();
    return left.every((value, index) => value === right[index]);
}

export function InsightsSettingsDialog({
    open,
    onOpenChange,
}: InsightsSettingsDialogProps) {
    const preferences = useQuery(api.insights.queries.getUserPreferences);
    const updateInterests = useMutation(api.users.mutations.updateInterests);

    const [selectedInterests, setSelectedInterests] = useState<
        InterestOptionId[]
    >([]);
    const [isSaving, setIsSaving] = useState(false);

    const persistedInterests = useMemo(
        () => (preferences?.interests ?? []) as InterestOptionId[],
        [preferences?.interests],
    );

    useEffect(() => {
        if (!open) return;
        setSelectedInterests(persistedInterests);
    }, [open, persistedInterests]);

    const hasChanges = !sameInterests(selectedInterests, persistedInterests);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateInterests({ interests: selectedInterests });
            toast.success("Market preferences saved");
            onOpenChange(false);
        } catch {
            toast.error("Failed to save market preferences");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setSelectedInterests(persistedInterests);
        onOpenChange(false);
    };

    const toggleInterest = (interestId: InterestOptionId, checked: boolean) => {
        if (checked) {
            setSelectedInterests((current) =>
                Array.from(new Set([...current, interestId])),
            );
            return;
        }
        setSelectedInterests((current) =>
            current.filter((interest) => interest !== interestId),
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Market Preferences</DialogTitle>
                    <DialogDescription>
                        Choose which modules appear on your Market Insights page.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    {preferences === undefined ? (
                        <DialogLoading />
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Building2 className="h-4 w-4 text-primary" />
                                Interest Focus
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {INTEREST_OPTIONS.map((interest) => {
                                    const checked =
                                        selectedInterests.includes(interest.id);
                                    return (
                                        <label
                                            key={interest.id}
                                            htmlFor={interest.id}
                                            className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                                                checked
                                                    ? "border-primary/60 bg-primary/5"
                                                    : "border-border hover:border-primary/30"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    id={interest.id}
                                                    checked={checked}
                                                    onCheckedChange={(value) =>
                                                        toggleInterest(
                                                            interest.id,
                                                            value === true,
                                                        )
                                                    }
                                                />
                                                <div className="space-y-1">
                                                    <Label
                                                        htmlFor={interest.id}
                                                        className="cursor-pointer text-sm font-medium"
                                                    >
                                                        {interest.label}
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {interest.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Region selection now saves directly from the top
                                multi-select on the Insights page.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 flex-col sm:flex-row sm:justify-between">
                    <p className="text-xs text-muted-foreground sm:mr-auto">
                        {selectedInterests.length > 0
                            ? `${selectedInterests.length} topic${selectedInterests.length === 1 ? "" : "s"} selected`
                            : "No topics selected. Modules are hidden until a topic is selected."}
                    </p>
                    <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || preferences === undefined || !hasChanges}
                        >
                            {isSaving ? "Saving..." : "Save Preferences"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DialogLoading() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-lg border p-3 space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                    </div>
                ))}
            </div>
        </div>
    );
}
