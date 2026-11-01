import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { resolveAuthenticatedUser } from '@/mocks/handlers/resolveUser';
import { resolveCanonicalUserId } from '@/core/auth/canonicalIdentity';
import { isMatchingInstructorId, isUserAuthorizedCourseInstructor } from '@/core/courses/courseAuthorization';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import type { User } from '@/core/auth/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
});
afterAll(() => server.close());

describe('Phase 1 — Canonical Identity, Tombstones & Session Consistency', () => {
  // ── 1. Unit Tests: Token Resolution & Canonical Normalization ───────────
  describe('Unit Tests: resolveAuthenticatedUser & Canonical Identity', () => {
    it('resolves synthetic demo accounts from token prefix', () => {
      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_usr_admin_001_${Date.now()}` },
      });
      const resolved = resolveAuthenticatedUser(req);
      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe('usr_admin_001');
      expect(resolved?.role).toBe('admin');
    });

    it('resolves directory users (USR002–USR015) to their own individual identity', () => {
      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_USR006_${Date.now()}` },
      });
      const resolved = resolveAuthenticatedUser(req);
      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe('USR006');
      expect(resolved?.role).toBe('user');
      expect(resolved?.email).toBe('yasser@cairo-metro.com');
    });

    it('resolves newly created users added to inMemoryStore', () => {
      const newUser = inMemoryStore.createUser({
        name: 'مستخدم تجريبي جديد',
        username: 'new_trainee_test',
        email: 'new.trainee@cairo-metro.com',
        phone: '01099887766',
        jobTitle: 'فني تشغيل',
        department: 'قطاع الصيانة',
        role: 'user',
        password: 'Password123!',
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_${newUser.id}_${Date.now()}` },
      });
      const resolved = resolveAuthenticatedUser(req);
      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(newUser.id);
      expect(resolved?.name).toBe('مستخدم تجريبي جديد');
    });

    it('strictly returns null for unknown, corrupted, or missing tokens (never falls back to trainee)', () => {
      const unknownTokenReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_completely_unknown_user_99999_${Date.now()}` },
      });
      expect(resolveAuthenticatedUser(unknownTokenReq)).toBeNull();

      const invalidBearerReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: 'Bearer ' },
      });
      expect(resolveAuthenticatedUser(invalidBearerReq)).toBeNull();

      const noHeaderReq = new Request('https://metro.lms/api/courses');
      expect(resolveAuthenticatedUser(noHeaderReq)).toBeNull();
    });

    it('strictly returns null for tombstoned (permanently deleted) user tokens', () => {
      inMemoryStore.addDeletedUserTombstone('USR006');
      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_USR006_${Date.now()}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();
    });

    it('strictly returns null for suspended user tokens', () => {
      // USR011 is seeded with status: 'suspended' in userDirectoryFixtures
      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_USR011_${Date.now()}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();
    });

    it('normalizes legacy synthetic ID usr_lect_001 to canonical user ID USR003 idempotently', () => {
      expect(resolveCanonicalUserId('usr_lect_001')).toBe('USR003');
      expect(resolveCanonicalUserId('USR003')).toBe('USR003');
      expect(resolveCanonicalUserId('usr003')).toBe('USR003');
    });

    it('matches instructor ownership across synthetic and canonical user IDs (MFR-07)', () => {
      // Actor is synthetic 'usr_lect_001' and course lecturer is canonical 'USR003'
      expect(isMatchingInstructorId('usr_lect_001', 'USR003')).toBe(true);
      expect(isMatchingInstructorId('USR003', 'usr_lect_001')).toBe(true);

      const courseWithCanonical = {
        id: 'CRS001',
        lecturerId: 'USR003',
        coLecturers: [],
      };
      expect(isUserAuthorizedCourseInstructor(courseWithCanonical, 'usr_lect_001')).toBe(true);

      const courseWithSynthetic = {
        id: 'CRS001',
        lecturerId: 'usr_lect_001',
        coLecturers: [],
      };
      expect(isUserAuthorizedCourseInstructor(courseWithSynthetic, 'USR003')).toBe(true);
    });
  });

  // ── 2. Integration Tests: API Handlers & Store Synchronization ──────────
  describe('Integration Tests: Handlers and Comment Moderation', () => {
    it('enrolls directory user (USR006) and records enrollment under their own canonical ID', async () => {
      const response = await fetch('/api/courses/CRS001/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer mock_jwt_USR006_${Date.now()}`,
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.enrollment.userId).toBe('USR006');

      // Verify inMemoryStore reflects the canonical enrollment
      const userEnrollment = inMemoryStore.getCourseEnrollment('CRS001', 'USR006');
      expect(userEnrollment).toBeDefined();
      expect(userEnrollment?.userId).toBe('USR006');
    });

    it('records lesson completion for the exact authenticated user', async () => {
      // Direct enrollment for USR006 in CRS001
      inMemoryStore.enrollUser({
        courseId: 'CRS001',
        userId: 'USR006',
        userRole: 'user',
      });

      const response = await fetch('/api/courses/CRS001/items/ITEM001/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer mock_jwt_USR006_${Date.now()}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.completedItem.completed).toBe(true);

      // Verify in store under USR006 canonical progress
      const progress = inMemoryStore.getCourseProgress('USR006', 'CRS001');
      expect(progress.completedItemIds).toContain('ITEM001');
    });

    it('allows lecturer usr_lect_001 to moderate comments on courses owned by USR003 without 403 error (MFR-07)', () => {
      // Find or seed a course owned by USR003
      const courses = inMemoryStore.getCourses();
      const course = courses[0];
      course.lecturerId = 'USR003';

      // Seed a reported comment on this course
      const comment = inMemoryStore.createComment(
        { courseId: course.id, text: 'تعليق تدريبي للاختبار' },
        { id: 'usr_admin_001', role: 'admin', name: 'أحمد المتدرب' }
      );
      inMemoryStore.reportComment(
        comment.id,
        { reason: 'inappropriate_content' },
        { id: 'USR005', role: 'user' }
      );

      // Actor usr_lect_001 queries comments for this course
      const comments = inMemoryStore.getAllComments(
        { id: 'usr_lect_001', role: 'lecturer' },
        { courseId: course.id }
      );
      expect(comments.length).toBeGreaterThan(0);

      // Actor usr_lect_001 ignores report
      const ignored = inMemoryStore.ignoreCommentReport(comment.id, {
        id: 'usr_lect_001',
        role: 'lecturer',
      });
      expect(ignored.reported).toBe(false);

      // Actor usr_lect_001 deletes comment
      const deleted = inMemoryStore.deleteComment(comment.id, {
        id: 'usr_lect_001',
        role: 'lecturer',
      });
      expect(deleted).toBe(true);

      // Actor usr_lect_001 toggles discussion policy
      const toggled = inMemoryStore.toggleCourseComments(course.id, false, {
        id: 'usr_lect_001',
        role: 'lecturer',
      });
      expect(toggled.commentsEnabled).toBe(false);
    });
  });

  // ── 3. Session Revalidation & Security Tests (MFR-20 & Tombstones) ─────
  describe('Session Revalidation & Security Invariants', () => {
    it('invalidates and clears session on app initialization if the user account is suspended', async () => {
      // Stored session belongs to suspended account USR011
      const suspendedUser: User = {
        id: 'USR011',
        name: 'مروان حسن',
        email: 'marwan.hassan@cairo-metro.com',
        role: 'user',
        department: 'قطاع الصيانة',
        jobTitle: 'فني صيانة',
        initials: 'م.ح',
      };

      authStorage.setSession({
        token: `mock_jwt_USR011_${Date.now()}`,
        user: suspendedUser,
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/login" element={<div data-testid="login-page">صفحة الدخول</div>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="protected-dashboard">محتوى محمي</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // After revalidation against /api/auth/me returns 403, session is cleared and redirects to /login
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('protected-dashboard')).not.toBeInTheDocument();
      expect(authStorage.getSession()).toBeNull();
    });

    it('invalidates and clears session on app initialization if the user account is tombstoned/deleted', async () => {
      // Tombstone USR006
      inMemoryStore.addDeletedUserTombstone('USR006');

      const tombstonedUser: User = {
        id: 'USR006',
        name: 'يوسف محمود',
        email: 'youssef.mahmoud@cairo-metro.com',
        role: 'user',
        department: 'قطاع الصيانة',
        jobTitle: 'فني إشارات',
        initials: 'ي.م',
      };

      authStorage.setSession({
        token: `mock_jwt_USR006_${Date.now()}`,
        user: tombstonedUser,
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/login" element={<div data-testid="login-page">صفحة الدخول</div>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="protected-dashboard">محتوى محمي</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // After revalidation against /api/auth/me returns 401, session is cleared and redirects to /login
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('protected-dashboard')).not.toBeInTheDocument();
      expect(authStorage.getSession()).toBeNull();
    });

    it('prevents deleted demo personas from being resurrected through synthetic fallback (MFR-13)', () => {
      // Admin deletes demo persona usr_trainee_003
      const targetUser = inMemoryStore.getManagedUserById('usr_trainee_003');
      expect(targetUser).toBeDefined();

      inMemoryStore.deleteUser('usr_trainee_003', {
        id: 'USR001',
        role: 'admin',
      });

      // Verify tombstone is recorded
      expect(inMemoryStore.isUserTombstoned('usr_trainee_003')).toBe(true);

      // Attempting to resolve via getManagedUserById must return undefined (NEVER resurrect demo account)
      const lookupAfterDelete = inMemoryStore.getManagedUserById('usr_trainee_003');
      expect(lookupAfterDelete).toBeUndefined();

      // Attempting to authenticate with deleted demo token must return null
      const req = new Request('https://metro.lms/api/admin/users', {
        headers: { Authorization: `Bearer mock_jwt_usr_trainee_003_${Date.now()}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();
    });

    it('rejects stale sessions with unknown or invalid tokens on app initialization', async () => {
      const fakeUser: User = {
        id: 'USR_STALE_GHOST',
        name: 'شبح غير موجود',
        email: 'ghost@cairo-metro.com',
        role: 'user',
        department: 'قطاع التشغيل',
        jobTitle: 'موظف',
        initials: 'ش.غ',
      };

      authStorage.setSession({
        token: `mock_jwt_USR_STALE_GHOST_${Date.now()}`,
        user: fakeUser,
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/login" element={<div data-testid="login-page">صفحة الدخول</div>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="protected-dashboard">محتوى محمي</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('protected-dashboard')).not.toBeInTheDocument();
      expect(authStorage.getSession()).toBeNull();
    });

    // ── Gated Authentication State & Race Condition Tests (MFR-20) ───────────
    it('gates authentication state during session revalidation (protected content inaccessible until revalidation finishes)', async () => {
      // Simulate network latency on /api/auth/me to inspect in-flight gated state
      server.use(
        http.get('/api/auth/me', async () => {
          await delay(60);
          return HttpResponse.json({
            user: {
              id: 'USR006',
              name: 'ياسر إبراهيم عبدالعزيز',
              email: 'yasser@cairo-metro.com',
              role: 'user',
              department: 'قطاع التشغيل',
              jobTitle: 'مشرف محطة',
              initials: 'ي.إ',
            },
          });
        })
      );

      const unverifiedUser: User = {
        id: 'USR006',
        name: 'ياسر إبراهيم عبدالعزيز',
        email: 'yasser@cairo-metro.com',
        role: 'user',
        department: 'قطاع التشغيل',
        jobTitle: 'مشرف محطة',
        initials: 'ي.إ',
      };

      authStorage.setSession({
        token: `mock_jwt_USR006_${Date.now()}`,
        user: unverifiedUser,
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/login" element={<div data-testid="login-page">صفحة الدخول</div>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="protected-dashboard">محتوى محمي</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // In-flight: protected content MUST NOT be accessible while revalidation is pending!
      expect(screen.queryByTestId('protected-dashboard')).not.toBeInTheDocument();
      expect(screen.getByText('جارٍ التحقق من الجلسة التدريبية...')).toBeInTheDocument();

      // After revalidation finishes: protected content renders
      await waitFor(() => {
        expect(screen.getByTestId('protected-dashboard')).toBeInTheDocument();
      });
      expect(screen.queryByText('جارٍ التحقق من الجلسة التدريبية...')).not.toBeInTheDocument();
    });

    it('preserves credentials in storage but does not treat cached session as authenticated on network failure during revalidation', async () => {
      // Server fails with network error
      server.use(
        http.get('/api/auth/me', () => {
          return HttpResponse.error();
        })
      );

      const validUser: User = {
        id: 'USR006',
        name: 'ياسر إبراهيم',
        email: 'yasser@cairo-metro.com',
        role: 'user',
        department: 'قطاع التشغيل',
        jobTitle: 'مشرف محطة',
        initials: 'ي.إ',
      };

      authStorage.setSession({
        token: `mock_jwt_USR006_${Date.now()}`,
        user: validUser,
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/login" element={<div data-testid="login-page">صفحة الدخول</div>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="protected-dashboard">محتوى محمي</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Protected content MUST NOT be accessible when revalidation cannot connect
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('protected-dashboard')).not.toBeInTheDocument();

      // Stored credentials must NOT be destroyed on transient network failures
      const stored = authStorage.getSession();
      expect(stored).not.toBeNull();
      expect(stored?.token).toContain('mock_jwt_USR006_');
    });

    it('prevents logout race condition: in-flight revalidation response never resurrects a logged-out session', async () => {
      server.use(
        http.get('/api/auth/me', async () => {
          await delay(60);
          return HttpResponse.json({
            user: {
              id: 'USR006',
              name: 'ياسر إبراهيم',
              email: 'yasser@cairo-metro.com',
              role: 'user',
              department: 'قطاع التشغيل',
              jobTitle: 'مشرف محطة',
              initials: 'ي.إ',
            },
          });
        })
      );

      const validUser: User = {
        id: 'USR006',
        name: 'ياسر إبراهيم',
        email: 'yasser@cairo-metro.com',
        role: 'user',
        department: 'قطاع التشغيل',
        jobTitle: 'مشرف محطة',
        initials: 'ي.إ',
      };

      authStorage.setSession({
        token: `mock_jwt_USR006_${Date.now()}`,
        user: validUser,
        expiresAt: Date.now() + 3600000,
      });

      const { unmount } = render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <div data-testid="app-root">منظومة المترو</div>
          </MemoryRouter>
        </AuthProvider>
      );

      // User initiates explicit logout while GET /api/auth/me is in-flight
      act(() => {
        authStorage.clearSession();
      });

      // Wait for delayed revalidation response to arrive
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      // The in-flight response must NOT resurrect the session in authStorage
      expect(authStorage.getSession()).toBeNull();
      unmount();
    });

    it('prevents stale response overwrite: different user login while earlier revalidation is in-flight', async () => {
      server.use(
        http.get('/api/auth/me', async ({ request }) => {
          const authHeader = request.headers.get('Authorization') || '';
          if (authHeader.includes('token_user_a')) {
            await delay(70);
            return HttpResponse.json({
              user: {
                id: 'USR006',
                name: 'المستخدم القديم أ',
                email: 'user_a@cairo-metro.com',
                role: 'user',
                department: 'قطاع التشغيل',
                jobTitle: 'مشرف محطة',
                initials: 'أ',
              },
            });
          }
          return HttpResponse.json({
            user: {
              id: 'USR002',
              name: 'المحاضر الجديد ب',
              email: 'user_b@cairo-metro.com',
              role: 'lecturer',
              department: 'قطاع التدريب',
              jobTitle: 'محاضر معتمد',
              initials: 'ب',
            },
          });
        })
      );

      // User A session initially present
      authStorage.setSession({
        token: 'mock_jwt_token_user_a',
        user: {
          id: 'USR006',
          name: 'المستخدم أ',
          email: 'user_a@cairo-metro.com',
          role: 'user',
          department: 'قطاع التشغيل',
          jobTitle: 'مشرف محطة',
          initials: 'أ',
        },
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <div data-testid="app-root">منظومة المترو</div>
          </MemoryRouter>
        </AuthProvider>
      );

      // While User A's revalidation is in flight, User B logs in
      act(() => {
        authStorage.setSession({
          token: 'mock_jwt_token_user_b',
          user: {
            id: 'USR002',
            name: 'المحاضر ب',
            email: 'user_b@cairo-metro.com',
            role: 'lecturer',
            department: 'قطاع التدريب',
            jobTitle: 'محاضر معتمد',
            initials: 'ب',
          },
          expiresAt: Date.now() + 3600000,
        });
      });

      // Wait for User A's delayed response to resolve
      await act(async () => {
        await new Promise((r) => setTimeout(r, 120));
      });

      // User B's active token must remain intact and NOT be overwritten by User A's delayed response
      const activeSession = authStorage.getSession();
      expect(activeSession?.token).toBe('mock_jwt_token_user_b');
      expect(activeSession?.user.id).toBe('USR002');
    });
  });

  // ── 4. Authoritative Resolver Security & Suspension Invariants ───────────
  describe('Resolver Security: Account Suspension, Direct APIs & Tombstones', () => {
    it('strictly rejects user with existing stored session immediately after account suspension in store', async () => {
      // USR006 is active initially
      const activeManaged = inMemoryStore.getManagedUserById('USR006');
      expect(activeManaged?.status).toBe('active');

      const token = `mock_jwt_USR006_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR006',
          name: 'ياسر إبراهيم',
          email: 'yasser@cairo-metro.com',
          role: 'user',
          department: 'قطاع التشغيل',
          jobTitle: 'مشرف محطة',
          initials: 'ي.إ',
        },
        expiresAt: Date.now() + 3600000,
      });

      // Admin suspends USR006
      inMemoryStore.updateUserStatus('USR006', 'suspended', 'إيقاف تجريبي');

      // Direct resolveAuthenticatedUser call with stored session token MUST return null
      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();

      // Direct GET /api/auth/me MUST return 403 Forbidden
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.message).toContain('تم إيقاف هذا الحساب');
    });

    it('direct learning API requests cannot bypass suspension checks (MFR-01)', async () => {
      // Ensure USR011 is suspended
      const suspendedUser = inMemoryStore.getManagedUserById('USR011');
      expect(suspendedUser?.status).toBe('suspended');

      const token = `mock_jwt_USR011_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR011',
          name: 'عمرو جمال',
          email: 'amr@cairo-metro.com',
          role: 'user',
          department: 'قطاع الصيانة',
          jobTitle: 'مهندس ميكانيكا',
          initials: 'ع.ج',
        },
        expiresAt: Date.now() + 3600000,
      });

      // Direct request to learning progress endpoint must be rejected with 401
      const progressRes = await fetch('/api/courses/CRS001/progress', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(progressRes.status).toBe(401);

      // Direct request to record lesson activity must be rejected with 401
      const activityRes = await fetch('/api/courses/CRS001/items/ITEM001/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ durationSeconds: 60 }),
      });
      expect(activityRes.status).toBe(401);
    });

    it('direct enrollment API requests cannot bypass suspension checks (MFR-01)', async () => {
      const suspendedUser = inMemoryStore.getManagedUserById('USR011');
      expect(suspendedUser?.status).toBe('suspended');

      const token = `mock_jwt_USR011_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR011',
          name: 'عمرو جمال',
          email: 'amr@cairo-metro.com',
          role: 'user',
          department: 'قطاع الصيانة',
          jobTitle: 'مهندس ميكانيكا',
          initials: 'ع.ج',
        },
        expiresAt: Date.now() + 3600000,
      });

      const enrollRes = await fetch('/api/courses/CRS001/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      expect(enrollRes.status).toBe(401);
    });

    it('tombstoned users cannot authenticate through stored sessions across all endpoints', async () => {
      // Tombstone USR008
      inMemoryStore.addDeletedUserTombstone('USR008');

      const token = `mock_jwt_USR008_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR008',
          name: 'طارق عبدالفتاح',
          email: 'tarek@cairo-metro.com',
          role: 'user',
          department: 'قطاع الصيانة',
          jobTitle: 'مهندس كهرباء',
          initials: 'ط.ع',
        },
        expiresAt: Date.now() + 3600000,
      });

      // resolveAuthenticatedUser returns null
      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();

      // GET /api/auth/me returns 401 with tombstone notice
      const authRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(authRes.status).toBe(401);
      const data = await authRes.json();
      expect(data.message).toContain('تم حذف هذا الحساب نهائياً');
    });

    it('existing valid demo and directory accounts continue resolving authoritatively', async () => {
      // Demo admin
      const adminReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_usr_admin_001_${Date.now()}` },
      });
      const adminUser = resolveAuthenticatedUser(adminReq);
      expect(adminUser?.id).toBe('usr_admin_001');
      expect(adminUser?.role).toBe('admin');

      // Demo lecturer
      const lectReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_usr_lect_002_${Date.now()}` },
      });
      const lectUser = resolveAuthenticatedUser(lectReq);
      expect(lectUser?.id).toBe('usr_lect_002');
      expect(lectUser?.role).toBe('lecturer');

      // Directory user USR006
      const dirReq = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer mock_jwt_USR006_${Date.now()}` },
      });
      const dirUser = resolveAuthenticatedUser(dirReq);
      expect(dirUser?.id).toBe('USR006');
      expect(dirUser?.role).toBe('user');
    });
  });

  // ── 5. Enforce Authoritative User Identity and Role Invariants ──────────
  describe('Authoritative User Identity and Role Invariants', () => {
    it('stored session with legacy alias resolves to canonical directory ID', async () => {
      // Stored session with legacy alias 'usr004' (must resolve to 'USR004')
      const token = `mock_jwt_usr004_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'usr004',
          name: 'عبد الرحمن حسن',
          email: 'abdulrahman@cairo-metro.com',
          role: 'user',
          department: 'قطاع الصيانة',
          jobTitle: 'مهندس صيانة',
          initials: 'ع.ح',
        },
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const resolved = resolveAuthenticatedUser(req);
      expect(resolved?.id).toBe('USR004');

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe('USR004');
    });

    it('stored session containing stale role receives current authoritative role immediately', async () => {
      // USR003 has role 'user' in directory initially
      const initialUser = inMemoryStore.getManagedUserById('USR003');
      expect(initialUser?.role).toBe('user');

      // Admin promotes USR003 to 'lecturer' in directory
      inMemoryStore.updateUserRole('USR003', 'lecturer');

      // Client still has stale session in localStorage with role 'user'
      const token = `mock_jwt_USR003_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR003',
          name: 'محمد أحمد السيد',
          email: 'mohamed.elsayed@cairo-metro.com',
          role: 'user', // Stale role in storage
          department: 'قطاع التشغيل',
          jobTitle: 'مهندس تشغيل',
          initials: 'م.أ',
        },
        expiresAt: Date.now() + 3600000,
      });

      // resolveAuthenticatedUser must overwrite stale role with authoritative directory role 'lecturer'
      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const resolved = resolveAuthenticatedUser(req);
      expect(resolved?.role).toBe('lecturer');

      // GET /api/auth/me must return authoritative role 'lecturer'
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.role).toBe('lecturer');
      expect(data.user.id).toBe('USR003');
    });

    it('stored session with stale elevated role (demoted user) is immediately restricted to directory role', async () => {
      // USR001 is admin initially. Admin demotes USR001 to 'user'
      inMemoryStore.updateUserRole('USR001', 'user');

      // Browser still has stale session claiming role: 'admin'
      const token = `mock_jwt_USR001_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR001',
          name: 'أحمد محمود علي',
          email: 'ahmed.ali@cairo-metro.com',
          role: 'admin', // Stale elevated role
          department: 'إدارة تكنولوجيا المعلومات',
          jobTitle: 'مدير سابق',
          initials: 'أ.م',
        },
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const resolved = resolveAuthenticatedUser(req);
      expect(resolved?.role).toBe('user');

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.role).toBe('user');
    });

    it('suspended account is rejected across resolver and GET /api/auth/me', async () => {
      inMemoryStore.updateUserStatus('USR002', 'suspended', 'موقوف إدارياً');
      const token = `mock_jwt_USR002_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR002',
          name: 'م. خالد إبراهيم',
          email: 'khaled.ibrahim@cairo-metro.com',
          role: 'lecturer',
          department: 'إدارة التدريب',
          jobTitle: 'مهندس تدريب أول',
          initials: 'خ.إ',
        },
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
    });

    it('valid synthetic demo sessions continue working and preserve demo identity', async () => {
      const demoAccounts = ['usr_admin_001', 'usr_lect_002', 'usr_trainee_003'];
      for (const demoId of demoAccounts) {
        const token = `mock_jwt_${demoId}_${Date.now()}`;
        const req = new Request('https://metro.lms/api/courses', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const resolved = resolveAuthenticatedUser(req);
        expect(resolved).not.toBeNull();
        expect(resolved?.id).toBe(demoId);

        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.user.id).toBe(demoId);
      }
    });
  });

  // ── 6. Strict Rejection of Unknown Stored Session Identities ─────────────
  describe('Strict Rejection of Unknown Stored Session Identities', () => {
    it('unknown stored identity is strictly rejected with null and 401', async () => {
      const token = 'mock_jwt_USR999_UNKNOWN';
      authStorage.setSession({
        token,
        user: {
          id: 'USR999_UNKNOWN',
          name: 'مستخدم مجهول',
          email: 'unknown@metro.gov.eg',
          role: 'user',
          department: 'قسم وهمي',
          jobTitle: 'لا يوجد',
          initials: 'م.م',
        },
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toContain('رمز الجلسة غير صالح أو منتهي الصلاحية');
    });

    it('malformed identity (empty id or missing id) is rejected with null and 401', async () => {
      const token = 'mock_jwt_malformed_session';
      authStorage.setSession({
        token,
        user: {
          id: '   ',
          name: 'مستخدم به خطأ',
          email: 'malformed@metro.gov.eg',
          role: 'user',
          department: 'قسم',
          jobTitle: 'وظيفة',
          initials: 'م',
        },
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(401);
    });

    it('valid managed directory session succeeds with 200', async () => {
      const token = `mock_jwt_USR005_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR005',
          name: 'مصطفى كمال محمود',
          email: 'mostafa@cairo-metro.com',
          role: 'user',
          department: 'قطاع الصيانة',
          jobTitle: 'فني صيانة قطارات',
          initials: 'م.ك',
        },
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const resolved = resolveAuthenticatedUser(req);
      expect(resolved?.id).toBe('USR005');

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe('USR005');
      expect(data.user.role).toBe('user');
    });

    it('valid synthetic demo session succeeds with 200', async () => {
      const token = `mock_jwt_usr_lect_002_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'usr_lect_002',
          name: 'د. طارق محمود',
          email: 'lecturer@cairo-metro.com',
          role: 'lecturer',
          department: 'الإدارة العامة للتشغيل والتحكم',
          jobTitle: 'خبير تشغيل شبكات المترو',
          initials: 'ط.م',
        },
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const resolved = resolveAuthenticatedUser(req);
      expect(resolved?.id).toBe('usr_lect_002');

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe('usr_lect_002');
    });

    it('tombstoned session is rejected with null and 401 tombstone notice', async () => {
      inMemoryStore.addDeletedUserTombstone('USR007');
      const token = `mock_jwt_USR007_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR007',
          name: 'محمود كمال',
          email: 'mahmoud@cairo-metro.com',
          role: 'user',
          department: 'قطاع الصيانة',
          jobTitle: 'مهندس',
          initials: 'م.ك',
        },
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toContain('تم حذف هذا الحساب نهائياً');
    });

    it('suspended session is rejected with null and 403 suspension notice', async () => {
      inMemoryStore.updateUserStatus('USR009', 'suspended', 'إيقاف إداري');
      const token = `mock_jwt_USR009_${Date.now()}`;
      authStorage.setSession({
        token,
        user: {
          id: 'USR009',
          name: 'هشام إبراهيم',
          email: 'hesham@cairo-metro.com',
          role: 'user',
          department: 'قطاع الصيانة',
          jobTitle: 'فني',
          initials: 'هـ.إ',
        },
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.message).toContain('تم إيقاف هذا الحساب');
    });
  });

  // ── 7. Distinct Identity Resolution: usr_trainee_003 vs USR004 (MFR-13) ──
  describe('MFR-13 Distinct Identity Resolution: usr_trainee_003 vs USR004', () => {
    it('proves usr_trainee_003 and USR004 are distinct accounts and resolve to distinct managed users', () => {
      // 1. Check canonical ID resolution
      const canonicalDemoTrainee = resolveCanonicalUserId('usr_trainee_003');
      const canonicalLegacyTrainee = resolveCanonicalUserId('usr004');
      const canonicalUpperLegacy = resolveCanonicalUserId('USR004');

      expect(canonicalDemoTrainee).toBe('usr_trainee_003');
      expect(canonicalLegacyTrainee).toBe('USR004');
      expect(canonicalUpperLegacy).toBe('USR004');
      expect(canonicalDemoTrainee).not.toBe(canonicalLegacyTrainee);

      // 2. Lookup in central user directory
      const demoUser = inMemoryStore.getManagedUserById('usr_trainee_003');
      const legacyUser = inMemoryStore.getManagedUserById('USR004');

      expect(demoUser).toBeDefined();
      expect(legacyUser).toBeDefined();

      // Demo trainee: Ahmed Mamdouh Salem
      expect(demoUser?.id).toBe('usr_trainee_003');
      expect(demoUser?.name).toBe('أحمد ممدوح سالم');
      expect(demoUser?.email).toBe('trainee@cairo-metro.com');

      // Legacy employee: Abdelrahman Hassan Mahmoud
      expect(legacyUser?.id).toBe('USR004');
      expect(legacyUser?.name).toBe('عبدالرحمن حسن محمود');
      expect(legacyUser?.email).toBe('abdulrahman@cairo-metro.com');

      // 3. Confirm both can be co-members in the same training group
      const demoEnrollment = inMemoryStore.enrollUser({
        courseId: 'CRS001',
        userId: 'usr_trainee_003',
      });
      const legacyEnrollment = inMemoryStore.enrollUser({
        courseId: 'CRS001',
        userId: 'USR004',
      });

      expect(demoEnrollment.enrollment.userId).toBe('usr_trainee_003');
      expect(legacyEnrollment.enrollment.userId).toBe('USR004');
      expect(demoEnrollment.enrollment.id).not.toBe(legacyEnrollment.enrollment.id);

      // 4. Verify usr_lect_001 normalizes to USR003
      expect(resolveCanonicalUserId('usr_lect_001')).toBe('USR003');
      const usr003 = inMemoryStore.getManagedUserById('USR003');
      expect(usr003?.id).toBe('USR003');
      expect(usr003?.name).toBe('محمد أحمد السيد');
    });
  });

  // ── 8. Security Boundary: Controlled Test Fixtures & Unauthenticated Isolation ──
  describe('Security Boundary: Controlled Test Fixtures & Unauthenticated Isolation', () => {
    it('unauthenticated requests strictly cannot resolve into privileged fixture identities', () => {
      // 1. Completely missing Authorization header
      const reqMissing = new Request('https://metro.lms/api/courses');
      expect(resolveAuthenticatedUser(reqMissing)).toBeNull();

      // 2. Empty Authorization header
      const reqEmpty = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: '' },
      });
      expect(resolveAuthenticatedUser(reqEmpty)).toBeNull();

      // 3. Header without 'Bearer ' prefix
      const reqNoBearer = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: 'Basic dXNyX2xlY3RfOTk5OnBhc3M=' },
      });
      expect(resolveAuthenticatedUser(reqNoBearer)).toBeNull();

      // 4. Empty Bearer token
      const reqEmptyBearer = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: 'Bearer   ' },
      });
      expect(resolveAuthenticatedUser(reqEmptyBearer)).toBeNull();
    });

    it('invalid or forged tokens cannot access privileged fixture identities via resolver or /api/auth/me', async () => {
      const forgedTokens = [
        'forged_token_trying_to_impersonate',
        'Bearer_usr_lect_999_fake',
        'mock_jwt_unknown_hacker_admin',
        'token-usr_lect_999-forged-signature',
      ];

      for (const token of forgedTokens) {
        // Direct resolver check
        const req = new Request('https://metro.lms/api/courses', {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(resolveAuthenticatedUser(req)).toBeNull();

        // Direct GET /api/auth/me check
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.message).toContain('رمز الجلسة غير صالح أو منتهي الصلاحية');
      }
    });

    it('tombstoned test fixture identities cannot authenticate via token or session storage', async () => {
      // Tombstone privileged fixture usr_lect_999
      inMemoryStore.addDeletedUserTombstone('usr_lect_999');

      // 1. Attempt token-based authentication
      const token = `mock_jwt_usr_lect_999_${Date.now()}`;
      const req = new Request('https://metro.lms/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resolveAuthenticatedUser(req)).toBeNull();

      const tokenRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(tokenRes.status).toBe(401);

      // 2. Attempt session-storage authentication
      authStorage.setSession({
        token,
        user: {
          id: 'usr_lect_999',
          name: 'م. عصام الشريف',
          email: 'other_lecturer@cairo-metro.com',
          role: 'lecturer',
          department: 'إدارة الورش الميكانيكية',
          jobTitle: 'مدرب صيانة الوحدات',
          initials: 'ع.ش',
        },
        expiresAt: Date.now() + 3600000,
      });

      expect(resolveAuthenticatedUser(req)).toBeNull();
      const sessionRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(sessionRes.status).toBe(401);
    });
  });
});
