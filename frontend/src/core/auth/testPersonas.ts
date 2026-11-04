/**
 * MetroLMS — Synthetic Test Persona Registry
 *
 * Authoritative Governance Reference:
 * - MetroLMS Pre-Backend Migration Remediation Roadmap — Revision 5:
 *   - Section 3: Developer Confidentiality and Secure Provisioning
 *   - Section 4: Developer Preview and Isolated Role Testing (Decision D-10)
 *   - Stable Finding MFR-40: Separation of visual Role Preview from isolated role-testing sessions
 *   - Invariant INV-D10-1: Strict Synthetic Persona Allowlist
 *   - Invariant INV-P5-3: Test Persona Least Privilege
 *
 * STRICT GOVERNANCE RULES:
 * 1. Exactly the five approved synthetic test personas are registered.
 * 2. Real employees, lecturers, administrators, or trainees must NEVER be added to this registry.
 * 3. Prefix-only matching (e.g. testing if an ID starts with `USR_TEST_`) is STRICTLY PROHIBITED.
 *    Target personas must be resolved exclusively via the allowlist registry.
 * 4. Gated strictly to development environments (`import.meta.env.DEV === true`).
 *    In production builds, the registry evaluates to an empty frozen structure.
 * 5. `assistant_lecturer` is NOT a global synthetic account role; it remains a group-scoped
 *    assignment model handled through group domain relationships.
 */

import type { User, UserRole, LoginCredentials } from './types';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';

/**
 * Authoritative Canonical Developer User ID (Invariants INV-R1 and INV-R8)
 * Only this canonical identity is authorized to launch or restore isolated role test sessions.
 */
export const CANONICAL_DEVELOPER_ID = 'USR_DEV_001';

export interface SyntheticTestPersona {
  /** Canonical test user identifier (e.g. USR_TEST_SUPER_001) */
  id: string;
  /** Unique username for test authentication */
  username: string;
  /** Full Arabic display name for UI presentation */
  name: string;
  /** Synthetic contact email */
  email: string;
  /** Actual canonical role exercised by this persona */
  role: UserRole;
  /** Department affiliation */
  department: string;
  /** Official job title */
  jobTitle: string;
  /** Two-letter Arabic initials */
  initials: string;
  /** Dedicated test credentials for genuine mock-login */
  credentials: LoginCredentials;
  /** Formatted Arabic role description */
  descriptionAr: string;
  /** Whether this persona is active and permitted for testing */
  status: 'active' | 'suspended';
  /** Explicit synthetic flag */
  isSynthetic: true;
}

/**
 * Raw definition of the 5 approved synthetic personas.
 */
