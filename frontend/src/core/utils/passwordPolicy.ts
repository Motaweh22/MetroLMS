import { sanitizeEgyptMobile11 } from './numericInput';

export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

export interface PasswordPolicyChecks {
  minLength: boolean;
  hasUpperAndLower: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  notMatchingIdentity: boolean;
}

export interface PasswordStrengthResult {
  score: number;
  level: PasswordStrengthLevel;
  labelAr: string;
  checks: PasswordPolicyChecks;
  isValidForSave: boolean;
  errorMessage?: string;
}

const UPPER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER_CHARS = 'abcdefghijkmnpqrstuvwxyz';
const DIGIT_CHARS = '23456789';
const SYMBOL_CHARS = '@#$%&*!?';
const ALL_CHARS = UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS + SYMBOL_CHARS;

function randomIndex(max: number): number {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Generate a readable, high-entropy 12-character password for Admin provisioning.
 * Excludes visually ambiguous characters (0/O/o, 1/l/I) so staff can read/type it easily.
 */
export function generateStrongPassword(length = 12): string {
  const targetLen = Math.max(8, length);
  const chars: string[] = [
    UPPER_CHARS[randomIndex(UPPER_CHARS.length)],
    LOWER_CHARS[randomIndex(LOWER_CHARS.length)],
    DIGIT_CHARS[randomIndex(DIGIT_CHARS.length)],
    SYMBOL_CHARS[randomIndex(SYMBOL_CHARS.length)],
  ];
  while (chars.length < targetLen) {
    chars.push(ALL_CHARS[randomIndex(ALL_CHARS.length)]);
  }
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

/**
 * Evaluate password strength & policy rules for Admin create/edit forms.
 */
export function evaluatePasswordStrength(
  password: string,
  context?: { phone?: string; name?: string }
): PasswordStrengthResult {
  const lowerPwd = password.toLowerCase();
  const minLength = password.length >= 8;
  const hasUpperAndLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);

  let notMatchingIdentity = true;
  if (password.length > 0) {
    const localPhone = sanitizeEgyptMobile11(context?.phone || '');
    if (localPhone.length >= 6 && lowerPwd.includes(localPhone.toLowerCase())) {
      notMatchingIdentity = false;
    }
    const cleanName = (context?.name || '').trim().toLowerCase();
    if (cleanName.length >= 3 && lowerPwd === cleanName) {
      notMatchingIdentity = false;
    }
  }

  const passedCount = [minLength, hasUpperAndLower, hasDigit, hasSymbol].filter(Boolean).length;
  const isValidForSave = minLength && hasUpperAndLower && hasDigit && notMatchingIdentity;

  let level: PasswordStrengthLevel = 'weak';
  let labelAr = 'ضعيفة';
  if (isValidForSave && hasSymbol && password.length >= 10) {
    level = 'strong';
    labelAr = 'قوية';
  } else if (isValidForSave || (minLength && passedCount >= 3 && notMatchingIdentity)) {
    level = 'medium';
    labelAr = 'متوسطة';
  }

  let errorMessage: string | undefined;
  if (!notMatchingIdentity) {
    errorMessage = 'يجب ألا تتطابق كلمة المرور مع رقم الهاتف أو الاسم.';
  } else if (!minLength) {
    errorMessage = 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.';
  } else if (!hasUpperAndLower || !hasDigit) {
    errorMessage = 'يجب أن تحتوي كلمة المرور على حرف إنجليزي كبير وصغير ورقم واحد على الأقل.';
  }

  return {
    score: passedCount,
    level,
    labelAr,
    checks: {
      minLength,
      hasUpperAndLower,
      hasDigit,
      hasSymbol,
      notMatchingIdentity,
    },
    isValidForSave,
    errorMessage,
  };
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
