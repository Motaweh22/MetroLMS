import type { WhatsAppContact } from '../types';

/**
 * Centrally Configured Public Administrative & Technical Support Contacts
 * for Cairo Metro LMS Platform.
 *
 * Source Documentation:
 * - Legacy Cairo Metro LMS `index.html` (lines 240-242) defines the official public WhatsApp
 *   support channel for login assistance, password recovery, and trainee inquiries:
 *   `https://wa.me/201000000000` ("التواصل معنا عبر واتساب").
 * - In accordance with security & privacy governance, personal mobile numbers of individual
 *   system administrators (e.g. from user accounts directory) are strictly NOT exposed as public helpdesks.
 * - If approved contact configuration is cleared or unavailable, the application safely displays
 *   an informative unavailable notice rather than exposing personal numbers or broken links.
 */
export const CONFIGURED_ADMIN_SUPPORT_CONTACTS: WhatsAppContact[] = [
  {
    id: 'legacy_metro_support',
    name: 'الدعم الفني والتدريب عبر واتساب',
    role: 'خدمة المتدربين والدعم الفني',
    number: '201000000000',
    displayNumber: '+20 100 000 0000',
    avatarInitial: 'د',
    isAvailable: true,
  },
];
