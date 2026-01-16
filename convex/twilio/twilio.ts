"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";

export const sendInstantSMS = internalAction({
  args: {
    phone: v.string(),
    name: v.string(),
    agentName: v.string(),
    propertyAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      console.error("Twilio credentials not configured");
      return;
    }

    const addressSnippet = args.propertyAddress?.split(',')[0] || 'property';
    const message = `Hi ${args.name}, thanks for submitting! I'll pull recent comps for ${addressSnippet} and text you within 15 min. When's best for ${args.agentName} to call? - Reply STOP to unsubscribe`;

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          },
          body: new URLSearchParams({
            From: twilioPhone,
            To: args.phone,
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Twilio API error:", errorText);
      }
    } catch (error) {
      console.error("Error sending SMS:", error);
    }
  },
});
