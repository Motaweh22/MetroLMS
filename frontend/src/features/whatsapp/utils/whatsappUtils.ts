import type { WhatsAppContactContextType, WhatsAppSupportScenario } from '../types';

/**
 * Sanitizes and normalizes phone numbers for use in WhatsApp `https://wa.me/{phone}` links.
 *
 * Rules:
 * - Strips all whitespace, dashes, plus signs, and non-numeric characters.
 * - Standardizes Egyptian local numbers starting with '0' (e.g. '01010000001') to international format ('201010000001').
 * - Preserves already internationalized numbers starting with '20' or country codes.
 * - Rejects empty, whitespace-only, or invalid strings (less than 8 digits) with `null`.
 */
export function cleanPhoneNumber(rawPhone?: string | null): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;

  const digitsOnly = rawPhone.replace(/\D/g, '');
  if (!digitsOnly || digitsOnly.length < 8) return null;

  // Local Egyptian mobile prefix standardisation (010, 011, 012, 015)
  if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
    return `20${digitsOnly.slice(1)}`;
  }

  return digitsOnly;
}

/**
 * Strict Egyptian mobile validation and normalization for WhatsApp contact visibility.
 * Supports NTRA numbering prefixes (010, 011, 012, 015):
 * - National: Exactly 11 digits starting with 010, 011, 012, or 015.
 * - International: Exactly 12 digits starting with 20 followed by 10, 11, 12, or 15.
 * - Handles normal punctuation (+, spaces, hyphens, parentheses, leading 00).
 * - Rejects landlines, unsupported prefixes, incomplete numbers, and arbitrary digit sequences.
 *
 * Note: Prefixes are supported numbering codes only and do not indicate current carrier due to MNP.
 * Syntactic validation DOES NOT verify that an active WhatsApp account exists.
 *
 * Returns canonical 12-digit digits-only string for wa.me URLs (e.g. '201012345678') or null.
 */
export function validateAndNormalizeEgyptianMobile(rawPhone?: string | null): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;

  // 1. Strip all non-digit characters
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return null;

  // 2. Strip leading international access code '00' if present (e.g. 002010... -> 2010...)
  if (digits.startsWith('0020')) {
    digits = digits.slice(2);
  }

  // 3. Match against national Egyptian mobile format: 01[0125]XXXXXXXX (exactly 11 digits)
  //    Prefix: 0 + (10 | 11 | 12 | 15) [3 digits] + 8 subscriber digits = 11 digits total
  if (/^0(10|11|12|15)\d{8}$/.test(digits)) {
    return `20${digits.slice(1)}`;
  }

  // 4. Match against international Egyptian mobile format: 201[0125]XXXXXXXX (exactly 12 digits)
  //    Prefix: 20 + (10 | 11 | 12 | 15) [4 digits] + 8 subscriber digits = 12 digits total
  if (/^20(10|11|12|15)\d{8}$/.test(digits)) {
    return digits;
  }

  // 5. Reject all other inputs (landlines, foreign numbers, arbitrary digits, invalid prefixes)
  return null;
}

/**
 * Formats a canonical 12-digit Egyptian mobile string into international presentation notation.
 * e.g. '201012345678' -> '+20 101 234 5678'
 */
export function formatEgyptianMobileDisplay(canonical12Digits?: string | null): string {
  if (!canonical12Digits || canonical12Digits.length !== 12) return canonical12Digits || '—';
  return `+${canonical12Digits.slice(0, 2)} ${canonical12Digits.slice(2, 5)} ${canonical12Digits.slice(5, 8)} ${canonical12Digits.slice(8)}`;
}

/**
 * Constructs a fully encoded, RFC-compliant WhatsApp direct link.
 */
export function buildWhatsAppUrl(cleanPhone: string, message: string): string {
  const sanitized = cleanPhoneNumber(cleanPhone);
  if (!sanitized) return '';
  return `https://wa.me/${sanitized}?text=${encodeURIComponent(message)}`;
}

