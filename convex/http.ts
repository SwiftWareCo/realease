import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

const http = httpRouter();
const RETELL_SIGNATURE_HEADER = "x-retell-signature";
const RETELL_WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;
const TWILIO_SIGNATURE_HEADER = "x-twilio-signature";
const textEncoder = new TextEncoder();

type JsonObject = Record<string, unknown>;

http.route({
    path: "/twilio-messaging-webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        const rawBody = await request.text();
        const signature = request.headers.get(TWILIO_SIGNATURE_HEADER);
        const payload = parseTwilioFormPayload(rawBody);

        const signatureValid = await verifyTwilioSignature({
            requestUrl: request.url,
            signature,
            payload,
        });
        if (!signatureValid) {
            return new Response("Invalid Twilio signature", { status: 401 });
        }

        await ctx.runMutation(
            internal.outreach.mutations.ingestTwilioMessagingWebhook,
            {
                message_sid: payload.MessageSid ?? payload.SmsSid,
                account_sid: payload.AccountSid,
                messaging_service_sid: payload.MessagingServiceSid,
                message_status: payload.MessageStatus ?? payload.SmsStatus,
                from_number: payload.From,
                to_number: payload.To,
                body: payload.Body,
                error_code: payload.ErrorCode,
                error_message: payload.ErrorMessage,
                raw_payload: payload,
                received_at: Date.now(),
            },
        );

        return new Response(JSON.stringify({ accepted: true }), {
            status: 202,
            headers: { "Content-Type": "application/json" },
        });
    }),
});

http.route({
    path: "/clerk-users-webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        const event = await validateRequest(request);
        if (!event) {
            return new Response("Error occured", { status: 400 });
        }
        switch (event.type) {
            case "user.created": // intentional fallthrough
            case "user.updated":
                await ctx.runMutation(internal.users.upsertFromClerk, {
                    data: event.data,
                });
                break;

            case "user.deleted": {
                const clerkUserId = event.data.id!;
                await ctx.runMutation(internal.users.deleteFromClerk, {
                    clerkUserId,
                });
                break;
            }
            default:
                console.log("Ignored Clerk webhook event", event.type);
        }

        return new Response(null, { status: 200 });
    }),
});

http.route({
    path: "/retell-webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        const rawBody = await request.text();
        const signature = request.headers.get(RETELL_SIGNATURE_HEADER);

        const signatureValid = await verifyRetellSignature(rawBody, signature);
        if (!signatureValid) {
            return new Response("Invalid Retell signature", { status: 401 });
        }

        let payload: unknown;
        try {
            payload = rawBody ? JSON.parse(rawBody) : {};
        } catch {
            return new Response("Invalid JSON payload", { status: 400 });
        }

        const extracted = extractRetellWebhookFields(payload);

        await ctx.runMutation(
            internal.outreach.mutations.ingestRetellWebhookEvent,
            {
                retell_event_id: extracted.retellEventId,
                retell_call_id: extracted.retellCallId,
                event_type: extracted.eventType,
                event_timestamp: extracted.eventTimestamp,
                payload,
                call_id: extracted.outreachCallId,
                campaign_id: extracted.campaignId,
                lead_id: extracted.leadId,
            },
        );

        return new Response(JSON.stringify({ accepted: true }), {
            status: 202,
            headers: { "Content-Type": "application/json" },
        });
    }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
    const payloadString = await req.text();
    const svixHeaders = {
        "svix-id": req.headers.get("svix-id")!,
        "svix-timestamp": req.headers.get("svix-timestamp")!,
        "svix-signature": req.headers.get("svix-signature")!,
    };
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
    try {
        return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
    } catch (error) {
        console.error("Error verifying webhook event", error);
        return null;
    }
}

function parseTwilioFormPayload(rawBody: string): Record<string, string> {
    const searchParams = new URLSearchParams(rawBody);
    const payload: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
        payload[key] = value;
    }
    return payload;
}

function areStringsEqualConstantTime(left: string, right: string): boolean {
    if (left.length !== right.length) {
        return false;
    }
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}

function bytesToBase64(bytes: ArrayBuffer): string {
    let binary = "";
    for (const value of new Uint8Array(bytes)) {
        binary += String.fromCharCode(value);
    }
    return btoa(binary);
}

