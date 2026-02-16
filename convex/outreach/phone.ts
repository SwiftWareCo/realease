export function normalizePhoneNumber(phone: string): string | null {
    const trimmed = phone.trim();
    if (!trimmed) {
        return null;
    }

    const hasLeadingPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) {
        return null;
    }

    // Accept explicit E.164 when user includes plus.
    if (hasLeadingPlus) {
        if (!/^[1-9]\d{9,14}$/.test(digits)) {
            return null;
        }
        return `+${digits}`;
    }

    // Common local US format (10 digits) -> normalize to +1XXXXXXXXXX.
    if (digits.length === 10) {
        return `+1${digits}`;
    }

    // Common US number with explicit country code but without plus.
    if (digits.length === 11 && digits.startsWith("1")) {
        return `+${digits}`;
    }

    // Fallback for other country codes typed without plus.
    if (digits.length >= 10 && digits.length <= 15 && !digits.startsWith("0")) {
        return `+${digits}`;
    }

    return null;
}

export function isValidPhoneNumber(phone: string): boolean {
    return normalizePhoneNumber(phone) !== null;
}
