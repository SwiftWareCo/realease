import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isValidPhoneNumber } from "./phone";
import type { OutreachCampaignTemplateKey } from "./templates";
import { getOutreachCampaignTemplate } from "./templates";

type DataCtx = QueryCtx | MutationCtx;

const TERMINAL_STATES: ReadonlySet<Doc<"outreachCampaignLeadStates">["state"]> =
    new Set(["done", "terminal_blocked"]);

export type LeadEligibilityReason =
    | "invalid_phone"
    | "do_not_call"
    | "status_not_eligible"
    | "active_call_in_progress"
    | "max_attempts_reached"
    | "blocked_by_terminal_outcome"
    | "in_other_active_campaign"
    | "already_in_this_campaign"
    | "template_mismatch"
    | "lead_not_found";

export type LeadEligibilityClassification =
    | "eligible"
    | "conflict"
    | "ineligible";

export type LeadEnrollmentReviewRecord = {
    leadId: Id<"leads">;
    name: string;
    phone: string;
    status: Doc<"leads">["status"];
    leadType: Doc<"leads">["lead_type"] | null;
    intent: Doc<"leads">["intent"];
    selectable: boolean;
    classification: LeadEligibilityClassification;
    reasons: LeadEligibilityReason[];
    attemptsInCampaign: number;
    latestCampaignOutcome: Doc<"outreachCalls">["outcome"] | null;
    conflictCampaignId: Id<"outreachCampaigns"> | null;
    conflictCampaignName: string | null;
};

type CampaignValidationContext = {
    campaignId: Id<"outreachCampaigns"> | null;
    maxAttempts: number;
    templateKey: OutreachCampaignTemplateKey | null;
};

function resolveTemplateMismatch(
    lead: Doc<"leads">,
    templateKey: OutreachCampaignTemplateKey | null,
): boolean {
    if (!templateKey) {
        return false;
    }

    const template = getOutreachCampaignTemplate(templateKey);
    const leadAudience = lead.lead_type ?? lead.intent;
    return leadAudience !== template.recommendedLeadType;
}

async function getCurrentCampaignStats(
    ctx: DataCtx,
    campaignId: Id<"outreachCampaigns"> | null,
    leadId: Id<"leads">,
): Promise<{
    attemptsInCampaign: number;
    hasActiveCall: boolean;
    latestOutcome: Doc<"outreachCalls">["outcome"] | null;
    alreadyInCampaign: boolean;
}> {
    if (!campaignId) {
        return {
            attemptsInCampaign: 0,
            hasActiveCall: false,
            latestOutcome: null,
            alreadyInCampaign: false,
        };
    }

    const stateRow = await ctx.db
        .query("outreachCampaignLeadStates")
        .withIndex("by_campaign_id_and_lead_id", (q) =>
            q.eq("campaign_id", campaignId).eq("lead_id", leadId),
        )
        .unique();

    if (!stateRow) {
        return {
            attemptsInCampaign: 0,
            hasActiveCall: false,
            latestOutcome: null,
            alreadyInCampaign: false,
        };
    }

    return {
        attemptsInCampaign: stateRow.attempts_in_campaign,
        hasActiveCall:
            stateRow.state === "queued" || stateRow.state === "in_progress",
        latestOutcome: stateRow.last_outcome ?? null,
        alreadyInCampaign: !TERMINAL_STATES.has(stateRow.state),
    };
}

async function findOtherActiveCampaignConflict(
    ctx: DataCtx,
    campaignId: Id<"outreachCampaigns"> | null,
    leadId: Id<"leads">,
): Promise<{
    campaignId: Id<"outreachCampaigns">;
    campaignName: string;
} | null> {
    const stateRows = await ctx.db
        .query("outreachCampaignLeadStates")
        .withIndex("by_lead_id", (q) => q.eq("lead_id", leadId))
        .take(20);

    for (const row of stateRows) {
        if (
            (campaignId !== null && row.campaign_id === campaignId) ||
            TERMINAL_STATES.has(row.state)
        ) {
            continue;
        }

        const otherCampaign = await ctx.db.get(row.campaign_id);
        if (otherCampaign?.status !== "active") {
            continue;
        }

        return {
            campaignId: otherCampaign._id,
            campaignName: otherCampaign.name,
        };
    }

    return null;
}

export async function buildLeadEnrollmentReviewRecord(
    ctx: DataCtx,
    validationContext: CampaignValidationContext,
    lead: Doc<"leads">,
): Promise<LeadEnrollmentReviewRecord> {
    const currentCampaignStats = await getCurrentCampaignStats(
        ctx,
        validationContext.campaignId,
        lead._id,
    );
    const activeCampaignConflict = currentCampaignStats.alreadyInCampaign
        ? null
        : await findOtherActiveCampaignConflict(
              ctx,
              validationContext.campaignId,
              lead._id,
          );

    const reasons: LeadEligibilityReason[] = [];

    if (!isValidPhoneNumber(lead.phone)) {
        reasons.push("invalid_phone");
    }
    if (lead.do_not_call === true) {
        reasons.push("do_not_call");
    }
    if (lead.status !== "new" && lead.status !== "contacted") {
        reasons.push("status_not_eligible");
    }
    if (currentCampaignStats.hasActiveCall) {
        reasons.push("active_call_in_progress");
    }
    if (
        currentCampaignStats.latestOutcome === "do_not_call" ||
        currentCampaignStats.latestOutcome === "wrong_number"
    ) {
        reasons.push("blocked_by_terminal_outcome");
    }
    if (
        currentCampaignStats.attemptsInCampaign >=
        validationContext.maxAttempts
    ) {
        reasons.push("max_attempts_reached");
    }
    if (currentCampaignStats.alreadyInCampaign) {
        reasons.push("already_in_this_campaign");
    }
    if (activeCampaignConflict) {
        reasons.push("in_other_active_campaign");
    }
    if (resolveTemplateMismatch(lead, validationContext.templateKey)) {
        reasons.push("template_mismatch");
    }

    const classification: LeadEligibilityClassification = reasons.includes(
        "in_other_active_campaign",
    )
        ? "conflict"
        : reasons.length === 0
          ? "eligible"
          : "ineligible";

    return {
        leadId: lead._id,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        leadType: lead.lead_type ?? null,
        intent: lead.intent,
        selectable: reasons.length === 0,
        classification,
        reasons,
        attemptsInCampaign: currentCampaignStats.attemptsInCampaign,
        latestCampaignOutcome: currentCampaignStats.latestOutcome,
        conflictCampaignId: activeCampaignConflict?.campaignId ?? null,
        conflictCampaignName: activeCampaignConflict?.campaignName ?? null,
    };
}

export function summarizeLeadEnrollmentReview(
    leads: LeadEnrollmentReviewRecord[],
): {
    eligibleCount: number;
    conflictCount: number;
    ineligibleCount: number;
} {
    return {
        eligibleCount: leads.filter((lead) => lead.classification === "eligible")
            .length,
        conflictCount: leads.filter((lead) => lead.classification === "conflict")
            .length,
        ineligibleCount: leads.filter((lead) => lead.classification === "ineligible")
            .length,
    };
}
