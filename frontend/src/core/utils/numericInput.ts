import type React from 'react';

const ARABIC_INDIC_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

/**
 * Convert Arabic-Indic / Persian digits to standard ASCII digits (0-9).
 */
export function toAsciiDigits(raw: string): string {
  return raw.replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_INDIC_MAP[ch] ?? ch);
}

/**
 * Allow strictly ASCII digits (0-9) only — ideal for National IDs and pure integer inputs.
 */
export function sanitizeDigitsOnly(raw: string, maxLength?: number): string {
  const cleaned = toAsciiDigits(raw).replace(/\D+/g, '');
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Allow optional single leading '+' followed strictly by digits (0-9) — ideal for phone numbers.
 */
export function sanitizePhoneInput(raw: string, maxLength = 15): string {
  const normalized = toAsciiDigits(raw);
  const hasLeadingPlus = normalized.trimStart().startsWith('+');
  const digits = normalized.replace(/\D+/g, '');
  const result = hasLeadingPlus ? `+${digits}` : digits;
  return result.slice(0, maxLength);
}

/**
 * Allow strictly digits (0-9) and ':' — ideal for mm:ss / hh:mm:ss duration inputs.
 */
export function sanitizeDurationInput(raw: string, maxLength = 8): string {
  return toAsciiDigits(raw)
    .replace(/[^0-9:]/g, '')
    .slice(0, maxLength);
}

/**
 * Block scientific/sign keys ('e', 'E', '+', '-', and optionally '.') on <input type="number">.
 */
export function blockInvalidNumberKeys(
  e: React.KeyboardEvent<HTMLInputElement>,
  allowDecimal = false
): void {
  const blocked = allowDecimal ? ['e', 'E', '+', '-'] : ['e', 'E', '+', '-', '.'];
  if (blocked.includes(e.key)) {
    e.preventDefault();
  }
}
