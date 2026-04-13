import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type CampaignsForPickerResult = FunctionReturnType<
    typeof api.outreach.queries.getCampaignsForPicker
>;

type CampaignTemplatesResult = FunctionReturnType<
    typeof api.outreach.queries.getCampaignTemplates
>;

type OutreachLeadPickerResult = FunctionReturnType<
    typeof api.outreach.queries.getOutreachLeadPicker
>;

type CampaignDashboardResult = FunctionReturnType<
    typeof api.outreach.queries.getCampaignDashboard
>;

export type CampaignCallsData = FunctionReturnType<
    typeof api.outreach.queries.getCampaignCallAttempts
>;
export type CampaignCallAttemptDetails = FunctionReturnType<
    typeof api.outreach.queries.getCampaignCallAttemptDetails
>;
export type CampaignRow = CampaignsForPickerResult[number];
export type CampaignTemplate = CampaignTemplatesResult[number];
export type PickerData = OutreachLeadPickerResult;
export type PickerLead = OutreachLeadPickerResult["leads"][number];
export type CampaignDashboardData = CampaignDashboardResult;
export type CampaignDashboardCampaign = CampaignDashboardResult["campaigns"][number];
