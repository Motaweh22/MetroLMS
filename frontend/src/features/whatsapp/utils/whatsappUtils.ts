import type { WhatsAppContactContextType } from '../types';

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
  context: WhatsAppContactContextType,
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
