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

function renderWithApp(initialRoute: string, user: User = adminUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={[initialRoute]} />);
}

describe('Increment 10 — Phase 5: Course Assignment, Renewal Schedules & Date Overrides', () => {
  // ── 1. Courses Tab & Renewal Cycle Switcher Rendering ─────────────────

  describe('1. Course Assignment Tab & Active Cycle Presentation', () => {
    it('renders course assignment tab with active cycle details and assigned courses', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=courses', adminUser);

      // Loading state disappears
      await waitFor(
        () => {
          expect(screen.getByTestId('group-courses-tab')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Header and active cycle banner
      expect(screen.getByText('دورات التجديد التدريبي والمقررات')).toBeInTheDocument();
      expect(screen.getByTestId('selected-cycle-status-badge')).toHaveTextContent(
        'الدورة النشطة الحالية'
      );
      expect(screen.getByTestId('start-renew-cycle-btn')).toBeInTheDocument();

      // Cycle tabs contain Cycle 1
      expect(screen.getByTestId('cycle-tab-CYC-GRP-101-01')).toBeInTheDocument();

      // Assigned courses panel & table
      expect(screen.getByTestId('assigned-courses-panel')).toBeInTheDocument();
      expect(screen.getByTestId('course-row-CRS001')).toBeInTheDocument();
      expect(screen.getByTestId('course-row-CRS002')).toBeInTheDocument();

      // Check roles
      expect(screen.getByTestId('role-badge-CRS001')).toHaveTextContent('دورة أساسية');
      expect(screen.getByTestId('role-badge-CRS002')).toHaveTextContent('دورة تنشيطية');
    });

    it('switches between general settings and courses tabs in group editor', async () => {
      renderWithApp('/admin/groups/GRP-101/edit', adminUser);

      // Starts on general settings tab
      await waitFor(() => {
        expect(screen.getByTestId('group-name-input')).toBeInTheDocument();
      });

      // Click on courses tab
      const coursesTabBtn = screen.getByTestId('tab-courses');
      fireEvent.click(coursesTabBtn);

      await waitFor(() => {
        expect(screen.getByTestId('group-courses-tab')).toBeInTheDocument();
      });

      // Click back to general settings tab
      const generalTabBtn = screen.getByTestId('tab-general-settings');
      fireEvent.click(generalTabBtn);

      await waitFor(() => {
        expect(screen.getByTestId('group-name-input')).toBeInTheDocument();
      });
    });
  });

  // ── 2. Course Designation: Core vs. Reminder ──────────────────────────

  describe('2. Course Designation & Role Toggle', () => {
    it('toggles course role between core and reminder and enables save button', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=courses', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-row-CRS002')).toBeInTheDocument();
      });

      // Initially CRS002 is reminder
      expect(screen.getByTestId('role-badge-CRS002')).toHaveTextContent('دورة تنشيطية');

      // Click toggle role
      const toggleBtn = screen.getByTestId('toggle-role-btn-CRS002');
      fireEvent.click(toggleBtn);

      // Now CRS002 becomes core
      expect(screen.getByTestId('role-badge-CRS002')).toHaveTextContent('دورة أساسية');

      // Dirty indicator and save button are enabled
      expect(screen.getByTestId('save-cycle-courses-btn')).not.toBeDisabled();
    });
  });

  // ── 3. Date Overrides & Effective Date Precedence ─────────────────────

  describe('3. Date Overrides & Independent Precedence Resolution', () => {
    it('opens CourseOverrideModal, configures independent start override, and reflects effective inheritance', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=courses', adminUser);

      await waitFor(
        () => {
          expect(screen.getByTestId('course-row-CRS001')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Click customize dates on CRS001
      const customizeBtn = screen.getByTestId('customize-dates-btn-CRS001');
      fireEvent.click(customizeBtn);

      // Modal appears
      await waitFor(() => {
        expect(screen.getByTestId('course-override-modal')).toBeInTheDocument();
      });

      expect(screen.getByText('تخصيص مواعيد وسياسة المقرر التدريبي')).toBeInTheDocument();

      // Initially start date badge is inherited
      expect(screen.getByTestId('start-inheritance-badge')).toHaveTextContent('موروث من دورة التدريب');

      // Enter custom start date (within valid bounds)
      const startInput = screen.getByTestId('custom-start-input');
      fireEvent.change(startInput, { target: { value: '2026-10-15T09:00' } });

      // Badge changes to custom
      expect(screen.getByTestId('start-inheritance-badge')).toHaveTextContent('مخصص لهذا المقرر');
      // Deadline remains inherited
      expect(screen.getByTestId('deadline-inheritance-badge')).toHaveTextContent('موروث من دورة التدريب');

      // Apply overrides
      const applyBtn = screen.getByTestId('apply-override-modal-btn');
      fireEvent.click(applyBtn);

      // Modal closes
      await waitFor(() => {
        expect(screen.queryByTestId('course-override-modal')).not.toBeInTheDocument();
      });

      // Verify table row displays custom start and inherited deadline
      const crs001Row = screen.getByTestId('course-row-CRS001');
      expect(crs001Row).toHaveTextContent('• مخصص لهذا المقرر');
      expect(crs001Row).toHaveTextContent('مواعيد مخصصة');
    });

    it('validates invalid date range in override modal and disables apply button', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=courses', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('customize-dates-btn-CRS001')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('customize-dates-btn-CRS001'));

      await waitFor(() => {
        expect(screen.getByTestId('course-override-modal')).toBeInTheDocument();
      });

      // Enter start date that exceeds cycle deadline (cycle deadline is 2026-10-27)
      const startInput = screen.getByTestId('custom-start-input');
      fireEvent.change(startInput, { target: { value: '2026-11-20T08:00' } });

      // Error banner appears
      await waitFor(() => {
        expect(screen.getByTestId('override-validation-error')).toBeInTheDocument();
        expect(
          screen.getByText('يجب أن يكون تاريخ وموعد النهاية بعد تاريخ وموعد البداية')
        ).toBeInTheDocument();
      });

      // Apply button is disabled
      expect(screen.getByTestId('apply-override-modal-btn')).toBeDisabled();
    });

    it('clears date overrides and falls back to inherited cycle values', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=courses', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-row-CRS002')).toBeInTheDocument();
      });

      // CRS002 initially has custom deadline from mockGroups
      const crs002Row = screen.getByTestId('course-row-CRS002');
      expect(crs002Row).toHaveTextContent('مواعيد مخصصة');

      // Click clear override
      const clearBtn = screen.getByTestId('clear-override-btn-CRS002');
      fireEvent.click(clearBtn);

      // Overrides cleared
      expect(crs002Row).toHaveTextContent('موروثة بالكامل');
    });
  });

  // ── 4. Add & Remove Courses and Persistence ───────────────────────────

  describe('4. Add/Remove Courses and API Persistence', () => {
    it('adds a course from catalog, rejects duplicates, and saves assignments to server', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=courses', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('select-course-to-add')).toBeInTheDocument();
      });

      // Select course to add (e.g. CRS003 if exists, or another unassigned course)
      const selectCourse = screen.getByTestId('select-course-to-add') as HTMLSelectElement;
      const options = Array.from(selectCourse.options).map((o) => o.value).filter(Boolean);

      // Verify neither CRS001 nor CRS002 is in unassigned options
      expect(options).not.toContain('CRS001');
      expect(options).not.toContain('CRS002');

      if (options.length > 0) {
        const newCourseId = options[0];
        fireEvent.change(selectCourse, { target: { value: newCourseId } });

        // Select role reminder
        fireEvent.change(screen.getByTestId('select-role-to-add'), {
          target: { value: 'reminder' },
        });

        // Click Add
        fireEvent.click(screen.getByTestId('add-course-btn'));

        // Row appears
        await waitFor(() => {
          expect(screen.getByTestId(`course-row-${newCourseId}`)).toBeInTheDocument();
        });

        // Save assignments
        const saveBtn = screen.getByTestId('save-cycle-courses-btn');
        fireEvent.click(saveBtn);

        await waitFor(() => {
          // Toast or sync confirmation
          expect(screen.getByText('تعيينات المقررات متزامنة مع الخادم')).toBeInTheDocument();
        });

        // Check in store
        const cycles = inMemoryStore.getGroupCycles('GRP-101');
        const activeCycle = cycles.find((c) => c.status === 'active');
        expect(activeCycle?.courses.some((c) => c.courseId === newCourseId)).toBe(true);
      }
    });

    it('removes a course assignment from active cycle and updates state', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=courses', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('course-row-CRS002')).toBeInTheDocument();
      });

      // Remove CRS002
      const removeBtn = screen.getByTestId('remove-course-btn-CRS002');
      fireEvent.click(removeBtn);

      // Row is removed
      expect(screen.queryByTestId('course-row-CRS002')).not.toBeInTheDocument();

      // Save assignments
      fireEvent.click(screen.getByTestId('save-cycle-courses-btn'));

      await waitFor(() => {
        expect(screen.getByText('تعيينات المقررات متزامنة مع الخادم')).toBeInTheDocument();
      });

      // Verify store updated: only 1 course remains
      const cycles = inMemoryStore.getGroupCycles('GRP-101');
      const activeCycle = cycles.find((c) => c.status === 'active');
      expect(activeCycle?.courses.length).toBe(1);
      expect(activeCycle?.courses[0].courseId).toBe('CRS001');

      // Trainee historical attempt is NOT deleted when course is removed
      const attempts = inMemoryStore.getAttemptsStore();
      const crs002Attempt = attempts.find((a) => a.courseId === 'CRS002' && a.groupId === 'GRP-101');
      expect(crs002Attempt).toBeDefined();
    });
  });

  // ── 5. Renewal Cycle Creation & Historical Preservation ───────────────

  describe('5. Renewal Cycle Creation & Historical Isolation', () => {
    it('creates a new renewal cycle, seals Cycle 1 as completed, and preserves prior attempts', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=courses', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('start-renew-cycle-btn')).toBeInTheDocument();
      });

      // Click Start Renewal Cycle
      fireEvent.click(screen.getByTestId('start-renew-cycle-btn'));

      // Modal appears
      await waitFor(() => {
        expect(screen.getByTestId('start-renewal-cycle-modal')).toBeInTheDocument();
        expect(screen.getByText('بدء دورة تجديد تدريبي جديدة للمجموعة')).toBeInTheDocument();
      });

      // Check default title
      const titleInput = screen.getByTestId('cycle-title-input') as HTMLInputElement;
      expect(titleInput.value).toContain('دورة التجديد 2');

      // Check pre-populated courses in modal
      expect(screen.getByTestId('cycle-course-item-CRS001')).toBeInTheDocument();
      expect(screen.getByTestId('cycle-course-item-CRS002')).toBeInTheDocument();

      // Submit renewal
      const confirmBtn = screen.getByTestId('confirm-renew-btn');
      fireEvent.click(confirmBtn);

      // Wait for modal to close and new cycle to be active
      await waitFor(() => {
        expect(screen.queryByTestId('start-renewal-cycle-modal')).not.toBeInTheDocument();
      });

      // New cycle tab appears and is selected
      await waitFor(() => {
        expect(screen.getByTestId('cycle-tab-CYC-GRP-101-02')).toBeInTheDocument();
      });

      // Cycle 1 is now marked completed in store
      const cycles = inMemoryStore.getGroupCycles('GRP-101');
      const cycle1 = cycles.find((c) => c.cycleNumber === 1);
      const cycle2 = cycles.find((c) => c.cycleNumber === 2);

      expect(cycle1?.status).toBe('completed');
      expect(cycle2?.status).toBe('active');

      // Click on Cycle 1 tab to view historical completed cycle
      fireEvent.click(screen.getByTestId('cycle-tab-CYC-GRP-101-01'));

      await waitFor(() => {
        expect(screen.getByText(/دورة سابقة مكتملة ومحمية من التعديل/i)).toBeInTheDocument();
      });

      // Controls are disabled / closed on historical cycle
      expect(screen.queryByTestId('add-course-panel')).not.toBeInTheDocument();
    });
  });
});
