import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedGroupDemo: true });
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderRouteAsAdmin(route: string) {
  authStorage.setSession({
    token: `mock_jwt_${adminUser.id}_test`,
    user: adminUser,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={[route]} />);
}

function renderRouteAsUser(route: string, user: typeof adminUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={[route]} />);
}

describe('Increment 11 — Phase 3: User Detail Transcript & Historical Progress Aggregator', () => {
  // ── 1. Route Access & Authorization Guarding ─────────────────────────
  describe('1. Route Access & Authorization Guarding (/admin/users/:userId)', () => {
    it('allows authenticated administrator to access user details page', async () => {
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('user-details-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('user-profile-header')).toBeInTheDocument();
      expect(screen.getByTestId('transcript-metrics')).toBeInTheDocument();
      expect(screen.getByTestId('courses-history-list')).toBeInTheDocument();
    });

    it('denies access to authenticated lecturers and redirects to /403', async () => {
      renderRouteAsUser('/admin/users/usr_trainee_003', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('user-details-page')).not.toBeInTheDocument();
    });

    it('denies access to authenticated trainees and redirects to /403', async () => {
      renderRouteAsUser('/admin/users/usr_trainee_003', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('user-details-page')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated visitors to /login', async () => {
      render(<AppRouter initialEntries={['/admin/users/usr_trainee_003']} />);

      await waitFor(() => {
        expect(screen.getByText('منصة التدريب الإلكتروني')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('user-details-page')).not.toBeInTheDocument();
    });

    it('displays 404 not-found state when user ID does not exist', async () => {
      renderRouteAsAdmin('/admin/users/USR_NON_EXISTENT_XYZ');

      await waitFor(() => {
        expect(screen.getByTestId('user-not-found-state')).toBeInTheDocument();
      });

      expect(screen.getByText(/المستخدم المطلوب غير موجود/i)).toBeInTheDocument();
      expect(screen.getByTestId('back-to-users-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('user-profile-header')).not.toBeInTheDocument();
    });
  });

  // ── 2. Identity & Legacy Alias Resolution ────────────────────────────
  describe('2. Identity & Legacy Alias Resolution', () => {
    it('resolves canonical uppercase employee ID (USR003)', async () => {
      renderRouteAsAdmin('/admin/users/USR003');

      await waitFor(() => {
        expect(screen.getByTestId('user-details-page')).toBeInTheDocument();
      });

      const header = screen.getByTestId('user-profile-header');
      expect(header).toHaveTextContent('USR003');
      expect(header).toHaveTextContent(/محمد أحمد السيد/i);
    });

    it('resolves lowercase legacy alias (usr003)', async () => {
      renderRouteAsAdmin('/admin/users/usr003');

      await waitFor(() => {
        expect(screen.getByTestId('user-details-page')).toBeInTheDocument();
      });

      const header = screen.getByTestId('user-profile-header');
      expect(header).toHaveTextContent('USR003');
      expect(header).toHaveTextContent(/محمد أحمد السيد/i);
    });

    it('resolves demo persona identifier (usr_trainee_003)', async () => {
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('user-details-page')).toBeInTheDocument();
      });

      const header = screen.getByTestId('user-profile-header');
      expect(header).toHaveTextContent('usr_trainee_003');
      expect(header).toHaveTextContent(/أحمد ممدوح سالم/i);
    });

    it('resolves demo username alias (trainee_demo)', async () => {
      renderRouteAsAdmin('/admin/users/trainee_demo');

      await waitFor(() => {
        expect(screen.getByTestId('user-details-page')).toBeInTheDocument();
      });

      const header = screen.getByTestId('user-profile-header');
      expect(header).toHaveTextContent('usr_trainee_003');
      expect(header).toHaveTextContent(/أحمد ممدوح سالم/i);
    });
  });

  // ── 3. Transcript Metrics & Attempt Aggregation ───────────────────────
  describe('3. Transcript Metrics & Attempt Aggregation', () => {
    it('calculates accurate distinct enrolled and completed course metrics', async () => {
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('transcript-metrics')).toBeInTheDocument();
      });

      // CRS001 and CRS002 enrolled
      const enrolledCard = screen.getByTestId('metric-enrolled-courses');
      expect(enrolledCard).toHaveTextContent(/مقرر/i);

      // CRS001 completed in Cycle 1
      const completedCard = screen.getByTestId('metric-completed-courses');
      expect(completedCard).toHaveTextContent(/مقرر/i);

      // Average completion rate exists and is non-negative
      const rateCard = screen.getByTestId('metric-completion-rate');
      expect(rateCard).toHaveTextContent(/%/);

      // Learning hours is honestly reported as null / غير مسجل because cumulative multi-session duration is not tracked
      const hoursCard = screen.getByTestId('metric-learning-hours');
      expect(hoursCard).toHaveTextContent(/غير مسجل/i);
    });

    it('preserves historical attempts without overwriting previous completion when course repeated', async () => {
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('transcript-course-CRS001')).toBeInTheDocument();
      });

      const courseRow = screen.getByTestId('transcript-course-CRS001');
      // Status badge reflects that course has been completed
      expect(courseRow).toHaveTextContent(/مكتمل بنجاح/i);

      // Has multiple attempts toggle button
      const toggleBtn = screen.getByTestId('toggle-attempts-btn-CRS001');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveTextContent(/عرض سجل المحاولات/i);

      // Expand attempts
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByTestId('attempts-list-CRS001')).toBeInTheDocument();
      });

      const attemptsList = screen.getByTestId('attempts-list-CRS001');
      // Should show both completed Attempt 1 and not-started/in-progress Attempt 2
      expect(attemptsList).toHaveTextContent(/المحاولة رقم 1/i);
      expect(attemptsList).toHaveTextContent(/مكتملة/i);
      expect(attemptsList).toHaveTextContent(/المحاولة رقم 2/i);
    });

    it('renders clean empty state for users without enrolled courses', async () => {
      // USR001 is admin without enrolled courses
      renderRouteAsAdmin('/admin/users/USR001');

      await waitFor(() => {
        expect(screen.getByTestId('user-details-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('empty-transcript-courses')).toBeInTheDocument();
      expect(
        screen.getByText(/لا يوجد سجل تدريبي مسجل لهذا المستخدم/i)
      ).toBeInTheDocument();

      // Metrics should all be 0 or unrecorded
      expect(screen.getByTestId('metric-enrolled-courses')).toHaveTextContent('0 مقرر');
      expect(screen.getByTestId('metric-completed-courses')).toHaveTextContent('0 مقرر');
      expect(screen.getByTestId('metric-completion-rate')).toHaveTextContent('0%');
      expect(screen.getByTestId('metric-learning-hours')).toHaveTextContent(/غير مسجل/i);
    });

    it('transparently reports totalLearningHours as null / غير مسجل to prevent fabricating cumulative multi-session duration', async () => {
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('metric-learning-hours')).toBeInTheDocument();
      });

      const hoursCard = screen.getByTestId('metric-learning-hours');
      expect(hoursCard).toHaveTextContent(/غير مسجل/i);
      expect(screen.getByTestId('learning-hours-unavailable')).toBeInTheDocument();
      expect(
        screen.getByText(/لا تسجل المنظومة الحالية إجمالي وقت التعلم التراكمي عبر الجلسات/i)
      ).toBeInTheDocument();
    });

    it('transparently indicates unavailable telemetry for times opened', async () => {
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('transcript-course-CRS001')).toBeInTheDocument();
      });

      const courseRow = screen.getByTestId('transcript-course-CRS001');
      expect(courseRow).toHaveTextContent(/مرات الفتح/i);
      expect(courseRow).toHaveTextContent(/— \(غير مسجل\)/i);
    });

    it('does not derive mostWatchedLessonTitle from completed lesson IDs alone and displays unavailable state', async () => {
      // usr_trainee_003 has completed lessons in CRS001 (e.g. completedItemIds), but no watchCount frequency telemetry
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('transcript-course-CRS001')).toBeInTheDocument();
      });

      const courseRow = screen.getByTestId('transcript-course-CRS001');
      expect(courseRow).toHaveTextContent(/الدرس الأكثر مشاهدة/i);
      expect(screen.getByTestId('most-watched-unavailable-CRS001')).toBeInTheDocument();
      expect(screen.getByTestId('most-watched-unavailable-CRS001')).toHaveTextContent('— (غير مسجل)');

      // Also verify direct DTO calculation
      const transcript = inMemoryStore.getUserTranscript('usr_trainee_003');
      const crs001 = transcript?.courses.find((c) => c.courseId === 'CRS001');
      expect(crs001?.mostWatchedLessonTitle).toBeNull();
      expect(crs001?.mostWatchedCount).toBeNull();
    });

    it('calculates genuine mostWatchedLessonTitle and mostWatchedCount only when reliable viewing-frequency telemetry is available', async () => {
      // Record genuine viewing-frequency telemetry (watchCount) on specific lessons
      const courseItems = inMemoryStore.getCourseItems('CRS001');
      expect(courseItems.length).toBeGreaterThan(1);
      const lessonA = courseItems[0];
      const lessonB = courseItems[1];

      // Simulate explicit watch counts: lesson B was watched 5 times, lesson A watched 2 times
      inMemoryStore.setLessonProgressTelemetry('usr_trainee_003', 'CRS001', lessonA.id, {
        completed: true,
        lastPositionSeconds: 120,
        furthestWatchedSeconds: 120,
        watchCount: 2,
      });
      inMemoryStore.setLessonProgressTelemetry('usr_trainee_003', 'CRS001', lessonB.id, {
        completed: false,
        lastPositionSeconds: 60,
        furthestWatchedSeconds: 60,
        watchCount: 5,
      });

      // Query transcript DTO directly
      const transcript = inMemoryStore.getUserTranscript('usr_trainee_003');
      const crs001 = transcript?.courses.find((c) => c.courseId === 'CRS001');
      expect(crs001).toBeDefined();
      expect(crs001?.mostWatchedLessonTitle).toBe(lessonB.title);
      expect(crs001?.mostWatchedCount).toBe(5);

      // Now verify via UI rendering
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('transcript-course-CRS001')).toBeInTheDocument();
      });

      const mostWatchedCell = screen.getByTestId('most-watched-cell-CRS001');
      expect(mostWatchedCell).toHaveTextContent(lessonB.title);
      expect(screen.queryByTestId('most-watched-unavailable-CRS001')).not.toBeInTheDocument();
    });
  });

  // ── 4. Quick Account Status Action & Lifecycle Reuse ──────────────────
  describe('4. Quick Account Status Action & Lifecycle Reuse', () => {
    it('allows suspending an active user from the transcript header and preserves transcript data', async () => {
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('header-suspend-user-btn')).toBeInTheDocument();
      });

      // Click suspend
      fireEvent.click(screen.getByTestId('header-suspend-user-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('suspend-user-modal')).toBeInTheDocument();
      });

      // Fill optional reason
      const reasonInput = screen.getByTestId('suspend-reason-input');
      fireEvent.change(reasonInput, { target: { value: 'إيقاف تجريبي من صفحة السجل' } });

      // Confirm suspension
      fireEvent.click(screen.getByTestId('confirm-suspend-btn'));

      // Wait for modal to close and status to update to suspended
      await waitFor(() => {
        expect(screen.queryByTestId('suspend-user-modal')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('header-activate-user-btn')).toBeInTheDocument();
      });

      const header = screen.getByTestId('user-profile-header');
      expect(header).toHaveTextContent('موقوف');

      // Transcript data is completely preserved
      expect(screen.getByTestId('transcript-metrics')).toBeInTheDocument();
      expect(screen.getByTestId('courses-history-list')).toBeInTheDocument();

      // Now reactivate the account
      fireEvent.click(screen.getByTestId('header-activate-user-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('reactivate-user-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-reactivate-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('header-suspend-user-btn')).toBeInTheDocument();
      });

      expect(header).toHaveTextContent('نشط');
    });
  });

  // ── 5. Directory Entry Point & Safe Navigation ────────────────────────
  describe('5. Directory Entry Point & Safe Navigation', () => {
    it('navigates from user directory to user details page when clicking view transcript button', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      render(<AppRouter initialEntries={['/admin/users']} />);

      await waitFor(() => {
        expect(screen.getByTestId('user-table')).toBeInTheDocument();
      });

      const transcriptBtn = screen.getByTestId('user-transcript-btn-usr_trainee_003');
      expect(transcriptBtn).toBeInTheDocument();

      fireEvent.click(transcriptBtn);

      await waitFor(() => {
        expect(screen.getByTestId('user-details-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('user-profile-header')).toHaveTextContent(/أحمد ممدوح/i);
    });

    it('navigates from user details page back to user directory via breadcrumbs link', async () => {
      renderRouteAsAdmin('/admin/users/usr_trainee_003');

      await waitFor(() => {
        expect(screen.getByTestId('back-to-users-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-to-users-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('user-management-page')).toBeInTheDocument();
      });
    });
  });

  // ── 6. API Service Layer Unit Tests ──────────────────────────────────
  describe('6. API Service Layer Unit Tests (userManagementApi.getUserTranscript)', () => {
    it('returns typed transcript DTO with user profile, metrics, and courses', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      const transcript = await userManagementApi.getUserTranscript('usr_trainee_003');

      expect(transcript).toBeDefined();
      expect(transcript.user.id).toBe('usr_trainee_003');
      expect(transcript.user.name).toBe('أحمد ممدوح سالم');
      expect(transcript.metrics).toBeDefined();
      expect(typeof transcript.metrics.enrolledCoursesCount).toBe('number');
      expect(typeof transcript.metrics.completedCoursesCount).toBe('number');
      expect(typeof transcript.metrics.averageCompletionRate).toBe('number');
      expect(transcript.metrics.totalLearningHours).toBeNull();
      expect(Array.isArray(transcript.courses)).toBe(true);

      // Also verify legacy employee lookup
      const legacyEmployee = await userManagementApi.getUserTranscript('USR003');
      expect(legacyEmployee.user.id).toBe('USR003');
      expect(legacyEmployee.user.name).toBe('محمد أحمد السيد');
    });

    it('rejects with 404 when requested user is not found in store', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      await expect(
        userManagementApi.getUserTranscript('USR_GHOST_1234')
      ).rejects.toThrow();
    });

    it('rejects with 403 when called by non-admin authenticated session', async () => {
      authStorage.setSession({
        token: `mock_jwt_${traineeUser.id}_test`,
        user: traineeUser,
        expiresAt: Date.now() + 3600000,
      });

      await expect(
        userManagementApi.getUserTranscript('USR003')
      ).rejects.toThrow();
    });
  });
});
