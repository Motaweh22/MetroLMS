import type { ManagedUserDTO } from '@/core/user-management/types';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';

/**
 * Centrally Managed Canonical Users Fixture Dataset (15 Unique Identities)
 *
 * GOVERNANCE & SECURITY RULES:
 * 1. Plaintext passwords and credentials from legacy fixtures (e.g. data/users.json)
 *    are NEVER imported, stored, or exposed.
 * 2. Active demo personas (usr_admin_001, usr_lect_002, usr_trainee_003) are preserved
 *    as distinct synthetic identities alongside the 12 verified legacy employee records.
 * 3. Learning metrics (learning hours, completed courses) are NOT duplicated here;
 *    they will be dynamically computed in Phase 3.
 */
export const INITIAL_MANAGED_USERS: ManagedUserDTO[] = [
  // ── 3 Synthetic Active Demo Personas ─────────────────────────────────
  {
    id: SYNTHETIC_DEMO_ACCOUNTS.admin.user.id,
    name: SYNTHETIC_DEMO_ACCOUNTS.admin.user.name,
    username: 'admin_demo',
    email: SYNTHETIC_DEMO_ACCOUNTS.admin.user.email,
    phone: '01010000001',
    jobTitle: SYNTHETIC_DEMO_ACCOUNTS.admin.user.jobTitle,
    department: SYNTHETIC_DEMO_ACCOUNTS.admin.user.department,
    role: 'admin',
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z',
    lastLogin: '2026-03-01T08:00:00Z',
    legacyAliases: ['admin_demo'],
  },
  {
    id: SYNTHETIC_DEMO_ACCOUNTS.lecturer.user.id,
    name: SYNTHETIC_DEMO_ACCOUNTS.lecturer.user.name,
    username: 'lecturer_demo',
    email: SYNTHETIC_DEMO_ACCOUNTS.lecturer.user.email,
    phone: '01010000002',
    jobTitle: SYNTHETIC_DEMO_ACCOUNTS.lecturer.user.jobTitle,
    department: SYNTHETIC_DEMO_ACCOUNTS.lecturer.user.department,
    role: 'lecturer',
    status: 'active',
    createdAt: '2025-01-05T00:00:00Z',
    lastLogin: '2026-03-01T09:30:00Z',
    legacyAliases: ['lecturer_demo'],
  },
  {
    id: SYNTHETIC_DEMO_ACCOUNTS.trainee.user.id,
    name: SYNTHETIC_DEMO_ACCOUNTS.trainee.user.name,
    username: 'trainee_demo',
    email: SYNTHETIC_DEMO_ACCOUNTS.trainee.user.email,
    phone: '01010000003',
    jobTitle: SYNTHETIC_DEMO_ACCOUNTS.trainee.user.jobTitle,
    department: SYNTHETIC_DEMO_ACCOUNTS.trainee.user.department,
    role: 'user',
    status: 'active',
    createdAt: '2025-01-10T00:00:00Z',
    lastLogin: '2026-03-01T10:15:00Z',
    legacyAliases: ['trainee_demo'],
  },

  // ── 12 Legacy Employees (Sanitized from data/users.json) ─────────────
  {
    id: 'USR001',
    name: 'أحمد محمود علي',
    username: 'admin',
    email: 'ahmed.ali@cairo-metro.com',
    phone: '01001234567',
    jobTitle: 'مدير النظام',
    department: 'إدارة تكنولوجيا المعلومات',
    role: 'admin',
    status: 'active',
    createdAt: '2025-01-01',
    lastLogin: '2025-09-25T08:00:00',
    legacyAliases: ['usr001'],
  },
  {
    id: 'USR002',
    name: 'م. خالد إبراهيم',
    username: 'lecturer',
    email: 'khaled.ibrahim@cairo-metro.com',
    phone: '01098765432',
    jobTitle: 'مهندس تدريب أول',
    department: 'إدارة التدريب',
    role: 'lecturer',
    status: 'active',
    createdAt: '2025-01-05',
    lastLogin: '2025-09-24T14:30:00',
    legacyAliases: ['usr002'],
  },
  {
    id: 'USR003',
    name: 'محمد أحمد السيد',
    username: 'user',
    email: 'mohamed.elsayed@cairo-metro.com',
    phone: '01012345678',
    jobTitle: 'مهندس تشغيل',
    department: 'قطاع التشغيل',
    role: 'user',
    status: 'active',
    createdAt: '2025-01-15',
    lastLogin: '2025-09-20T10:30:00',
    legacyAliases: ['usr003'],
  },
  {
    id: 'USR004',
    name: 'عبدالرحمن حسن محمود',
    username: 'abdulrahman',
    email: 'abdulrahman@cairo-metro.com',
    phone: '01112233445',
    jobTitle: 'فني صيانة',
    department: 'قطاع الصيانة',
    role: 'user',
    status: 'active',
    createdAt: '2025-02-10',
    lastLogin: '2025-09-19T09:15:00',
    legacyAliases: ['usr004'],
  },
  {
    id: 'USR005',
    name: 'حسام الدين عبدالله',
    username: 'hossam',
    email: 'hossam@cairo-metro.com',
    phone: '01223344556',
    jobTitle: 'سائق قطار',
    department: 'قطاع التشغيل',
    role: 'user',
    status: 'active',
    createdAt: '2025-02-20',
    lastLogin: '2025-09-22T06:45:00',
    legacyAliases: ['usr005'],
  },
  {
    id: 'USR006',
    name: 'ياسر إبراهيم عبدالعزيز',
    username: 'yasser',
    email: 'yasser@cairo-metro.com',
    phone: '01334455667',
    jobTitle: 'مشرف محطة',
    department: 'قطاع التشغيل',
    role: 'user',
    status: 'active',
    createdAt: '2025-03-01',
    lastLogin: '2025-09-21T11:20:00',
    legacyAliases: ['usr006'],
  },
  {
    id: 'USR007',
    name: 'نورهان سعيد محمد',
    username: 'nourhan',
    email: 'nourhan@cairo-metro.com',
    phone: '01445566778',
    jobTitle: 'موظف خدمة عملاء',
    department: 'قطاع خدمة العملاء',
    role: 'user',
    status: 'active',
    createdAt: '2025-03-10',
    lastLogin: '2025-09-23T13:00:00',
    legacyAliases: ['usr007'],
  },
  {
    id: 'USR008',
    name: 'طارق عبدالفتاح رمضان',
    username: 'tarek',
    email: 'tarek@cairo-metro.com',
    phone: '01556677889',
    jobTitle: 'مهندس كهرباء',
    department: 'قطاع الصيانة الكهربائية',
    role: 'user',
    status: 'active',
    createdAt: '2025-03-15',
    lastLogin: '2025-09-18T08:30:00',
    legacyAliases: ['usr008'],
  },
  {
    id: 'USR009',
    name: 'مصطفى كمال الشريف',
    username: 'mostafa',
    email: 'mostafa@cairo-metro.com',
    phone: '01667788990',
    jobTitle: 'فني إشارات',
    department: 'قطاع الإشارات والاتصالات',
    role: 'user',
    status: 'active',
    createdAt: '2025-04-01',
    lastLogin: '2025-09-17T07:00:00',
    legacyAliases: ['usr009'],
  },
  {
    id: 'USR010',
    name: 'سامح عادل إسماعيل',
    username: 'sameh',
    email: 'sameh@cairo-metro.com',
    phone: '01778899001',
    jobTitle: 'مشرف أمن',
    department: 'قطاع الأمن',
    role: 'user',
    status: 'active',
    createdAt: '2025-04-10',
    lastLogin: '2025-09-20T16:45:00',
    legacyAliases: ['usr010'],
  },
  {
    id: 'USR011',
    name: 'عمرو جمال عبدالناصر',
    username: 'amr',
    email: 'amr@cairo-metro.com',
    phone: '01889900112',
    jobTitle: 'مهندس ميكانيكا',
    department: 'قطاع الصيانة الميكانيكية',
    role: 'user',
    status: 'suspended',
    createdAt: '2025-05-01',
    lastLogin: '2025-08-15T10:00:00',
    legacyAliases: ['usr011'],
  },
  {
    id: 'USR012',
    name: 'فاطمة حسين أحمد',
    username: 'fatma',
    email: 'fatma@cairo-metro.com',
    phone: '01990011223',
    jobTitle: 'موظف إداري',
    department: 'الإدارة العامة',
    role: 'user',
    status: 'active',
    createdAt: '2025-05-15',
    lastLogin: '2025-09-24T09:30:00',
    legacyAliases: ['usr012'],
  },
];

