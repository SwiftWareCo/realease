"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Mail, MapPin, Clock, FileText, Loader2 } from "lucide-react";

interface AddLeadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: "create" | "edit";
    lead?: Doc<"leads"> | null;
}

type Intent = "buyer" | "seller" | "investor";
type Status = "new" | "contacted" | "qualified";

export function AddLeadModal({
    open,
    onOpenChange,
    mode = "create",
    lead,
}: AddLeadModalProps) {
    const createLead = useMutation(api.leads.mutations.createLead);
    const updateLead = useMutation(api.leads.mutations.updateLead);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [propertyAddress, setPropertyAddress] = useState("");
    const [timeline, setTimeline] = useState("");
    const [intent, setIntent] = useState<Intent>("buyer");
    const [status, setStatus] = useState<Status>("new");
    const [source, setSource] = useState("manual");
    const [notes, setNotes] = useState("");
    const [urgencyScore, setUrgencyScore] = useState("50");

    const resetForm = () => {
        setName("");
        setPhone("");
        setEmail("");
        setPropertyAddress("");
        setTimeline("");
        setIntent("buyer");
        setStatus("new");
        setSource("manual");
        setNotes("");
        setUrgencyScore("50");
    };

    useEffect(() => {
        if (!open) return;
        if (mode === "edit" && lead) {
            setName(lead.name ?? "");
            setPhone(lead.phone ?? "");
            setEmail(lead.email ?? "");
            setPropertyAddress(lead.property_address ?? "");
            setTimeline(lead.timeline ?? "");
            setIntent(lead.intent);
            setStatus(lead.status);
            setSource(lead.source ?? "manual");
            setNotes(lead.notes ?? "");
            setUrgencyScore(String(lead.urgency_score ?? 50));
            return;
        }
        resetForm();
    }, [open, mode, lead]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !phone.trim()) {
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim() || undefined,
                property_address: propertyAddress.trim() || undefined,
                timeline: timeline.trim() || undefined,
                intent,
                status,
                source: source.trim() || "manual",
                notes: notes.trim() || undefined,
                urgency_score: Number.isFinite(Number(urgencyScore))
                    ? Math.max(0, Math.min(100, Number(urgencyScore)))
                    : undefined,
            };

            if (mode === "edit" && lead) {
                await updateLead({
                    id: lead._id,
                    ...payload,
                });
            } else {
                await createLead(payload);
            }

            resetForm();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save lead:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full max-w-[560px] overflow-y-auto p-0 sm:max-w-[560px]">
                <SheetHeader className="border-b p-6">
                    <SheetTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                        </div>
                        {mode === "edit" ? "Edit Lead" : "Add New Lead"}
                    </SheetTitle>
                    <SheetDescription>
                        {mode === "edit"
                            ? "Update the lead record and pipeline details."
                            : "Manually add a new lead to your network."}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-4 p-6">
                    {/* Name - Required */}
                    <div className="space-y-2">
                        <Label htmlFor="name" className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5" />
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Phone - Required */}
                    <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5" />
                            Phone <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="phone"
                            placeholder="(555) 123-4567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5" />
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="john@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Property Address */}
                    <div className="space-y-2">
                        <Label htmlFor="address" className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            Property Address
                        </Label>
                        <Input
                            id="address"
                            placeholder="123 Main St, City, State"
                            value={propertyAddress}
                            onChange={(e) => setPropertyAddress(e.target.value)}
                        />
                    </div>

                    {/* Timeline */}
                    <div className="space-y-2">
                        <Label htmlFor="timeline" className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" />
                            Timeline
                        </Label>
                        <Input
                            id="timeline"
                            placeholder="Looking to buy within 3 months"
                            value={timeline}
                            onChange={(e) => setTimeline(e.target.value)}
                        />
                    </div>

                    {/* Intent & Status Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Intent</Label>
                            <Select value={intent} onValueChange={(v) => setIntent(v as Intent)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="buyer">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="border-blue-300 text-blue-700">Buyer</Badge>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="seller">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="border-green-300 text-green-700">Seller</Badge>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="investor">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="border-purple-300 text-purple-700">Investor</Badge>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">
                                        <Badge className="bg-blue-500">New</Badge>
                                    </SelectItem>
                                    <SelectItem value="contacted">
                                        <Badge className="bg-yellow-500">Contacted</Badge>
                                    </SelectItem>
                                    <SelectItem value="qualified">
                                        <Badge className="bg-green-500">Qualified</Badge>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="urgencyScore">AI Score</Label>
                        <Input
                            id="urgencyScore"
                            type="number"
                            min="0"
                            max="100"
                            placeholder="50"
                            value={urgencyScore}
                            onChange={(e) => setUrgencyScore(e.target.value)}
                        />
                    </div>

                    {/* Source */}
                    <div className="space-y-2">
                        <Label htmlFor="source">Source</Label>
                        <Select value={source} onValueChange={setSource}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">Manual Entry</SelectItem>
                                <SelectItem value="referral">Referral</SelectItem>
                                <SelectItem value="open_house">Open House</SelectItem>
                                <SelectItem value="website">Website</SelectItem>
                                <SelectItem value="social_media">Social Media</SelectItem>
                                <SelectItem value="cold_call">Cold Call</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes" className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5" />
                            Notes
                        </Label>
                        <Textarea
                            id="notes"
                            placeholder="Any additional notes about this lead..."
                            value={notes}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !name.trim() || !phone.trim()}
                            className="bg-gradient-to-r from-primary to-primary/80"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    {mode === "edit"
                                        ? "Saving..."
                                        : "Creating..."}
                                </>
                            ) : (
                                mode === "edit" ? "Save Changes" : "Add Lead"
                            )}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
