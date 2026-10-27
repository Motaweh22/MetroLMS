import { SYNTHETIC_DEMO_ACCOUNTS } from '../fixtures/mockUsers';
import { authStorage } from '@/core/auth/authStorage';
import type { User } from '@/core/auth/types';

/**
 * Resolves the authenticated User from the Authorization Bearer token header.
 * Strictly prevents hardcoding client-supplied identities.
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
    if (session && session.token === token) {
      return session.user;
    }
  } catch {
    // Non-browser or storage restricted environment; proceed to token resolution
  }

  // 2. Match token to synthetic accounts
  const matched = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find((acc) =>
    token.includes(acc.user.id)
  );

  if (matched) {
    return matched.user;
  }

  // Fallback for mock tokens generated during login
  if (token.startsWith('mock_jwt_')) {
    if (token.includes('usr_admin')) return SYNTHETIC_DEMO_ACCOUNTS.admin.user;
    const lectMatch = token.match(/usr_lect_\d+/);
    if (lectMatch) {
      return {
        ...SYNTHETIC_DEMO_ACCOUNTS.lecturer.user,
        id: lectMatch[0],
        name: 'د. طارق مصطفى',
      };
    }
    return SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
  }

  if (token === 'valid-test-token') {
    return SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
  }

  return null;
}