const BASE_TEST_PERSONAS: Record<string, SyntheticTestPersona> = {
  USR_TEST_SUPER_001: {
    id: 'USR_TEST_SUPER_001',
    username: 'test_super_admin',
    name: 'حساب اختباري — مدير عام النظام',
    email: 'test.superadmin@cairo-metro.internal',
    role: 'super_admin',
    department: 'الإدارة العليا — قطاع الاختبارات والتأهيل',
    jobTitle: 'المدير العام (بيئة الاختبار)',
    initials: 'س.أ',
    credentials: {
      email: 'test.superadmin@cairo-metro.internal',
      password: 'MetroTestSuperAdmin2026!',
    },
    descriptionAr: 'اختبار صلاحيات الإدارة العليا الكاملة وإدارة المشرفين والحوكمة',
    status: 'active',
    isSynthetic: true,
  },
  USR_TEST_ADMIN_001: {
    id: 'USR_TEST_ADMIN_001',
    username: 'test_admin',
    name: 'حساب اختباري — مدير النظام',
    email: 'test.admin@cairo-metro.internal',
    role: 'admin',
    department: 'الإدارة العامة للتشغيل والتحكم المركزي',
    jobTitle: 'مدير النظام (بيئة الاختبار)',
    initials: 'م.ن',
    credentials: {
      email: 'test.admin@cairo-metro.internal',
      password: 'MetroTestAdmin2026!',
    },
    descriptionAr: 'اختبار صلاحيات إدارة المجموعات، اعتماد المقررات، وإدارة المستخدمين',
    status: 'active',
    isSynthetic: true,
  },
  USR_TEST_AST_001: {
    id: 'USR_TEST_AST_001',
    username: 'test_assistant_admin',
    name: 'حساب اختباري — مساعد مدير نظام',
    email: 'test.assistant.admin@cairo-metro.internal',
    role: 'assistant_admin',
    department: 'الإدارة العامة لتكنولوجيا المعلومات',
    jobTitle: 'مساعد مدير نظام (بيئة الاختبار)',
    initials: 'م.د',
    credentials: {
      email: 'test.assistant.admin@cairo-metro.internal',
      password: 'MetroTestAssistantAdmin2026!',
    },
    descriptionAr: 'اختبار العمليات التشغيلية والإدارية المقيدة التي تتطلب اعتمادات عليا',
    status: 'active',
    isSynthetic: true,
  },
  USR_TEST_LEC_001: {
    id: 'USR_TEST_LEC_001',
    username: 'test_lecturer',
    name: 'حساب اختباري — محاضر معتمد',
    email: 'test.lecturer@cairo-metro.internal',
    role: 'lecturer',
    department: 'مركز تدريب وإعداد القادة بمترو القاهرة',
    jobTitle: 'محاضر ومدرب معتمد (بيئة الاختبار)',
    initials: 'م.م',
    credentials: {
      email: 'test.lecturer@cairo-metro.internal',
      password: 'MetroTestLecturer2026!',
    },
    descriptionAr: 'اختبار منشئ المقررات، رفع الوسائط، وإرسال المناهج للمراجعة والاعتماد',
    status: 'active',
    isSynthetic: true,
  },
  USR_TEST_TRN_001: {
    id: 'USR_TEST_TRN_001',
    username: 'test_trainee',
    name: 'حساب اختباري — متدرب ميداني',
    email: 'test.trainee@cairo-metro.internal',
    role: 'user',
    department: 'قطاع صيانة الوحدات المتحركة — الخط الأول',
    jobTitle: 'متدرب فني (بيئة الاختبار)',
    initials: 'م.ت',
    credentials: {
      email: 'test.trainee@cairo-metro.internal',
      password: 'MetroTestTrainee2026!',
    },
    descriptionAr: 'اختبار مشغل الدروس التفاعلي، استعراض الدليل، والتسجيل في البرامج التدريبية',
    status: 'active',
    isSynthetic: true,
  },
};

/**
 * Authoritative Allowlist Registry for Isolated Role Testing (`اختبار الصلاحيات`)
 *
 * GATED: Strictly empty in non-development environments to prevent any test persona
 * provisioning or leakage into production builds.
 */
export const SYNTHETIC_TEST_PERSONA_REGISTRY: Record<string, SyntheticTestPersona> =
  import.meta.env.DEV ? Object.freeze({ ...BASE_TEST_PERSONAS }) : Object.freeze({});

/**
 * Resolves a test persona by its canonical ID or username against the strict allowlist registry.
 *
 * Strict validation:
 * 1. Gated to development environment only.
 * 2. Rejects arbitrary IDs, real account IDs, or unregistered synthetic IDs.
 * 3. Does not use prefix matching.
 * 4. Ensures the resolved persona is active and explicitly synthetic.
 */
export function getSyntheticTestPersona(identifier: string | undefined | null): SyntheticTestPersona | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  if (!identifier || typeof identifier !== 'string') {
    return null;
  }

  const normalized = identifier.trim().toLowerCase();

  // Look up in the explicit registry
  const match = Object.values(SYNTHETIC_TEST_PERSONA_REGISTRY).find(
    (persona) =>
      persona.id.toLowerCase() === normalized ||
      persona.username.toLowerCase() === normalized ||
      persona.email.toLowerCase() === normalized
  );

  if (!match) {
    return null;
  }

  // Verify status and synthetic flag
  if (match.status !== 'active' || !match.isSynthetic) {
    return null;
  }

  return match;
}

/**
 * Returns the list of all active synthetic test personas available in development mode.
 */
export function getSyntheticTestPersonas(): SyntheticTestPersona[] {
  if (!import.meta.env.DEV) {
    return [];
  }
  return Object.values(SYNTHETIC_TEST_PERSONA_REGISTRY).filter((p) => p.status === 'active');
}

/**
 * Converts a SyntheticTestPersona to a standard User representation.
 */
export function personaToUser(persona: SyntheticTestPersona): User {
  return {
    id: persona.id,
    name: persona.name,
    email: persona.email,
    role: persona.role,
    department: persona.department,
    jobTitle: persona.jobTitle,
    initials: persona.initials,
  };
}

/**
 * Helper to get Arabic display role for a test persona
 */
export function getPersonaRoleLabelAr(persona: SyntheticTestPersona): string {
  return ROLE_CANONICAL_LABELS_AR[persona.role] || persona.role;
}

