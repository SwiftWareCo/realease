import { action } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';

export const submitLeadForm = action({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    property_address: v.optional(v.string()),
    timeline: v.optional(v.string()),
    form_id: v.string(),
    source: v.optional(v.string()), // Track SMS vs QR vs manual
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; leadId: Id<'leads'> }> => {
    // Calculate urgency
    const urgencyMap: Record<string, number> = {
      within_1_month: 90,
      '3-6_months': 60,
      just_browsing: 30,
    };
    const urgency_score = urgencyMap[args.timeline || ''] || 50;

    // Determine intent
    const intent = args.form_id.includes('seller')
      ? 'seller'
      : args.form_id.includes('buyer')
      ? 'buyer'
      : 'investor';

    // Insert lead
    const leadId: Id<'leads'> = await ctx.runMutation(
      internal.leads.mutations.insertLead,
      {
        name: args.name,
        phone: args.phone,
        email: args.email,
        property_address: args.property_address,
        timeline: args.timeline,
        intent,
        source: args.source || `form_${args.form_id}`,
        urgency_score,
        ai_suggestion: `Send recent comps for ${
          args.property_address?.split(',')[0] || 'property'
        }`,
      }
    );

    // Trigger SMS response after 5 second delay (feels more natural)
    await ctx.scheduler.runAfter(5000, internal.twilio.twilio.sendInstantSMS, {
      phone: args.phone,
      name: args.name,
      agentName: 'Mike',
      propertyAddress: args.property_address,
    });

    return { success: true, leadId };
  },
});
