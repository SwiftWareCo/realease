import { defineSchema } from 'convex/server';
import { leadsTable } from './leads/lead.schema';
import { eventsTable } from './events/event.schema';

export default defineSchema({
  leads: leadsTable,
  events: eventsTable,
});
