import { defineSchema } from "convex/server";
import { eventsTable } from "./events/event.schema";
import { leadsTable } from "./leads/lead.schema";
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
    outreachSmsMessagesTable,
    outreachWebhookEventsTable,
} from "./outreach/outreach.schema";

export default defineSchema({
    events: eventsTable,
    leads: leadsTable,
    users: usersTable,
    marketMetrics: marketMetricsTable,
    marketSummaries: marketSummariesTable,
    metricHistory: metricHistoryTable,
    ingestionCheckpoints: ingestionCheckpointTable,
    outreachCampaigns: outreachCampaignsTable,
    outreachCalls: outreachCallsTable,
    outreachCampaignLeadStates: outreachCampaignLeadStatesTable,
    outreachWebhookEvents: outreachWebhookEventsTable,
    outreachSmsMessages: outreachSmsMessagesTable,
});
