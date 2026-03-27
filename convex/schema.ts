import { defineSchema } from "convex/server";
import { eventsTable } from "./events/event.schema";
import { leadsTable } from "./leads/lead.schema";
import { usersTable } from "./users/user.schema";
import {
    marketInsightsTable,
    insightFetchLogTable,
} from "./insights/insight.schema";
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
    marketInsights: marketInsightsTable,
    insightFetchLog: insightFetchLogTable,
    outreachCampaigns: outreachCampaignsTable,
    outreachCalls: outreachCallsTable,
    outreachCampaignLeadStates: outreachCampaignLeadStatesTable,
    outreachWebhookEvents: outreachWebhookEventsTable,
    outreachSmsMessages: outreachSmsMessagesTable,
});
