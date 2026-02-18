import { api } from "@/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

type CampaignsForPickerResult = FunctionReturnType<
    typeof api.outreach.queries.getCampaignsForPicker
>;

type CampaignLeadPickerResult = FunctionReturnType<
    typeof api.outreach.queries.getCampaignLeadPicker
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
export type PickerData = CampaignLeadPickerResult;
export type PickerLead = CampaignLeadPickerResult["leads"][number];

export type CampaignStatus = CampaignRow["status"];
export type Weekday = CampaignRow["callingWindow"]["allowed_weekdays"][number];

// UI-local, flattened edit form model that maps into updateCampaignSettings args.
export type CampaignSettingsInput = {
    name: string;
    description: string;
    status: CampaignStatus;
    timezone: string;
    startHour: number;
    endHour: number;
    allowedWeekdays: Weekday[];
    maxAttempts: number;
    cooldownMinutes: number;
    followUpSmsEnabled: boolean;
    followUpSmsDefaultTemplate: string;
};
