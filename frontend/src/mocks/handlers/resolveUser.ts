import { SYNTHETIC_DEMO_ACCOUNTS } from '../fixtures/mockUsers';
import { authStorage } from '@/core/auth/authStorage';
import type { User } from '@/core/auth/types';
import { inMemoryStore } from '../store/inMemoryStore';
import { resolveCanonicalUserId } from '@/core/auth/canonicalIdentity';

/**
 * Explicit allowlist of controlled test fixture personas permitted to authenticate
 * strictly in development and testing environments where synthetic demo or directory users are not utilized.
 * In production mode (`import.meta.env.DEV === false`), this evaluates to an empty object,
 * guaranteeing zero fixture identity fallbacks in production bundles.
 */
export const CONTROLLED_TEST_FIXTURE_USERS: Record<string, User> = import.meta.env.DEV
  ? {
      'usr-1': {
        id: 'usr-1',
        name: 'م. أحمد ممدوح',
        email: 'ahmed.mamdouh@cairometro.gov.eg',
        role: 'admin',
        department: 'الإدارة المركزية للتشغيل',
        jobTitle: 'مدير عام التشغيل والتدريب',
        initials: 'أم',
      },
      'usr-lec-1': {
        id: 'usr-lec-1',
        name: 'م. محمد السيد',
        email: 'mohamed@metro.local',
        role: 'lecturer',
        department: 'هندسة الإشارات والتحكم',
        jobTitle: 'محاضر معتمد',
        initials: 'MS',
      },
      usr_lect_999: {
        id: 'usr_lect_999',
        name: 'م. عصام الشريف',
        email: 'other_lecturer@cairo-metro.com',
        role: 'lecturer',
        department: 'إدارة الورش الميكانيكية',
        jobTitle: 'مدرب صيانة الوحدات',
        initials: 'ع.ش',
      },
      usr_trainee_999: {
        id: 'usr_trainee_999',
        name: 'خالد عبد الرازق',
        email: 'outsider@cairo-metro.com',
        role: 'user',
        department: 'هندسة السكة والإنشاءات',
        jobTitle: 'فني سكة حديد',
        initials: 'خ.ع',
      },
      USR099_STRANGER: {
        id: 'USR099_STRANGER',
        name: 'متدرب خارجي',
        email: 'stranger@metro.gov.eg',
        role: 'user',
        department: 'التشغيل والصيانة',
        jobTitle: 'متدرب',
        initials: 'م.خ',
      },
      usr_unrelated_lecturer: {
        id: 'usr_unrelated_lecturer',
        name: 'محاضر غير مسند',
        email: 'unrelated@metro.gov.eg',
        role: 'lecturer',
        department: 'التدريب',
        jobTitle: 'محاضر',
        initials: 'م.غ',
      },
      USR_SUPER_001: {
        id: 'USR_SUPER_001',
        name: 'م. ياسين رضوان',
        email: 'superadmin@cairo-metro.com',
        role: 'super_admin' as const,
        department: 'الإدارة العليا',
        jobTitle: 'المسؤول الأعلى للأنظمة',
        initials: 'ي.ر',
      },
      USR_DEV_001: {
        id: 'USR_DEV_001',
        name: 'مطور النظام',
        email: 'developer.metro@internal.local',
        role: 'developer' as const,
        department: 'هندسة البرمجيات والتطوير',
        jobTitle: 'كبير مهندسي النظام',
        initials: 'م.ن',
      },
    }
  : {};

/**
 * Test helper to resolve controlled test fixtures for a target environment mode
 * without mutating Vite runtime globals.
 */
export function getControlledTestFixtures(
  envMode: 'development' | 'production' = import.meta.env.DEV ? 'development' : 'production'
): Record<string, User> {
  if (envMode === 'development') {
    return { ...CONTROLLED_TEST_FIXTURE_USERS };
  }
  return {};
}

/**
 * Computes user initials from full name for display avatars
 */
export function computeInitials(name: string): string {
  if (!name) return 'م';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return (parts[0] || '').slice(0, 2);
  return `${parts[0][0] || ''}.${parts[1][0] || ''}`;
}

/**
 * Maps a managed user DTO to a session User object
 */
export function mapManagedUserToAuthUser(managedUser: {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  jobTitle?: string;
}): User {
  return {
    id: managedUser.id,
    name: managedUser.name,
    email: managedUser.email,
    role: managedUser.role as User['role'],
    department: managedUser.department || 'قطاع التشغيل',
    jobTitle: managedUser.jobTitle || 'موظف',
    initials: computeInitials(managedUser.name),
  };
}

/**
 * Resolves the authenticated User from the Authorization Bearer token header.
 * Strictly prevents hardcoding client-supplied identities.
 * Authoritative single resolver across all MSW mock handlers.
 */
