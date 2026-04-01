import { defineSchema } from "convex/server";
import { eventsTable } from "./events/event.schema";
import { leadsTable } from "./leads/lead.schema";
import { usersTable } from "./users/user.schema";
import {
    newsContextItemsTable,
    newsIngestionLogTable,
} from "./insights/insight.schema";
import {
    marketMetricsTable,
    marketSummariesTable,
} from "./insights/metrics.schema";
import { metricHistoryTable } from "./insights/metricHistory.schema";
import { gvrCheckpointTable } from "./insights/gvrCheckpoint.schema";
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
    newsContextItems: newsContextItemsTable,
    newsIngestionLog: newsIngestionLogTable,
    marketMetrics: marketMetricsTable,
    marketSummaries: marketSummariesTable,
    metricHistory: metricHistoryTable,
    gvrCheckpoints: gvrCheckpointTable,
    outreachCampaigns: outreachCampaignsTable,
    outreachCalls: outreachCallsTable,
    outreachCampaignLeadStates: outreachCampaignLeadStatesTable,
    outreachWebhookEvents: outreachWebhookEventsTable,
    outreachSmsMessages: outreachSmsMessagesTable,
});