export interface ContextMessageParams {
  user?: {
    id?: string;
    name?: string;
    jobTitle?: string;
  } | null;
  courseTitle?: string;
  groupName?: string;
}

/**
 * Constructs verified Arabic prefilled inquiry copy matching legacy LMS templates.
 * 
 * Invariants:
 * - Login context NEVER fabricates user identity or ID.
 * - Authenticated contexts include user name, ID, and jobTitle.
 */
export function buildContextMessage(
  context: WhatsAppContactContextType | WhatsAppSupportScenario,
  params: ContextMessageParams
): string {
  const { user, courseTitle, groupName } = params;
  const hasUserIdentity = Boolean(user && user.name && user.id);

  switch (context) {
    case 'course': {
      const title = courseTitle ? courseTitle.trim() : 'المقرر التدريبي';
      if (hasUserIdentity) {
        return `السلام عليكم، أنا ${user!.name}، رقم الموظف ${user!.id}، وظيفتي ${user!.jobTitle || 'موظف'}. لدي استفسار بخصوص كورس: ${title}`;
      }
      return `السلام عليكم، لدي استفسار بخصوص كورس: ${title}`;
    }

    case 'group': {
      const name = groupName ? groupName.trim() : 'مجموعة التدريب';
      if (hasUserIdentity) {
        return `السلام عليكم، أنا ${user!.name}، رقم الموظف ${user!.id}، وظيفتي ${user!.jobTitle || 'متدرب'}. لدي استفسار بخصوص مجموعة التدريب: ${name}`;
      }
      return `السلام عليكم، لدي استفسار بخصوص مجموعة التدريب: ${name}`;
    }

    case 'login': {
      // Unauthenticated visitor: do NOT fabricate or infer identity
      return 'السلام عليكم، أواجه مشكلة في تسجيل الدخول إلى منصة تدريب مترو الأنفاق وأحتاج إلى مساعدة.';
    }

    case 'technical_support': {
      if (hasUserIdentity) {
        return `السلام عليكم، أنا ${user!.name}، رقم الموظف ${user!.id}، وظيفتي ${user!.jobTitle || 'موظف'}. أحتاج إلى مساعدة فنية بخصوص منصة التدريب الإلكتروني.`;
      }
      return 'السلام عليكم، أواجه مشكلة فنية في منصة التدريب الإلكتروني وأحتاج إلى مساعدة.';
    }

    case 'account_registration': {
      return 'مرحبًا، أرغب في إنشاء حساب جديد على منصة التدريب الإلكتروني. يرجى إرشادي إلى خطوات التسجيل.';
    }

    case 'password_recovery': {
      return 'مرحبًا، أحتاج إلى المساعدة في استعادة كلمة المرور لحسابي على منصة التدريب الإلكتروني.';
    }

    case 'general':
    default: {
      if (hasUserIdentity) {
        return `السلام عليكم، أنا ${user!.name}، رقم الموظف ${user!.id}، وظيفتي ${user!.jobTitle || 'موظف'}. أحتاج إلى مساعدة بالمنصة.`;
      }
      return 'السلام عليكم، أحتاج إلى مساعدة بخصوص منصة تدريب مترو الأنفاق.';
    }
  }
}

/**
 * Verified Arabic copy for lecturer-initiated reminders to late/inactive trainees.
 * Legacy parity: `js/lecturer.js:884`.
 */
export function buildLecturerReminderMessage(traineeName: string, courseTitle: string): string {
  const safeName = traineeName ? traineeName.trim() : 'المتدرب';
  const safeTitle = courseTitle ? courseTitle.trim() : 'المقرر التدريبي';
  return `مرحباً ${safeName}،\nنود تذكيرك بضرورة استكمال كورس "${safeTitle}". لقد لاحظنا توقفك عن المشاهدة مؤخراً. إذا كان لديك أي استفسار أو مشكلة تواجهك، لا تتردد في التواصل معي.`;
}
