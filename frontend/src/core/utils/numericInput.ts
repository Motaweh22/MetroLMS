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
 * Canonical Egyptian local mobile number pattern: 11 digits starting with 010, 011, 012, or 015.
 */
export const EGYPT_LOCAL_MOBILE_RE = /^01[0125][0-9]{8}$/;

/**
 * Sanitize an Egyptian mobile input strictly to local 11-digit format (01XXXXXXXXX).
 * Also converts pasted +201XXXXXXXXX / 201XXXXXXXXX values into 01XXXXXXXXX cleanly.
 */
export function sanitizeEgyptMobile11(raw: string): string {
  const digits = toAsciiDigits(raw).replace(/\D+/g, '');
  if (/^201[0125][0-9]{8}$/.test(digits)) {
    return digits.slice(1, 12);
  }
  return digits.slice(0, 11);
}

/**
 * Live & submit-time validator for 11-digit Egyptian mobile numbers (010/011/012/015).
 * Returns an Arabic error immediately on invalid network prefix while typing,
 * and on incomplete length when `enforceComplete` is true (blur or submit).
 */
export function getEgyptMobileLiveError(
  raw: string,
  enforceComplete = false
): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return enforceComplete
      ? 'يرجى إدخال رقم الهاتف (11 رقماً، مثال: 01012345678)'
      : undefined;
  }
  if (!trimmed.startsWith('0') || (trimmed.length >= 2 && !trimmed.startsWith('01'))) {
    return 'يجب أن يبدأ رقم الموبايل بـ 010 أو 011 أو 012 أو 015';
  }
  if (trimmed.length >= 3 && !/^01[0125]/.test(trimmed)) {
    return 'كود الشبكة غير صحيح؛ يجب أن يبدأ الرقم بـ 010 أو 011 أو 012 أو 015';
  }
  if (trimmed.length < 11) {
    return enforceComplete
      ? `رقم الهاتف غير مكتمل (${trimmed.length} من 11 رقماً) — مثال: 01012345678`
      : undefined;
  }
  if (!EGYPT_LOCAL_MOBILE_RE.test(trimmed)) {
    return 'رقم الهاتف يجب أن يتكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015';
  }
  return undefined;
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
