import type { WhatsAppContact } from '../types';

/**
 * Public support contacts are resolved dynamically from the Backend via
 * `GET /api/public/support-contacts?scenario=<scenario>`.
 * No hardcoded fallback phone numbers are shipped in production builds.
 */
export const CONFIGURED_ADMIN_SUPPORT_CONTACTS: WhatsAppContact[] = [];