/**
 * Explicit map of legacy and alternative identifiers to canonical user IDs.
 * Resolved deterministically and case-insensitively.
 */
export const USER_ALIAS_MAP: Record<string, string> = {
  // Lowercased legacy IDs
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

  // Uppercased legacy IDs
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
  USR016: 'USR016',
  usr016: 'USR016',
  assistant_admin_demo: 'USR016',
  USR017: 'USR017',
  usr017: 'USR017',
  assistant_lecturer_demo: 'USR017',

  // Active demo personas (canonical IDs map to themselves)
  usr_admin_001: 'usr_admin_001',
  usr_lect_002: 'usr_lect_002',
  usr_trainee_003: 'usr_trainee_003',
};

/**
 * Resolves any legacy identifier or canonical ID to its canonical directory user ID.
 * Case-insensitive lookup with collision detection.
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

  // 2. Direct match against canonical user list
  const foundUser = INITIAL_MANAGED_USERS.find(
    (u) =>
      u.id.toLowerCase() === lower ||
      u.username.toLowerCase() === lower ||
      u.legacyAliases?.some((a) => a.toLowerCase() === lower)
  );

  if (foundUser) {
    return foundUser.id;
  }

  // 3. Direct match against synthetic demo accounts
  const demoAccount = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find(
    (acc) =>
      acc.user.id.toLowerCase() === lower ||
      acc.credentials.email.toLowerCase() === lower ||
      (acc.user.email && acc.user.email.toLowerCase() === lower)
  );
  if (demoAccount) {
    return demoAccount.user.id;
  }

  // 4. Unresolved identifier is returned trimmed
  return trimmed;
}
