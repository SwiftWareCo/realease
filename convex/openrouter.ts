'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { OpenRouter } from '@openrouter/sdk';

export const analyzeLead = internalAction({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    property_address: v.optional(v.string()),
    timeline: v.optional(v.string()),
    intent: v.union(
      v.literal('buyer'),
      v.literal('seller'),
      v.literal('investor')
    ),
    notes: v.optional(v.string()),
    source: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
      // Return fallback values
      return {
        sentiment: 'neutral' as const,
        urgency_score: 50,
        conversion_prediction: 'Within 90 days',
        ai_action: 'Follow up with property information',
      };
    }

    const prompt = `
You are a real estate lead qualification expert. Analyze this lead and provide:
1. Sentiment (positive/neutral/negative)
2. Urgency score (0-100) 
3. Conversion prediction ("Within 7 days", "Within 30 days", "Within 90 days", "Low interest")
4. Specific AI action recommendation (max 10 words)

Lead details:
Name: ${args.name}
Phone: ${args.phone}
Intent: ${args.intent}
Timeline: ${args.timeline || 'Not specified'}
Property: ${args.property_address || 'Not specified'}
Notes: ${args.notes || 'No additional notes'}
Source: ${args.source}

Provide JSON only:
{
  "sentiment": "positive|neutral|negative",
  "urgency_score": number,
  "conversion_prediction": "string",
  "ai_action": "string"
}
`;

    try {
      const openrouter = new OpenRouter({
        apiKey: apiKey,
      });

      const response = await openrouter.chat.send({
        model: 'xiaomi/mimo-v2-flash:free',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        maxTokens: 150,
      });

      if (
        !response.choices ||
        !response.choices[0] ||
        !response.choices[0].message
      ) {
        throw new Error('Invalid response structure from OpenRouter');
      }

      // Extract text content from response (can be string or array)
      const messageContent = response.choices[0].message.content;
      let aiResponseText: string;

      if (typeof messageContent === 'string') {
        aiResponseText = messageContent;
      } else if (Array.isArray(messageContent)) {
        // Extract text from content array
        const textItem = messageContent.find((item) => item.type === 'text') as
          | { type: string; text: string }
          | undefined;
        if (!textItem || !textItem.text) {
          throw new Error('No text content found in AI response');
        }
        aiResponseText = textItem.text;
      } else {
        throw new Error('Invalid content format in AI response');
      }

      // Try to parse JSON from the response
      let aiResponse;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch =
          aiResponseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
          aiResponseText.match(/(\{[\s\S]*\})/);
        const jsonText = jsonMatch ? jsonMatch[1] : aiResponseText;
        aiResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse AI response:', aiResponseText);
        throw new Error('Failed to parse AI response as JSON');
      }

      // Validate and return with fallbacks
      return {
        sentiment:
          aiResponse.sentiment === 'positive' ||
          aiResponse.sentiment === 'neutral' ||
          aiResponse.sentiment === 'negative'
            ? aiResponse.sentiment
            : ('neutral' as const),
        urgency_score:
          typeof aiResponse.urgency_score === 'number'
            ? Math.max(0, Math.min(100, aiResponse.urgency_score))
            : 50,
        conversion_prediction:
          typeof aiResponse.conversion_prediction === 'string'
            ? aiResponse.conversion_prediction
            : 'Within 90 days',
        ai_action:
          typeof aiResponse.ai_action === 'string'
            ? aiResponse.ai_action
            : 'Follow up with property information',
      };
    } catch (error) {
      console.error('Error calling OpenRouter:', error);
      // Return fallback values on error
      return {
        sentiment: 'neutral' as const,
        urgency_score: 50,
        conversion_prediction: 'Within 90 days',
        ai_action: 'Follow up with property information',
      };
    }
  },
});
