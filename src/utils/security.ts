/**
 * Masks an account number or sensitive string, leaving only the last few characters visible.
 * @param str The string to mask
 * @param visibleCount Number of characters to keep visible at the end
 * @returns Masked string (e.g., "****7890")
 */
export function maskSensitiveString(str: string, visibleCount: number = 4): string {
    if (!str) return '';
    if (str.length <= visibleCount) return str;
    return str.slice(-visibleCount).padStart(str.length, '*');
}
