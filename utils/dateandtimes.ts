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

export function formatDateHumanReadable(
    value: Date | number | string,
): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const month = MONTH_ABBREVIATIONS[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
}
