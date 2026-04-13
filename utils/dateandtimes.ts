const MONTH_ABBREVIATIONS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
] as const;

export function formatHourTo12Hour(hour24: number): string {
    const normalized = ((Math.floor(hour24) % 24) + 24) % 24;
    const suffix = normalized >= 12 ? "PM" : "AM";
    const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
    return `${hour12}:00 ${suffix}`;
}

export function formatHourMinuteTo12Hour(
    hour24: number,
    minute = 0,
): string {
    const normalizedHour = ((Math.floor(hour24) % 24) + 24) % 24;
    const normalizedMinute = Math.min(59, Math.max(0, Math.floor(minute)));
    const suffix = normalizedHour >= 12 ? "PM" : "AM";
    const hour12 = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
    return `${hour12}:${String(normalizedMinute).padStart(2, "0")} ${suffix}`;
}

export function formatMinutesFromMidnightTo12Hour(totalMinutes: number): string {
    const normalized =
        ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
    return formatHourMinuteTo12Hour(
        Math.floor(normalized / 60),
        normalized % 60,
    );
}

export function formatTimeTo12HourWithMinutes(
    value: Date | number | string,
): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const hours = date.getHours();
    const suffix = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hour12}:${minutes} ${suffix}`;
}

export function formatDateHumanReadable(value: Date | number | string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const month = MONTH_ABBREVIATIONS[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
}

export function formatDateTimeHumanReadable(
    value: Date | number | string,
): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return `${formatDateHumanReadable(date)} • ${formatTimeTo12HourWithMinutes(
        date,
    )}`;
}