async function verifyTwilioSignature(args: {
    requestUrl: string;
    signature: string | null;
    payload: Record<string, string>;
}): Promise<boolean> {
    if (process.env.TWILIO_SKIP_WEBHOOK_SIGNATURE_VALIDATION === "true") {
        return true;
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    if (!authToken || !args.signature) {
        return false;
    }

    const sortedKeys = Object.keys(args.payload).sort((a, b) =>
        a.localeCompare(b),
    );
    let data = args.requestUrl;
    for (const key of sortedKeys) {
        data += key + args.payload[key];
    }

    const hmacKey = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(authToken),
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"],
    );
    const digest = await crypto.subtle.sign(
        "HMAC",
        hmacKey,
        textEncoder.encode(data),
    );
    const expected = bytesToBase64(digest);
    return areStringsEqualConstantTime(expected, args.signature);
}

function normalizeString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim();
    return normalized ? normalized : undefined;
}

function asObject(value: unknown): JsonObject | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as JsonObject;
}

function firstString(...candidates: Array<unknown>): string | undefined {
    for (const candidate of candidates) {
        const normalized = normalizeString(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return undefined;
}

function normalizeTimestamp(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value > 100_000_000_000
            ? Math.trunc(value)
            : Math.trunc(value * 1000);
    }
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim();
    if (!normalized) {
        return undefined;
    }
    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber)) {
        return normalizeTimestamp(asNumber);
    }
    const asDate = Date.parse(normalized);
    return Number.isNaN(asDate) ? undefined : asDate;
}

function extractRetellWebhookFields(payload: unknown): {
    retellEventId?: string;
    retellCallId?: string;
    eventType: string;
    eventTimestamp?: number;
    outreachCallId?: string;
    campaignId?: string;
    leadId?: string;
} {
    const root = asObject(payload);
    const rootEvent = asObject(root?.event);
    const rootData = asObject(root?.data);
    const rootCall = asObject(root?.call) ?? asObject(rootData?.call);
    const rootMetadata =
        asObject(rootCall?.metadata) ??
        asObject(rootData?.metadata) ??
        asObject(root?.metadata);

    const eventType =
        firstString(
            root?.event_type,
            root?.event,
            root?.type,
            rootEvent?.type,
            rootData?.event_type,
            rootData?.event,
            rootData?.type,
        ) ?? "unknown";

    const eventTimestamp = normalizeTimestamp(
        root?.event_timestamp ??
            root?.timestamp ??
            root?.created_at ??
            rootData?.event_timestamp ??
            rootData?.timestamp ??
            rootData?.created_at,
    );

    return {
        retellEventId: firstString(
            root?.retell_event_id,
            root?.event_id,
            root?.id,
            rootEvent?.id,
            rootData?.retell_event_id,
            rootData?.event_id,
            rootData?.id,
        ),
        retellCallId: firstString(
            root?.retell_call_id,
            root?.call_id,
            rootCall?.retell_call_id,
            rootCall?.call_id,
            rootData?.retell_call_id,
            rootData?.call_id,
        ),
        eventType,
        eventTimestamp,
        outreachCallId: firstString(
            rootMetadata?.outreach_call_id,
            rootMetadata?.call_id,
            root?.outreach_call_id,
            rootData?.outreach_call_id,
        ),
        campaignId: firstString(
            rootMetadata?.campaign_id,
            root?.campaign_id,
            rootData?.campaign_id,
        ),
        leadId: firstString(
            rootMetadata?.lead_id,
            root?.lead_id,
            rootData?.lead_id,
        ),
    };
}

function parseRetellSignature(
    signature: string,
): { timestamp: number; digest: string } | null {
    const match = /v=(\d+),d=(.*)/.exec(signature);
    if (!match) {
        return null;
    }
    const timestamp = Number(match[1]);
    const digest = match[2].trim();
    if (!Number.isFinite(timestamp) || !digest) {
        return null;
    }
    return { timestamp, digest: digest.toLowerCase() };
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
    );
}

function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let mismatch = 0;
    for (let i = 0; i < a.length; i += 1) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}

async function verifyRetellSignature(
    rawBody: string,
    signatureHeader: string | null,
): Promise<boolean> {
    const secret =
        process.env.RETELL_WEBHOOK_SECRET?.trim() ||
        process.env.RETELL_API_KEY?.trim();
    if (!secret || !signatureHeader) {
        return false;
    }

    const parsedSignature = parseRetellSignature(signatureHeader);
    if (!parsedSignature) {
        return false;
    }

    const clockSkewMs = Math.abs(Date.now() - parsedSignature.timestamp);
    if (clockSkewMs > RETELL_WEBHOOK_TOLERANCE_MS) {
        return false;
    }

    const key = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signed = await crypto.subtle.sign(
        "HMAC",
        key,
        textEncoder.encode(`${rawBody}${parsedSignature.timestamp}`),
    );
    const digest = bytesToHex(new Uint8Array(signed));
    return constantTimeEqual(digest, parsedSignature.digest);
}

export default http;
