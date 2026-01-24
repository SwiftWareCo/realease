import { defineSchema } from "convex/server";
import { eventsTable } from "./events/event.schema";
import { leadsTable } from "./leads/lead.schema";
import { usersTable } from "./users/user.schema";

export default defineSchema({
    events: eventsTable,
    leads: leadsTable,
    users: usersTable,
});
