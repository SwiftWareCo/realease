import { defineSchema } from "convex/server";
import { eventsTable } from "./events/event.schema";
import { leadNotesTable, leadsTable } from "./leads/lead.schema";
import { usersTable } from "./users/user.schema";
import {
    marketMetricsTable,
    marketSummariesTable,
} from "./insights/metrics.schema";
import { metricHistoryTable } from "./insights/metricHistory.schema";
import { ingestionCheckpointTable } from "./insights/ingestionCheckpoint.schema";
import {
    outreachCampaignsTable,
    outreachCallsTable,
    outreachCampaignLeadStatesTable,
    outreachCampaignTemplatesTable,
    outreachSmsMessagesTable,
    outreachWebhookEventsTable,
} from "./outreach/outreach.schema";

export default defineSchema({
    events: eventsTable,
    leads: leadsTable,
    leadNotes: leadNotesTable,
    users: usersTable,
    marketMetrics: marketMetricsTable,
    marketSummaries: marketSummariesTable,
    metricHistory: metricHistoryTable,
    ingestionCheckpoints: ingestionCheckpointTable,
    outreachCampaigns: outreachCampaignsTable,
    outreachCampaignTemplates: outreachCampaignTemplatesTable,
    outreachCalls: outreachCallsTable,
    outreachCampaignLeadStates: outreachCampaignLeadStatesTable,
    outreachWebhookEvents: outreachWebhookEventsTable,
    outreachSmsMessages: outreachSmsMessagesTable,
});
