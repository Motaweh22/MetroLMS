/**
 * MetroLMS Canonical User Identity & Alias Mapping Core Domain Module
 *
 * Grounded in Master Finding Register MFR-01 and MFR-13.
 * Provides deterministic, case-insensitive mapping between legacy IDs,
 * demo personas, email aliases, and canonical uppercase directory user IDs (USR*).
 *
 * Architectural Boundary:
 * This module lives in `core/auth` and MUST NOT depend on mock fixtures or server handlers.
 */

export const USER_ALIAS_MAP: Record<string, string> = {
  // Lowercased legacy IDs (usr001 - usr012)
  usr001: 'USR001',
  usr002: 'USR002',
  usr003: 'USR003',
  usr004: 'USR004',
  usr005: 'USR005',
  usr006: 'USR006',
  usr007: 'USR007',
  usr008: 'USR008',
  usr009: 'USR009',
  usr010: 'USR010',
  usr011: 'USR011',
  usr012: 'USR012',

  // Uppercased canonical directory IDs
  USR001: 'USR001',
  USR002: 'USR002',
  USR003: 'USR003',
  USR004: 'USR004',
  USR005: 'USR005',
  USR006: 'USR006',
  USR007: 'USR007',
  USR008: 'USR008',
  USR009: 'USR009',
  USR010: 'USR010',
  USR011: 'USR011',
  USR012: 'USR012',
  USR013: 'USR013',
  USR014: 'USR014',
  USR015: 'USR015',
  USR016: 'USR016',
  usr016: 'USR016',
  assistant_admin_demo: 'USR016',
  'assistant.admin@metro.gov.eg': 'USR016',

  USR017: 'USR017',
  usr017: 'USR017',
  assistant_lecturer_demo: 'USR017',
  'assistant.lecturer@metro.gov.eg': 'USR017',

  // Active demo personas (canonical IDs map to themselves)
  usr_admin_001: 'usr_admin_001',
  'admin@cairo-metro.com': 'usr_admin_001',
  usr_lect_002: 'usr_lect_002',
  'lecturer@cairo-metro.com': 'usr_lect_002',
  usr_trainee_003: 'usr_trainee_003',
  'trainee@cairo-metro.com': 'usr_trainee_003',

  // Legacy synthetic instructor aliases
  usr_lect_001: 'USR003',
};

/**
 * Resolves any legacy identifier, email alias, or canonical ID to its canonical directory user ID.
 * Case-insensitive lookup with regex pattern fallback.
 */
export function resolveCanonicalUserId(identifier: string): string {
  if (!identifier) return identifier;
  const trimmed = identifier.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct match in alias map (case-insensitive)
  for (const [alias, canonicalId] of Object.entries(USER_ALIAS_MAP)) {
    if (alias.toLowerCase() === lower) {
      return canonicalId;
    }
  }

  // 2. Pattern match for standard legacy user IDs (usr### -> USR###)
  const legacyMatch = lower.match(/^usr(\d{1,4})$/);
  if (legacyMatch) {
    const numPart = legacyMatch[1].padStart(3, '0');
    return `USR${numPart}`;
  }

  // 3. Unresolved identifier is returned trimmed
  return trimmed;
}

