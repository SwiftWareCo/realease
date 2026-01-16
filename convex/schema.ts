import { defineSchema } from 'convex/server';
import { leadsTable } from './leads/lead.schema';

export default defineSchema({
  leads: leadsTable,
});
