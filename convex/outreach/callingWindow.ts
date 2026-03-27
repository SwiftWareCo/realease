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
    end_hour_local: number;
    allowed_weekdays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
};

export function getLocalWeekdayHour(
    timestamp: number,
    timeZone: string,
): { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; hour: number } {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        hour: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const weekdayPart = parts.find((part) => part.type === "weekday")?.value;
    const hourPart = parts.find((part) => part.type === "hour")?.value;

    const weekdayKey = weekdayPart?.toLowerCase().slice(0, 3) ?? "sun";
    const weekday = WEEKDAY_MAP[weekdayKey];
    const hour = hourPart ? Number(hourPart) : 0;
    return { weekday, hour };
}

export function isInsideCallingWindow(
    timestamp: number,
    timeZone: string,
    window: CallingWindow,
): boolean {
    const { weekday, hour } = getLocalWeekdayHour(timestamp, timeZone);
    if (!window.allowed_weekdays.includes(weekday)) {
        return false;
    }

    const start = window.start_hour_local;
    const end = window.end_hour_local;
    if (start === end) {
        return true;
    }
    if (start < end) {
        return hour >= start && hour < end;
    }
    // Overnight windows (example 21 -> 6)
    return hour >= start || hour < end;
}

/**
 * Compute the next UTC timestamp (in ms) when the campaign calling window
 * opens, starting from `now`. Returns `now` if already inside the window.
 *
 * Algorithm:
 * 1. Convert `now` to campaign timezone.
 * 2. If today is a valid weekday and the current hour < start_hour, return
 *    today at start_hour.
 * 3. Otherwise walk forward through weekdays (up to 7 days) until we find the
 *    next allowed day and return that day at start_hour.
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

    const { weekday, hour } = getLocalWeekdayHour(now, timeZone);

    // Check if today is a valid day and we haven't passed the start hour yet.
    if (window.allowed_weekdays.includes(weekday) && hour < window.start_hour_local) {
        // Return today at start_hour in the campaign timezone.
        return computeTimestampAtLocalHour(now, timeZone, 0, window.start_hour_local);
    }

    // Walk forward through the next 7 days to find the next allowed weekday.
    for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
        const futureDay = ((weekday + daysAhead) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
        if (window.allowed_weekdays.includes(futureDay)) {
            return computeTimestampAtLocalHour(
                now,
                timeZone,
                daysAhead,
                window.start_hour_local,
            );
        }
    }

    // Fallback: should not happen if allowed_weekdays is non-empty.
    // Return now + 24h as a safe default.
    return now + 24 * 60 * 60 * 1000;
}

/**
 * Compute a UTC timestamp for "local time = `targetHour`:00" on
 * `now + daysOffset` days in the given timezone.
 *
 * Uses binary-search-style correction to avoid full tz library.
 */
function computeTimestampAtLocalHour(
    now: number,
    timeZone: string,
    daysOffset: number,
    targetHour: number,
): number {
    // Start with a rough estimate: shift now by daysOffset days,
    // then adjust to the target hour.
    const { hour: currentHour } = getLocalWeekdayHour(now, timeZone);
    const hourDiff = targetHour - currentHour + daysOffset * 24;
    let estimate = now + hourDiff * 60 * 60 * 1000;

    // Zero out minutes/seconds by flooring to the hour.
    // Get local minute/second at estimate, then subtract.
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
            (targetHour - h) * 60 * 60 * 1000 -
            m * 60 * 1000 -
            s * 1000;

        if (correction === 0) break;
        estimate += correction;
    }

    return estimate;
}
