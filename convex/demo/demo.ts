"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

export const sendDemoSMS = action({
  args: {
    phone: v.string(),
    link: v.string(),
    formId: v.string(),
  },
  handler: async (ctx, args) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      throw new Error("Twilio credentials not configured");
    }

    const scenarioMap: Record<string, string> = {
      "open_house_demo": "Open House",
      "google_business_demo": "Google Business",
      "buyer_guide_demo": "Buyer Guide",
    };
    
    const scenario = scenarioMap[args.formId] || "our event";

    const message = `You expressed interest at our ${scenario}. Please complete your request here: ${args.link} - Takes 30 seconds. Reply STOP to unsubscribe.`;

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
        throw new Error(`Twilio API error: ${errorText}`);
      }
    } catch (error) {
      console.error("Error sending demo SMS:", error);
      throw error;
    }
  },
});
