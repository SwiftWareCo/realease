/**
 * Shared calling-window utilities.
 *
 * Extracted from mutations.ts so both legacy code and the new
 * campaignLeadState module can import them.
 */

export const WEEKDAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
};

export type CallingWindow = {
    start_hour_local: number;
    start_minute_local?: number;
    end_hour_local: number;
    end_minute_local?: number;
    allowed_weekdays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
};

export function getLocalWeekdayHour(
    timestamp: number,
    timeZone: string,
): { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; hour: number; minute: number } {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const weekdayPart = parts.find((part) => part.type === "weekday")?.value;
    const hourPart = parts.find((part) => part.type === "hour")?.value;
    const minutePart = parts.find((part) => part.type === "minute")?.value;

    const weekdayKey = weekdayPart?.toLowerCase().slice(0, 3) ?? "sun";
    const weekday = WEEKDAY_MAP[weekdayKey];
    const hour = hourPart ? Number(hourPart) : 0;
    const minute = minutePart ? Number(minutePart) : 0;
    return { weekday, hour, minute };
}

export function getCallingWindowStartMinutes(window: CallingWindow): number {
    return (
        window.start_hour_local * 60 + normalizeMinute(window.start_minute_local)
    );
}

export function getCallingWindowEndMinutes(window: CallingWindow): number {
    return window.end_hour_local * 60 + normalizeMinute(window.end_minute_local);
}

function normalizeMinute(value: number | undefined): number {
    if (value === undefined) {
        return 0;
    }
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(59, Math.max(0, Math.floor(value)));
}

export function isInsideCallingWindow(
    timestamp: number,
    timeZone: string,
    window: CallingWindow,
): boolean {
    const { weekday, hour, minute } = getLocalWeekdayHour(timestamp, timeZone);
    if (!window.allowed_weekdays.includes(weekday)) {
        return false;
    }

    const current = hour * 60 + minute;
    const start = getCallingWindowStartMinutes(window);
    const end = getCallingWindowEndMinutes(window);
    if (start === end) {
        return true;
    }
    if (start < end) {
        return current >= start && current < end;
    }
    // Overnight windows (example 21 -> 6)
    return current >= start || current < end;
}

/**
 * Compute the next UTC timestamp (in ms) when the campaign calling window
 * opens, starting from `now`. Returns `now` if already inside the window.
 *
 * Algorithm:
 * 1. Convert `now` to campaign timezone.
 * 2. If today is a valid weekday and the current local time is before the
 *    configured start time, return today at the start time.
 * 3. Otherwise walk forward through weekdays (up to 7 days) until we find the
 *    next allowed day and return that day at the start time.
 * 4. Convert back to UTC ms.
 *
 * Uses a heuristic approach with Intl.DateTimeFormat to avoid a full timezone
 * library dependency.
 */
export function getNextWindowOpenMs(
    now: number,
    timeZone: string,
    window: CallingWindow,
): number {
    // If currently inside the window, return now.
    if (isInsideCallingWindow(now, timeZone, window)) {
        return now;
    }

    const { weekday, hour, minute } = getLocalWeekdayHour(now, timeZone);
    const current = hour * 60 + minute;
    const start = getCallingWindowStartMinutes(window);

    // Check if today is valid and we haven't passed the configured start time.
    if (window.allowed_weekdays.includes(weekday) && current < start) {
        // Return today at the configured local start time.
        return computeTimestampAtLocalTime(
            now,
            timeZone,
            0,
            window.start_hour_local,
            normalizeMinute(window.start_minute_local),
        );
    }

    // Walk forward through the next 7 days to find the next allowed weekday.
    for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
        const futureDay = ((weekday + daysAhead) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
        if (window.allowed_weekdays.includes(futureDay)) {
            return computeTimestampAtLocalTime(
                now,
                timeZone,
                daysAhead,
                window.start_hour_local,
                normalizeMinute(window.start_minute_local),
            );
        }
    }

    // Fallback: should not happen if allowed_weekdays is non-empty.
    // Return now + 24h as a safe default.
    return now + 24 * 60 * 60 * 1000;
}

/**
 * Compute a UTC timestamp for the requested local hour/minute on
 * `now + daysOffset` days in the given timezone.
 *
 * Uses binary-search-style correction to avoid full tz library.
 */
function computeTimestampAtLocalTime(
    now: number,
    timeZone: string,
    daysOffset: number,
    targetHour: number,
    targetMinute: number,
): number {
    // Start with a rough estimate: shift now by daysOffset days,
    // then adjust to the target local time.
    const { hour: currentHour, minute: currentMinute } = getLocalWeekdayHour(
        now,
        timeZone,
    );
    const minuteDiff =
        targetHour * 60 +
        targetMinute -
        (currentHour * 60 + currentMinute) +
        daysOffset * 24 * 60;
    let estimate = now + minuteDiff * 60 * 1000;

    // Refine the estimate using the actual localized hour/minute/second.
    const minuteSecondFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    // Refine the estimate up to 3 times to handle DST edge cases.
    for (let i = 0; i < 3; i++) {
        const parts = minuteSecondFormatter.formatToParts(new Date(estimate));
        const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
        const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
        const s = Number(parts.find((p) => p.type === "second")?.value ?? 0);

        const correction =
            (targetHour * 60 + targetMinute - (h * 60 + m)) * 60 * 1000 -
            s * 1000;

        if (correction === 0) break;
        estimate += correction;
    }

    return estimate;
}
