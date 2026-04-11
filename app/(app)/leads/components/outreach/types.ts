import { api } from "@/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

type CampaignsForPickerResult = FunctionReturnType<
    typeof api.outreach.queries.getCampaignsForPicker
>;

type CampaignTemplatesResult = FunctionReturnType<
    typeof api.outreach.queries.getCampaignTemplates
>;

type OutreachLeadPickerResult = FunctionReturnType<
    typeof api.outreach.queries.getOutreachLeadPicker
>;

type LeadEnrollmentReviewResult = FunctionReturnType<
    typeof api.outreach.queries.getLeadEnrollmentReview
>;

export type CampaignCallsData = FunctionReturnType<
    typeof api.outreach.queries.getCampaignCallAttempts
>;
export type CampaignCallAttemptDetails = FunctionReturnType<
    typeof api.outreach.queries.getCampaignCallAttemptDetails
>;
export type CampaignLeadConversationDetails = FunctionReturnType<
    typeof api.outreach.queries.getCampaignLeadConversation
>;

export type StartOutreachResult = FunctionReturnType<
    typeof api.outreach.actions.startCampaignOutreach
>;

export type CreateCampaignInput = FunctionArgs<
    typeof api.outreach.mutations.createCampaign
>;

export type CampaignRow = CampaignsForPickerResult[number];
export type CampaignTemplate = CampaignTemplatesResult[number];
export type PickerData = OutreachLeadPickerResult;
export type PickerLead = OutreachLeadPickerResult["leads"][number];
export type LeadEnrollmentReview = LeadEnrollmentReviewResult;
export type CampaignRuntimeSummary = CampaignTemplate["runtimeSummary"];

export type CampaignStatus = CampaignRow["status"];
export type Weekday = CampaignRow["callingWindow"]["allowed_weekdays"][number];
export type OutcomeRoutingRule = CampaignRuntimeSummary["outcomeRouting"][number];

// UI-local, flattened edit form model that maps into updateCampaignSettings args.
export type CampaignSettingsInput = {
    name: string;
    description: string;
    status: CampaignStatus;
    startHour: number;
    endHour: number;
    allowedWeekdays: Weekday[];
    maxAttempts: number;
    cooldownMinutes: number;
    followUpSmsEnabled: boolean;
    followUpSmsDefaultTemplate: string;
    outcomeRouting: OutcomeRoutingRule[];
};
