import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedReviewDemo: false });
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;

function renderWithApp(initialRoute: string, user: User = adminUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={[initialRoute]} />);
}

describe('Increment 10 — Phase 8: Group Monitoring Dashboard & Historical Cycle Reporting', () => {
  // ── 1. Entry Points, Canonical Routing & Navigation ─────────────────

  describe('1. Dashboard Entry Points and Authorization', () => {
    it('allows administrator to access group monitoring dashboard directly', async () => {
      renderWithApp('/admin/groups/GRP-101/monitoring', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-monitoring-status-overview')).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/برنامج تشغيل وتأمين الخط الثاني/);
      expect(screen.getByTestId('cohort-metric-total-members')).toBeInTheDocument();
      expect(screen.getByTestId('tab-trainees-view')).toBeInTheDocument();
      expect(screen.getByTestId('tab-courses-view')).toBeInTheDocument();
      expect(screen.getByTestId('tab-join-requests-view')).toBeInTheDocument();
    });

    it('navigates to monitoring dashboard from groups list action button', async () => {
      renderWithApp('/admin/groups', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-groups-table')).toBeInTheDocument();
      });

      const monitorBtn = screen.getByTestId('monitor-group-btn-GRP-101');
      expect(monitorBtn).toBeInTheDocument();
      fireEvent.click(monitorBtn);

      await waitFor(() => {
        expect(screen.getByTestId('group-countdown-strip')).toBeInTheDocument();
      });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/برنامج تشغيل وتأمين الخط الثاني/);
    });

    it('navigates to monitoring dashboard from Group Editor header button', async () => {
      renderWithApp('/admin/groups/GRP-101/edit', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('go-to-monitoring-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('go-to-monitoring-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('cohort-metric-total-members')).toBeInTheDocument();
      });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/برنامج تشغيل وتأمين الخط الثاني/);
    });

    it('redirects canonical alias /admin/group-monitoring/:groupId to /admin/groups/:groupId/monitoring', async () => {
      renderWithApp('/admin/group-monitoring/GRP-101', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('cohort-metric-total-members')).toBeInTheDocument();
      });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/برنامج تشغيل وتأمين الخط الثاني/);
    });

    it('allows assigned supervisor lecturer to view group monitoring dashboard', async () => {
      // Ensure lecturer is assigned as supervisor to GRP-101
      const group = inMemoryStore.getGroupById('GRP-101');
      expect(group).toBeTruthy();
      if (!group?.supervisorIds?.includes(lecturerUser.id)) {
        inMemoryStore.updateGroup('GRP-101', {
          supervisorIds: [...(group?.supervisorIds || []), lecturerUser.id],
        });
      }

      renderWithApp('/admin/groups/GRP-101/monitoring', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('cohort-metric-total-members')).toBeInTheDocument();
      });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/برنامج تشغيل وتأمين الخط الثاني/);
    });

    it('blocks unassigned lecturer and trainee with unauthorized alert', async () => {
      // Remove lecturer from GRP-101 supervisors
      const group = inMemoryStore.getGroupById('GRP-101');
      if (group) {
        inMemoryStore.updateGroup('GRP-101', {
          supervisorIds: (group.supervisorIds || []).filter((id) => id !== lecturerUser.id),
        });
      }

      renderWithApp('/admin/groups/GRP-101/monitoring', lecturerUser);

      await waitFor(() => {
        expect(screen.getByTestId('admin-monitoring-unauthorized')).toBeInTheDocument();
      });
      expect(screen.getByText(/غير مصرح لك بالوصول/)).toBeInTheDocument();
    });
  });

  // ── 2. Group-Level Cohort Overview Metrics ───────────────────────────

  describe('2. Group Summary and Cohort Overview Metrics', () => {
    it('calculates cohort summary metrics correctly without division by zero', async () => {
      renderWithApp('/admin/groups/GRP-101/monitoring', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('cohort-metric-total-members')).toBeInTheDocument();
      });

      // Total members
      const membersCard = screen.getByTestId('cohort-metric-total-members');
      expect(membersCard).toHaveTextContent(/2|3/);

      // Assigned courses
      const coursesCard = screen.getByTestId('cohort-metric-assigned-courses');
      expect(coursesCard).toHaveTextContent(/أساسي/);

      // Started trainees & completed all core
      expect(screen.getByTestId('cohort-metric-started-trainees')).toBeInTheDocument();
      expect(screen.getByTestId('cohort-metric-completed-core')).toBeInTheDocument();

      // Attempts summary
      expect(screen.getByTestId('cohort-metric-attempts')).toBeInTheDocument();

      // Average cohort progress
      expect(screen.getByTestId('cohort-metric-avg-progress')).toHaveTextContent(/%/);

      // Countdown strip
      expect(screen.getByTestId('group-countdown-strip')).toBeInTheDocument();
    });

    it('renders empty group state cleanly when group has 0 members and 0 courses', async () => {
      // Create fresh draft group with 0 members and 0 courses
      const draft = inMemoryStore.createGroup({
        name: 'مجموعة تجريبية فارغة',
        description: 'مجموعة فارغة لاختبار المؤشرات والحالات الصفرية',
        startDateTime: '2026-05-01T08:00:00Z',
        deadlineDateTime: '2026-06-01T18:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
        adminStatus: 'active',
        enrollmentPolicy: 'open',
      });

      renderWithApp(`/admin/groups/${draft.id}/monitoring`, adminUser);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: 'مجموعة تجريبية فارغة' })
        ).toBeInTheDocument();
      });

      const membersCard = screen.getByTestId('cohort-metric-total-members');
      expect(membersCard).toHaveTextContent('0');

      const progressCard = screen.getByTestId('cohort-metric-avg-progress');
      expect(progressCard).toHaveTextContent('0%');

      // Empty trainees state
      expect(screen.getByTestId('empty-trainees-state')).toBeInTheDocument();
    });
  });

  // ── 3. Trainee Progress Matrix & Filtering ───────────────────────────

  describe('3. Trainee Progress Table, Search and Status Filtering', () => {
    it('renders trainee progress rows and filters by search query', async () => {
      renderWithApp('/admin/groups/GRP-101/monitoring', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('trainees-table')).toBeInTheDocument();
      });

      // Default rows exist
      const searchInput = screen.getByTestId('trainee-search-input');
      expect(searchInput).toBeInTheDocument();

      // Search for specific trainee (أحمد)
      fireEvent.change(searchInput, { target: { value: 'أحمد' } });

      await waitFor(() => {
        const rows = screen.getAllByTestId(/trainee-row-/);
        expect(rows.length).toBeGreaterThan(0);
      });

      // Search non-existent
      fireEvent.change(searchInput, { target: { value: 'اسم غير موجود إطلاقاً' } });
      await waitFor(() => {
        expect(screen.getByTestId('empty-trainees-state')).toBeInTheDocument();
      });

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      await waitFor(() => {
        expect(screen.getByTestId('trainees-table')).toBeInTheDocument();
      });
    });

    it('filters trainees by status filter options', async () => {
      renderWithApp('/admin/groups/GRP-101/monitoring', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('trainee-status-filter')).toBeInTheDocument();
      });

      const statusSelect = screen.getByTestId('trainee-status-filter');

      // Filter by completed_core
      fireEvent.change(statusSelect, { target: { value: 'completed_core' } });
      expect(statusSelect).toHaveValue('completed_core');

      // Filter by in_progress
      fireEvent.change(statusSelect, { target: { value: 'in_progress' } });
      expect(statusSelect).toHaveValue('in_progress');

      // Reset to all
      fireEvent.change(statusSelect, { target: { value: 'all' } });
      expect(statusSelect).toHaveValue('all');
    });
  });

  // ── 4. Trainee Drilldown Modal & Attempt Ledger ──────────────────────

  describe('4. Trainee Drilldown Modal and Attempt History Indicator', () => {
    it('opens TraineeProgressModal and displays attempt badge indicator and course breakdown', async () => {
      renderWithApp('/admin/groups/GRP-101/monitoring', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('trainees-table')).toBeInTheDocument();
      });

      // Find first trainee's detail button
      const detailButtons = screen.getAllByTestId(/view-trainee-progress-btn-/);
      expect(detailButtons.length).toBeGreaterThan(0);
      fireEvent.click(detailButtons[0]);

      // Trainee Progress Modal opens
      await waitFor(() => {
        expect(screen.getByTestId('trainee-progress-modal')).toBeInTheDocument();
      });

      expect(screen.getByTestId('modal-overall-progress-text')).toBeInTheDocument();
      expect(screen.getByTestId('modal-core-status-badge')).toBeInTheDocument();

      // Courses list rendered
      const coursesList = screen.getByTestId('modal-courses-list');
      expect(coursesList).toBeInTheDocument();

      // Course attempt indicator section loads
      await waitFor(() => {
        const attemptBadges = screen.getAllByTestId(/attempt-badge-/);
        expect(attemptBadges.length).toBeGreaterThan(0);
        expect(attemptBadges[0]).toHaveTextContent(/محاولتك/);
      });

      // Toggle history accordion
      const toggleBtns = screen.getAllByTestId(/toggle-history-btn-/);
      if (toggleBtns.length > 0) {
        fireEvent.click(toggleBtns[0]);
        await waitFor(() => {
          expect(screen.getByTestId(/attempt-history-list-/)).toBeInTheDocument();
        });
      }

      // Close modal
      const closeBtn = screen.getByTestId('close-trainee-progress-modal-btn');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('trainee-progress-modal')).not.toBeInTheDocument();
      });
    });
  });

  // ── 5. Course-Level Progress & Precedence Resolution ─────────────────

  describe('5. Courses View and Effective Date Precedence', () => {
    it('switches to courses tab and renders course progress cards with 3-level date precedence', async () => {
      renderWithApp('/admin/groups/GRP-101/monitoring', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('tab-courses-view')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('tab-courses-view'));

      await waitFor(() => {
        const cards = screen.getAllByTestId(/course-progress-card-/);
        expect(cards.length).toBeGreaterThan(0);
      });

      // CRS001 card checks
      const crsCard = screen.getByTestId('course-progress-card-CRS001');
      expect(crsCard).toBeInTheDocument();
      expect(crsCard).toHaveTextContent(/مقرر أساسي|مقرر تذكيري/);
      expect(crsCard).toHaveTextContent(/مسجلين/);
      expect(crsCard).toHaveTextContent(/بدأوا/);
      expect(crsCard).toHaveTextContent(/أكملوا/);
      expect(crsCard).toHaveTextContent(/متوسط إنجاز المقرر/);
    });
  });

  // ── 6. Consolidated Summary Without Obsolete Cycle Selector ──────────

  describe('6. Consolidated Group Schedule Summary Without Obsolete Multi-Cycle Switcher', () => {
    it('summarizes the group schedule in one compact overview without the obsolete cycle selector or duplicate requests button', async () => {
      renderWithApp('/admin/groups/GRP-101/monitoring', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-monitoring-status-overview')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('cycle-selector')).not.toBeInTheDocument();
      expect(screen.queryByTestId('overview-open-requests-btn')).not.toBeInTheDocument();
      expect(screen.getByTestId('overview-schedule-summary')).toBeInTheDocument();
      expect(screen.getByTestId('temporal-status-badge')).toBeInTheDocument();
    });
  });

  // ── 7. Group Status Overview & Enrollment Request Monitoring ─────────

  describe('7. Group Status Overview & Enrollment Request Management in Monitoring Page', () => {
    it('displays compact group status overview and allows approving and rejecting enrollment requests', async () => {
      renderWithApp('/admin/groups/GRP-101/monitoring', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-monitoring-status-overview')).toBeInTheDocument();
      });

      expect(screen.getByTestId('overview-lifecycle-status')).toHaveTextContent(/نشطة/);
      expect(screen.getByTestId('overview-enrollment-status')).toHaveTextContent(/التسجيل مفتوح/);
      expect(screen.getByTestId('overview-schedule-summary')).toBeInTheDocument();
      expect(screen.getByTestId('overview-capacity-requests')).toBeInTheDocument();
      expect(screen.getByTestId('tab-join-requests-view')).toBeInTheDocument();

      // Switch to join requests tab
      fireEvent.click(screen.getByTestId('tab-join-requests-view'));

      await waitFor(() => {
        expect(screen.getByTestId('join-requests-view')).toBeInTheDocument();
      });
    });
  });
});