export function resolveAuthenticatedUser(request: Request): User | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  // 1. Check active session storage if available
  try {
    const session = authStorage.getSession();
    if (session && session.token === token && session.user) {
      if (!session.user.id || typeof session.user.id !== 'string' || !session.user.id.trim()) {
        return null;
      }

      // Check tombstones on stored user
      if (inMemoryStore.isUserTombstoned(session.user.id)) {
        return null;
      }
      const canonicalId = resolveCanonicalUserId(session.user.id);
      if (inMemoryStore.isUserTombstoned(canonicalId)) {
        return null;
      }

      // Authoritative status verification: reject suspended or deleted accounts
      const authoritativeUser = inMemoryStore.getManagedUserById(canonicalId);
      if (authoritativeUser) {
        if (authoritativeUser.status === 'suspended') {
          return null;
        }
        // Central directory is authoritative for identity and role
        return {
          ...session.user,
          id: authoritativeUser.id,
          role: authoritativeUser.role,
        };
      }

      // Check if synthetic demo account
      const matchedDemo = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find(
        (acc) =>
          acc.user.id.toLowerCase() === session.user.id.toLowerCase() ||
          acc.user.id.toLowerCase() === canonicalId.toLowerCase()
      );
      if (matchedDemo) {
        if (inMemoryStore.isUserTombstoned(matchedDemo.user.id)) {
          return null;
        }
        return {
          ...session.user,
          id: matchedDemo.user.id,
          role: matchedDemo.user.role,
        };
      }

      // Check explicitly permitted controlled test fixture accounts
      const matchedFixture =
        CONTROLLED_TEST_FIXTURE_USERS[canonicalId] ||
        CONTROLLED_TEST_FIXTURE_USERS[session.user.id];
      if (matchedFixture) {
        if (inMemoryStore.isUserTombstoned(matchedFixture.id)) {
          return null;
        }
        return {
          ...session.user,
          id: matchedFixture.id,
          role: matchedFixture.role,
        };
      }

      // Unknown, deleted, or unverified session identity: reject strictly
      return null;
    }
  } catch {
    // Non-browser or storage restricted environment; proceed to token resolution
  }

  // 2. Determine user identity from token
  let candidateUserId: string | null = null;

  if (token.startsWith('mock_jwt_')) {
    let rest = token.replace(/^mock_jwt_/, '');
    // Strip trailing timestamp (_1730300400000) or test suffix (_test) if present
    rest = rest.replace(/_\d{8,}$/, '').replace(/_test$/, '');
    candidateUserId = rest;
  } else if (token === 'valid-test-token') {
    candidateUserId = SYNTHETIC_DEMO_ACCOUNTS.trainee.user.id;
  } else {
    // Check if token matches known synthetic demo account IDs or test keys
    for (const [key, acc] of Object.entries(SYNTHETIC_DEMO_ACCOUNTS)) {
      if (
        token.includes(acc.user.id) ||
        token === `${key}-token` ||
        token === `${key}-test-token` ||
        token.startsWith(`${key}-`)
      ) {
        candidateUserId = acc.user.id;
        break;
      }
    }

    if (!candidateUserId) {
      // Check if token itself is a known user ID or alias in the store
      const managed = inMemoryStore.getManagedUserById(token);
      if (managed) {
        candidateUserId = managed.id;
      }
    }
  }

  if (!candidateUserId) {
    return null;
  }

  // 3. Check tombstones: permanently deleted users cannot authenticate
  if (inMemoryStore.isUserTombstoned(candidateUserId)) {
    return null;
  }

  const canonicalId = resolveCanonicalUserId(candidateUserId);
  if (inMemoryStore.isUserTombstoned(canonicalId)) {
    return null;
  }

  // 4. Resolve against authoritative inMemoryStore central directory
  const authoritativeUser = inMemoryStore.getManagedUserById(canonicalId);
  if (authoritativeUser) {
    if (authoritativeUser.status === 'suspended') {
      return null;
    }
    return mapManagedUserToAuthUser(authoritativeUser);
  }

  // 5. Match dedicated synthetic demo accounts where explicitly valid
  const demoAccount = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find(
    (acc) =>
      acc.user.id.toLowerCase() === candidateUserId!.toLowerCase() ||
      acc.user.id.toLowerCase() === canonicalId.toLowerCase()
  );

  if (demoAccount) {
    return demoAccount.user;
  }

  // 6. Match explicitly permitted controlled test fixture accounts
  const fixtureAccount =
    CONTROLLED_TEST_FIXTURE_USERS[canonicalId] ||
    CONTROLLED_TEST_FIXTURE_USERS[candidateUserId!];

  if (fixtureAccount) {
    if (inMemoryStore.isUserTombstoned(fixtureAccount.id)) {
      return null;
    }
    return fixtureAccount;
  }

  // Unknown tokens must strictly return null - NEVER silently fall back to trainee!
  return null;
}
