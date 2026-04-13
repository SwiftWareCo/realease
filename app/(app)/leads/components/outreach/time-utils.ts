export type MinuteAwareCallingWindow = {
    start_hour_local: number;
    start_minute_local?: number | null;
    end_hour_local: number;
    end_minute_local?: number | null;
};

export function getStartMinutes(window: MinuteAwareCallingWindow): number {
    return toMinutes(window.start_hour_local, window.start_minute_local ?? 0);
}

export function getEndMinutes(window: MinuteAwareCallingWindow): number {
    return toMinutes(window.end_hour_local, window.end_minute_local ?? 0);
}

export function toMinutes(hour: number, minute = 0): number {
    const normalizedHour = ((Math.floor(hour) % 24) + 24) % 24;
    const normalizedMinute = Math.min(59, Math.max(0, Math.floor(minute)));
    return normalizedHour * 60 + normalizedMinute;
}

export function fromMinutes(totalMinutes: number): { hour: number; minute: number } {
    const normalized = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
    return {
        hour: Math.floor(normalized / 60),
        minute: normalized % 60,
    };
}
