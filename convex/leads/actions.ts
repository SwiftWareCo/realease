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
    notes: v.optional(v.string()),
    source: v.optional(v.string()), // Track SMS vs QR vs manual (e.g., "sms_link_seller_form", "qr_code_buyer")
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; leadId: Id<'leads'> }> => {
    // Determine intent from source field (which contains form type info)
    // Default to 'investor' if source doesn't indicate seller/buyer
    const source = args.source || 'unknown';
    const intent = source.includes('seller')
      ? 'seller'
      : source.includes('buyer')
      ? 'buyer'
      : 'investor';

    // Call OpenRouter AI for analysis
    let aiAnalysis;
    try {
      aiAnalysis = await ctx.runAction(internal.openrouter.analyzeLead, {
        name: args.name,
        phone: args.phone,
        email: args.email,
        property_address: args.property_address,
        timeline: args.timeline,
        intent,
        notes: args.notes,
        source,
      });
    } catch (error) {
      console.error("Error calling OpenRouter AI:", error);
      // Fallback to manual urgency calculation if AI fails
      const urgencyMap: Record<string, number> = {
        within_1_month: 90,
        '3-6_months': 60,
        just_browsing: 30,
      };
      aiAnalysis = {
        sentiment: 'neutral' as const,
        urgency_score: urgencyMap[args.timeline || ''] || 50,
        conversion_prediction: 'Within 90 days',
        ai_action: `Send recent comps for ${args.property_address?.split(',')[0] || 'property'}`,
      };
    }

    // Insert lead with AI-generated insights
    const leadId: Id<'leads'> = await ctx.runMutation(
      internal.leads.mutations.insertLead,
      {
        name: args.name,
        phone: args.phone,
        email: args.email,
        property_address: args.property_address,
        timeline: args.timeline,
        intent,
        source,
        urgency_score: aiAnalysis.urgency_score,
        ai_suggestion: aiAnalysis.ai_action,
        notes: args.notes,
        conversion_prediction: aiAnalysis.conversion_prediction,
        last_message_sentiment: aiAnalysis.sentiment,
        last_message_content: undefined,
        message_count: 0,
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
