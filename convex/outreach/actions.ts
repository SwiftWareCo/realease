"use node";

import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { normalizePhoneNumber } from "./phone";

type CallStatus =
    | "queued"
    | "ringing"
    | "in_progress"
    | "completed"
    | "failed"
    | "canceled";

function mapRetellStatus(status?: string): CallStatus {
    switch (status) {
        case "registered":
        case "not_connected":
            return "queued";
        case "ongoing":
            return "in_progress";
        case "ended":
            return "completed";
        case "error":
            return "failed";
        default:
            return "queued";
    }
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "Unexpected provider error";
}

type QueueOutreachResult = {
    campaignId: Id<"outreachCampaigns">;
    started: Array<{
        leadId: Id<"leads">;
        callId: Id<"outreachCalls">;
        dialToNumber: string;
    }>;
    skipped: Array<{ leadId: Id<"leads">; reason: string }>;
    startedCount: number;
    skippedCount: number;
    requestedCount: number;
};

type StartOutreachActionResult = QueueOutreachResult & {
    dispatchedCount: number;
    dispatchFailedCount: number;
    dispatchStarted: Array<{
        leadId: Id<"leads">;
        callId: Id<"outreachCalls">;
        retellCallId: string;
    }>;
    dispatchFailed: Array<{
        leadId: Id<"leads">;
        callId: Id<"outreachCalls">;
        error: string;
    }>;
};

export const startCampaignOutreach = action({
    args: {
        campaignId: v.id("outreachCampaigns"),
        leadIds: v.array(v.id("leads")),
    },
    handler: async (ctx, args): Promise<StartOutreachActionResult> => {
        const queueResult = (await ctx.runMutation(
            api.outreach.mutations.startCampaignOutreach,
            args,
        )) as QueueOutreachResult;

        const dispatchStarted: Array<{
            leadId: Id<"leads">;
            callId: Id<"outreachCalls">;
            retellCallId: string;
        }> = [];
        const dispatchFailed: Array<{
            leadId: Id<"leads">;
            callId: Id<"outreachCalls">;
            error: string;
        }> = [];

        if (queueResult.started.length === 0) {
            return {
                ...queueResult,
                dispatchedCount: 0,
                dispatchFailedCount: 0,
                dispatchStarted,
                dispatchFailed,
            };
        }

        const dispatchConfig = await ctx.runQuery(
            internal.outreach.queries.getCampaignDispatchConfig,
            { campaignId: args.campaignId },
        );
        const retellApiKey = process.env.RETELL_API_KEY?.trim();
        const configuredFromNumber =
            dispatchConfig.retellOutboundNumber?.trim() ||
            process.env.RETELL_DEFAULT_FROM_NUMBER?.trim() ||
            process.env.RETELL_DEFAULT_PHONE_NUMBER?.trim() ||
            process.env.RETELL_DEFAULT_PHONE_NUMBER_ID?.trim();
        const normalizedFromNumber = configuredFromNumber
            ? normalizePhoneNumber(configuredFromNumber)
            : null;

        if (!retellApiKey || !normalizedFromNumber) {
            const missingConfigError =
                "Missing Retell config for dispatch. Set RETELL_API_KEY and campaign/default outbound number in E.164 format.";
            for (const queuedCall of queueResult.started) {
                await ctx.runMutation(
                    internal.outreach.mutations.recordCallDispatchResult,
                    {
                        callId: queuedCall.callId,
                        error_message: missingConfigError,
                    },
                );
                dispatchFailed.push({
                    leadId: queuedCall.leadId,
                    callId: queuedCall.callId,
                    error: missingConfigError,
                });
            }

            return {
                ...queueResult,
                dispatchedCount: 0,
                dispatchFailedCount: dispatchFailed.length,
                dispatchStarted,
                dispatchFailed,
            };
        }

        for (const queuedCall of queueResult.started) {
            try {
                const response = await fetch(
                    "https://api.retellai.com/v2/create-phone-call",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${retellApiKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            from_number: normalizedFromNumber,
                            to_number: queuedCall.dialToNumber,
                            override_agent_id: dispatchConfig.retellAgentId,
                            metadata: {
                                campaign_id: String(args.campaignId),
                                lead_id: String(queuedCall.leadId),
                                outreach_call_id: String(queuedCall.callId),
                            },
                        }),
                    },
                );

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(
                        `Retell create-phone-call failed (${response.status}): ${errorBody}`,
                    );
                }

                const data = (await response.json()) as {
                    call_id?: string;
                    call_status?: string;
                };
                if (!data.call_id) {
                    throw new Error("Retell response missing call_id");
                }

                await ctx.runMutation(
                    internal.outreach.mutations.recordCallDispatchResult,
                    {
                        callId: queuedCall.callId,
                        retell_call_id: data.call_id,
                        call_status: mapRetellStatus(data.call_status),
                        error_message: null,
                    },
                );

                dispatchStarted.push({
                    leadId: queuedCall.leadId,
                    callId: queuedCall.callId,
                    retellCallId: data.call_id,
                });
            } catch (error) {
                const errorMessage = toErrorMessage(error);
                await ctx.runMutation(
                    internal.outreach.mutations.recordCallDispatchResult,
                    {
                        callId: queuedCall.callId,
                        error_message: errorMessage,
                    },
                );
                dispatchFailed.push({
                    leadId: queuedCall.leadId,
                    callId: queuedCall.callId,
                    error: errorMessage,
                });
            }
        }

        return {
            ...queueResult,
            dispatchedCount: dispatchStarted.length,
            dispatchFailedCount: dispatchFailed.length,
            dispatchStarted,
            dispatchFailed,
        };
    },
});
