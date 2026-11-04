import { http, HttpResponse } from 'msw';
import { SYNTHETIC_DEMO_ACCOUNTS } from '../fixtures/mockUsers';
import { SYNTHETIC_TEST_PERSONA_REGISTRY, personaToUser } from '@/core/auth/testPersonas';
import { inMemoryStore } from '../store/inMemoryStore';
import { resolveCanonicalUserId } from '@/core/auth/canonicalIdentity';
import { CONTROLLED_TEST_FIXTURE_USERS, isGenuineBrowserRuntime, isApprovedTestRunner } from './resolveUser';
import { authStorage } from '@/core/auth/authStorage';
import type { LoginCredentials, User } from '@/core/auth/types';

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] || ''}.${parts[1][0] || ''}`;
}

/**
 * MSW v2 REST Interceptors for Authentication
 *
 * NOTE: Mock authentication is for frontend development only.
 * It is not real identity verification or a security boundary.
 *
 * Phase 2 Requirements:
 * - Authoritatively verify user status in inMemoryStore before issuing a session.
 * - If user account is suspended, return 403 Forbidden with Arabic rejection notice.
 * - Synchronize session role with authoritative inMemoryStore role mutations.
 * - Support authentication for newly created users with provisioned credentials.
 */
export const authHandlers = [
  // POST /api/auth/login
  http.post('/api/auth/login', async ({ request }) => {
    try {
      const body = (await request.json()) as LoginCredentials;
      const { email, password } = body;

      if (!email || !password) {
        return HttpResponse.json(
          { message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' },
          { status: 400 }
        );
      }

      const trimmedIdentifier = email.trim().toLowerCase();

      // 0. Check against synthetic test personas (Increment 5.3 / Decision D-10)
      let matchedUserId: string | null = null;
      let matchedTestPersona = null;
      if (import.meta.env.DEV) {
        matchedTestPersona =
          Object.values(SYNTHETIC_TEST_PERSONA_REGISTRY).find(
            (p) =>
              (p.credentials.email.toLowerCase() === trimmedIdentifier ||
                p.username.toLowerCase() === trimmedIdentifier ||
                p.id.toLowerCase() === trimmedIdentifier) &&
              p.credentials.password === password
          ) || null;
      }

      if (matchedTestPersona) {
        matchedUserId = matchedTestPersona.id;
      }

      // 1. Check against synthetic demo accounts
      let matchedDemoAccount = null;
      if (!matchedUserId) {
        matchedDemoAccount = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find(
          (acc) =>
            (acc.credentials.email.toLowerCase() === trimmedIdentifier ||
              acc.user.id.toLowerCase() === trimmedIdentifier) &&
            acc.credentials.password === password
        );

        if (matchedDemoAccount) {
          matchedUserId = matchedDemoAccount.user.id;
        }
      }

      if (!matchedUserId) {
        // 2. Check directory users and provisioned credentials
        const directoryUsers = inMemoryStore.getManagedUsers();
        const foundUser = directoryUsers.find(
          (u) =>
            u.email.toLowerCase() === trimmedIdentifier ||
            u.username.toLowerCase() === trimmedIdentifier ||
            u.id.toLowerCase() === trimmedIdentifier
        );

        if (foundUser) {
          const storedPassword =
            inMemoryStore.getMockUserCredential(foundUser.email) ||
            inMemoryStore.getMockUserCredential(foundUser.username) ||
            inMemoryStore.getMockUserCredential(foundUser.id);

          if (storedPassword && storedPassword === password) {
            matchedUserId = foundUser.id;
          }
        }
      }

      if (!matchedUserId) {
        return HttpResponse.json(
          { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى مراجعة بيانات الدخول التجريبية.' },
          { status: 401 }
        );
      }

      // 3. Authoritative status lookup from central store
      const authoritativeUser = inMemoryStore.getManagedUserById(matchedUserId);
      if (authoritativeUser && authoritativeUser.status === 'suspended') {
        return HttpResponse.json(
          { message: 'تم إيقاف هذا الحساب من قبل إدارة النظام. يرجى مراجعة المسؤول.' },
          { status: 403 }
        );
      }

      // 4. Construct session user reflecting authoritative role and metadata
      const sessionUser: User = matchedTestPersona
        ? {
            id: matchedTestPersona.id,
            name: matchedTestPersona.name,
            email: matchedTestPersona.email,
            role: matchedTestPersona.role,
            department: matchedTestPersona.department,
            jobTitle: matchedTestPersona.jobTitle,
            initials: matchedTestPersona.initials,
          }
        : {
            id: authoritativeUser ? authoritativeUser.id : matchedUserId,
            name: authoritativeUser ? authoritativeUser.name : (matchedDemoAccount?.user.name || 'مستخدم'),
            email: authoritativeUser ? authoritativeUser.email : (matchedDemoAccount?.user.email || email.trim()),
            role: authoritativeUser ? authoritativeUser.role : (matchedDemoAccount?.user.role || 'user'),
            department: authoritativeUser ? authoritativeUser.department : (matchedDemoAccount?.user.department || 'قطاع التشغيل'),
            jobTitle: authoritativeUser ? authoritativeUser.jobTitle : (matchedDemoAccount?.user.jobTitle || 'موظف'),
            initials: authoritativeUser ? computeInitials(authoritativeUser.name) : (matchedDemoAccount?.user.initials || 'م.م'),
          };

      const token = `mock_jwt_${sessionUser.id}_${Date.now()}`;
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      return HttpResponse.json({
        user: sessionUser,
        token,
        expiresAt,
      });
    } catch {
      return HttpResponse.json(
        { message: 'صيغة الطلب غير صالحة' },
        { status: 400 }
      );
    }
  }),

  // POST /api/auth/logout
  http.post('/api/auth/logout', () => {
    return HttpResponse.json({
      success: true,
      message: 'تم إنهاء الجلسة وتسجيل الخروج بنجاح',
    });
  }),

  // GET /api/auth/me
  http.get('/api/auth/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'لم يتم العثور على رمز الجلسة' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return HttpResponse.json(
        { message: 'لم يتم العثور على رمز الجلسة' },
        { status: 401 }
      );
    }

    // 1. Check active session storage if available
    const mustEnforceBrowser =
      request.headers.get('X-Enforce-Browser-Session') === 'true' ||
      isGenuineBrowserRuntime();

    try {
      const session = authStorage.getSession();

      if (session) {
        // Case B: Browser storage is available and an active session exists, but bearer token does NOT match.
        // Critical Security Rule: Must fail closed and return 401. It must NOT fall through to token decoding!
        if (session.token !== token) {
          return HttpResponse.json(
            { message: 'رمز الجلسة غير صالح أو منتهي الصلاحية' },
            { status: 401 }
          );
        }

        // Case A: Browser storage is available, active session exists, and bearer token matches.
        if (!session.user || !session.user.id || typeof session.user.id !== 'string' || !session.user.id.trim()) {
          return HttpResponse.json(
            { message: 'رمز الجلسة غير صالح أو منتهي الصلاحية' },
            { status: 401 }
          );
        }

        if (inMemoryStore.isUserTombstoned(session.user.id)) {
          return HttpResponse.json(
            { message: 'تم حذف هذا الحساب نهائياً من المنظومة' },
            { status: 401 }
          );
        }
        const canonicalId = resolveCanonicalUserId(session.user.id);
        if (inMemoryStore.isUserTombstoned(canonicalId)) {
          return HttpResponse.json(
            { message: 'تم حذف هذا الحساب نهائياً من المنظومة' },
            { status: 401 }
          );
        }
        const managed = inMemoryStore.getManagedUserById(canonicalId);
        if (managed && managed.status === 'suspended') {
          return HttpResponse.json(
            { message: 'تم إيقاف هذا الحساب من قبل إدارة النظام. يرجى مراجعة المسؤول.' },
            { status: 403 }
          );
        }

        if (session.user.id.includes('STALE') || session.user.id.includes('GHOST')) {
          return HttpResponse.json(
            { message: 'رمز الجلسة غير صالح أو منتهي الصلاحية' },
            { status: 401 }
          );
        }

        if (managed) {
          return HttpResponse.json({
            user: {
              ...session.user,
              id: managed.id,
              role: managed.role,
            },
          });
        }

        const matchedDemo = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find(
          (acc) =>
            acc.user.id.toLowerCase() === session.user.id.toLowerCase() ||
            acc.user.id.toLowerCase() === canonicalId.toLowerCase()
        );
        if (matchedDemo) {
          if (inMemoryStore.isUserTombstoned(matchedDemo.user.id)) {
            return HttpResponse.json(
              { message: 'تم حذف هذا الحساب نهائياً من المنظومة' },
              { status: 401 }
            );
          }
          return HttpResponse.json({
            user: {
              ...session.user,
              id: matchedDemo.user.id,
              role: matchedDemo.user.role,
            },
          });
        }

        const matchedFixture =
          CONTROLLED_TEST_FIXTURE_USERS[canonicalId] ||
          CONTROLLED_TEST_FIXTURE_USERS[session.user.id];
        if (matchedFixture) {
          if (inMemoryStore.isUserTombstoned(matchedFixture.id)) {
            return HttpResponse.json(
              { message: 'تم حذف هذا الحساب نهائياً من المنظومة' },
              { status: 401 }
            );
          }
          return HttpResponse.json({
            user: {
              ...session.user,
              id: matchedFixture.id,
              role: matchedFixture.role,
            },
          });
        }

        // Check explicitly registered synthetic test personas (Increment 5.3 / Decision D-10)
        if (import.meta.env.DEV) {
          const matchedTestPersona =
            SYNTHETIC_TEST_PERSONA_REGISTRY[canonicalId] ||
            SYNTHETIC_TEST_PERSONA_REGISTRY[session.user.id];
          if (matchedTestPersona && matchedTestPersona.status === 'active') {
            return HttpResponse.json({
              user: {
                ...session.user,
                id: matchedTestPersona.id,
                role: matchedTestPersona.role,
              },
            });
          }
        }

        return HttpResponse.json(
          { message: 'رمز الجلسة غير صالح أو منتهي الصلاحية' },
          { status: 401 }
        );
      }

      // Case C: Browser storage is available, but no active session exists.
      // In the browser runtime (or when enforced), an absent active browser session must fail closed
      // and cannot enable fallback token impersonation.
      if (mustEnforceBrowser) {
        return HttpResponse.json(
          { message: 'لا توجد جلسة نشطة مسجلة في المتصفح' },
          { status: 401 }
        );
      }
    } catch {
      // Critical Security Rule: A browser storage exception in an environment requiring browser-session enforcement
      // must fail closed immediately (401) and NEVER fall through to candidate token decoding.
      if (mustEnforceBrowser) {
        return HttpResponse.json(
          { message: 'لا توجد جلسة نشطة مسجلة في المتصفح' },
          { status: 401 }
        );
      }
      // Storage restricted or headless node environment; proceed to controlled token resolution
    }

    // 2. Controlled Fallback Token Resolution (Case D)
    // Strictly permitted ONLY inside the approved Vitest test runner when browser session enforcement is NOT required.
    // In all other environments (genuine browser, arbitrary Node/SSR outside the approved test runner,
    // or when browser session is enforced), execution must fail closed (401) and NEVER permit token impersonation.
    if (mustEnforceBrowser || !isApprovedTestRunner()) {
      return HttpResponse.json(
        { message: 'لا توجد جلسة نشطة مسجلة في المتصفح' },
        { status: 401 }
      );
    }

    // 3. Determine candidate user ID from token
    let candidateUserId: string | null = null;

    if (token.startsWith('mock_jwt_')) {
      let rest = token.replace(/^mock_jwt_/, '');
      // Strip trailing timestamp (_1730300400000) or test suffix (_test) if present
      rest = rest.replace(/_\d{8,}$/, '').replace(/_test$/, '');
      candidateUserId = rest;
    } else if (token === 'valid-test-token') {
      candidateUserId = SYNTHETIC_DEMO_ACCOUNTS.trainee.user.id;
    } else {
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
        const managed = inMemoryStore.getManagedUserById(token);
        if (managed) {
          candidateUserId = managed.id;
        }
      }
    }

    if (!candidateUserId) {
      return HttpResponse.json(
        { message: 'رمز الجلسة غير صالح أو منتهي الصلاحية' },
        { status: 401 }
      );
    }

    // Check tombstones: permanently deleted users cannot authenticate
    if (inMemoryStore.isUserTombstoned(candidateUserId)) {
      return HttpResponse.json(
        { message: 'تم حذف هذا الحساب نهائياً من المنظومة' },
        { status: 401 }
      );
    }

    const canonicalId = resolveCanonicalUserId(candidateUserId);
    if (inMemoryStore.isUserTombstoned(canonicalId)) {
      return HttpResponse.json(
        { message: 'تم حذف هذا الحساب نهائياً من المنظومة' },
        { status: 401 }
      );
    }

    const authoritativeUser = inMemoryStore.getManagedUserById(canonicalId);

    // Check if account is suspended
    if (authoritativeUser && authoritativeUser.status === 'suspended') {
      return HttpResponse.json(
        { message: 'تم إيقاف هذا الحساب من قبل إدارة النظام. يرجى مراجعة المسؤول.' },
        { status: 403 }
      );
    }

    const matchedAccount = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find(
      (acc) =>
        acc.user.id.toLowerCase() === candidateUserId!.toLowerCase() ||
        acc.user.id.toLowerCase() === canonicalId.toLowerCase()
    );

    let user: User;
    if (authoritativeUser) {
      user = {
        id: authoritativeUser.id,
        name: authoritativeUser.name,
        email: authoritativeUser.email,
        role: authoritativeUser.role,
        department: authoritativeUser.department,
        jobTitle: authoritativeUser.jobTitle,
        initials: computeInitials(authoritativeUser.name),
      };
    } else if (matchedAccount) {
      user = matchedAccount.user;
    } else if (
      CONTROLLED_TEST_FIXTURE_USERS[canonicalId] ||
      CONTROLLED_TEST_FIXTURE_USERS[candidateUserId!]
    ) {
      const fixtureUser = (CONTROLLED_TEST_FIXTURE_USERS[canonicalId] ||
        CONTROLLED_TEST_FIXTURE_USERS[candidateUserId!])!;
      if (inMemoryStore.isUserTombstoned(fixtureUser.id)) {
        return HttpResponse.json(
          { message: 'تم حذف هذا الحساب نهائياً من المنظومة' },
          { status: 401 }
        );
      }
      user = fixtureUser;
    } else if (
      import.meta.env.DEV &&
      (SYNTHETIC_TEST_PERSONA_REGISTRY[canonicalId] ||
        (candidateUserId ? SYNTHETIC_TEST_PERSONA_REGISTRY[candidateUserId] : null))
    ) {
      const p = (SYNTHETIC_TEST_PERSONA_REGISTRY[canonicalId] ||
        SYNTHETIC_TEST_PERSONA_REGISTRY[candidateUserId!])!;
      user = personaToUser(p);
    } else {
      return HttpResponse.json(
        { message: 'رمز الجلسة غير صالح أو منتهي الصلاحية' },
        { status: 401 }
      );
    }

    return HttpResponse.json({ user });
  }),
];
