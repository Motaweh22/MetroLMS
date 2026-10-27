import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import {
  validateRenewalIntervalDays,
  calculateNextRenewalDate,
  calculateNextRenewalDateSafe,
  migrateLegacyRecurrenceType,
} from '@/core/domain/groups';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import type { TrainingGroup } from '@/core/groups/types';

describe('Custom Day-Based Automatic Group Renewal', () => {
  describe('1. Interval Validation (Whole positive integers only)', () => {
    it('accepts valid custom positive integer days', () => {
      const validCases = [1, 17, 30, 45, 60, 75, 90, 120, 365, 730];
      for (const days of validCases) {
        const result = validateRenewalIntervalDays(days);
        expect(result.isValid).toBe(true);
        expect(result.intervalDays).toBe(days);
        expect(result.error).toBeUndefined();
      }
    });

    it('accepts string representations of positive integers', () => {
      const result = validateRenewalIntervalDays('45');
      expect(result.isValid).toBe(true);
      expect(result.intervalDays).toBe(45);
    });

    it('rejects empty, null, or undefined values with Arabic message', () => {
      const emptyCases = ['', '   ', null, undefined];
      for (const val of emptyCases) {
        const result = validateRenewalIntervalDays(val);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('يرجى إدخال عدد أيام فترة التجديد الدوري');
      }
    });

    it('rejects zero and negative numbers', () => {
      const nonPositive = [0, -1, -15, -60, '0', '-5'];
      for (const val of nonPositive) {
        const result = validateRenewalIntervalDays(val);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('يجب أن تكون فترة التجديد يوماً واحداً على الأقل');
      }
    });

    it('rejects fractional and decimal numbers without silent truncation', () => {
      const fractions = [1.5, 30.2, 0.5, 45.9, '15.5'];
      for (const val of fractions) {
        const result = validateRenewalIntervalDays(val);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('يجب أن تكون فترة التجديد رقماً صحيحاً من الأيام');
      }
    });

    it('rejects non-numeric characters and strings', () => {
      const invalidStrings = ['abc', '30days', 'one_month', NaN, Infinity];
      for (const val of invalidStrings) {
        const result = validateRenewalIntervalDays(val);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('يجب أن تكون فترة التجديد رقماً صحيحاً من الأيام');
      }
    });

    it('rejects values exceeding the safety maximum of 730 days (2 years)', () => {
      const result = validateRenewalIntervalDays(731);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('فترة التجديد لا يمكن أن تتجاوز 730 يوماً (سنتين)');

      const result1000 = validateRenewalIntervalDays(1000);
      expect(result1000.isValid).toBe(false);
      expect(result1000.error).toBe('فترة التجديد لا يمكن أن تتجاوز 730 يوماً (سنتين)');
    });
  });

  describe('2. Next Cycle Date Calculation (Current cycle start + N calendar days)', () => {
    it('calculates next renewal date accurately: Oct 1 + 30 days = Oct 31', () => {
      const anchor = '2026-10-01T08:00:00.000Z';
      const nextDate = calculateNextRenewalDate(anchor, 30);
      const d = new Date(nextDate);

      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(9); // 0-indexed: 9 = October
      expect(d.getUTCDate()).toBe(31);
      expect(d.getUTCHours()).toBe(8);
    });

    it('handles month boundaries correctly across 28/30/31 day months', () => {
      // Jan 31 + 28 days -> Feb 28
      const jan31 = '2026-01-31T09:00:00.000Z';
      const febDate = calculateNextRenewalDate(jan31, 28);
      const dFeb = new Date(febDate);
      expect(dFeb.getUTCFullYear()).toBe(2026);
      expect(dFeb.getUTCMonth()).toBe(1); // February
      expect(dFeb.getUTCDate()).toBe(28);

      // April 15 (30-day month) + 20 days -> May 5
      const apr15 = '2026-04-15T10:00:00.000Z';
      const mayDate = calculateNextRenewalDate(apr15, 20);
      const dMay = new Date(mayDate);
      expect(dMay.getUTCFullYear()).toBe(2026);
      expect(dMay.getUTCMonth()).toBe(4); // May
      expect(dMay.getUTCDate()).toBe(5);
    });

    it('handles year transitions correctly without off-by-one errors', () => {
      // Dec 15, 2026 + 30 days -> Jan 14, 2027
      const dec15 = '2026-12-15T12:00:00.000Z';
      const janNextYear = calculateNextRenewalDate(dec15, 30);
      const dNextYear = new Date(janNextYear);
      expect(dNextYear.getUTCFullYear()).toBe(2027);
      expect(dNextYear.getUTCMonth()).toBe(0); // January
      expect(dNextYear.getUTCDate()).toBe(14);
    });

    it('supports custom intervals such as 17, 45, 75, and 120 days', () => {
      const anchor = '2026-06-01T00:00:00.000Z';

      const d17 = new Date(calculateNextRenewalDate(anchor, 17));
      expect(d17.getUTCDate()).toBe(18); // June 1 + 17 = June 18

      const d45 = new Date(calculateNextRenewalDate(anchor, 45));
      expect(d45.getUTCMonth()).toBe(6); // July (June has 30 days; 45 - 29 = 16)
      expect(d45.getUTCDate()).toBe(16);

      const d75 = new Date(calculateNextRenewalDate(anchor, 75));
      expect(d75.getUTCMonth()).toBe(7); // August (June 30 + July 31 = 61 days; 75 - 60 = 15)
      expect(d75.getUTCDate()).toBe(15);
    });

    it('throws error for invalid anchor or invalid interval', () => {
      expect(() => calculateNextRenewalDate('invalid-date', 30)).toThrow('تاريخ بداية الدورة المرجعي غير صالح');
      expect(() => calculateNextRenewalDate('2026-10-01T00:00:00.000Z', 0)).toThrow();
      expect(() => calculateNextRenewalDate('2026-10-01T00:00:00.000Z', -5)).toThrow();
    });

    it('calculateNextRenewalDateSafe returns null gracefully for invalid inputs', () => {
      expect(calculateNextRenewalDateSafe(null, 30)).toBeNull();
      expect(calculateNextRenewalDateSafe('2026-10-01T00:00:00.000Z', '')).toBeNull();
      expect(calculateNextRenewalDateSafe('2026-10-01T00:00:00.000Z', -10)).toBeNull();
      expect(calculateNextRenewalDateSafe('invalid-date', 30)).toBeNull();
      expect(calculateNextRenewalDateSafe('2026-10-01T00:00:00.000Z', 30)).not.toBeNull();
    });
  });

  describe('3. Backward Compatibility Migration for Predefined Schedules', () => {
    it('migrates legacy monthly schedule to 30 days', () => {
      const schedule = migrateLegacyRecurrenceType({ recurrenceType: 'monthly', autoRenewalEnabled: true });
      expect(schedule.intervalDays).toBe(30);
      expect(schedule.renewalIntervalDays).toBe(30);
      expect(schedule.autoRenewalEnabled).toBe(true);
      expect(schedule.recurrenceType).toBe('monthly');
    });

    it('migrates legacy bimonthly schedule to 60 days', () => {
      const schedule = migrateLegacyRecurrenceType({ recurrenceType: 'bimonthly', autoRenewalEnabled: true });
      expect(schedule.intervalDays).toBe(60);
      expect(schedule.renewalIntervalDays).toBe(60);
      expect(schedule.autoRenewalEnabled).toBe(true);
      expect(schedule.recurrenceType).toBe('bimonthly');
    });

    it('migrates legacy quarterly schedule to 90 days', () => {
      const schedule = migrateLegacyRecurrenceType({ recurrenceType: 'quarterly', autoRenewalEnabled: true });
      expect(schedule.intervalDays).toBe(90);
      expect(schedule.renewalIntervalDays).toBe(90);
      expect(schedule.autoRenewalEnabled).toBe(true);
      expect(schedule.recurrenceType).toBe('quarterly');
    });

    it('migrates legacy none schedule to disabled with null interval', () => {
      const schedule = migrateLegacyRecurrenceType({ recurrenceType: 'none', autoRenewalEnabled: false });
      expect(schedule.intervalDays).toBeNull();
      expect(schedule.renewalIntervalDays).toBeNull();
      expect(schedule.autoRenewalEnabled).toBe(false);
      expect(schedule.recurrenceType).toBe('none');
    });

    it('preserves existing custom interval days when provided', () => {
      const schedule = migrateLegacyRecurrenceType({
        autoRenewalEnabled: true,
        renewalIntervalDays: 45,
      });
      expect(schedule.intervalDays).toBe(45);
      expect(schedule.renewalIntervalDays).toBe(45);
      expect(schedule.autoRenewalEnabled).toBe(true);
      expect(schedule.recurrenceType).toBe('custom');
    });
  });

  describe('4. Mock Store Save, Load & Renewal Lifecycle', () => {
    let testGroup: TrainingGroup;

    beforeEach(() => {
      // Create a test group with custom interval of 45 days starting in the future (Nov 1, 2026)
      testGroup = inMemoryStore.createGroup({
        name: `مجموعة تجديد مخصصة 45 يوماً ${Date.now()}`,
        description: 'مجموعة اختبار التجديد الآلي بالأيام',
        startDateTime: '2026-11-01T08:00:00.000Z',
        deadlineDateTime: '2026-12-16T18:00:00.000Z',
        postDeadlinePolicy: 'keep_no_cert',
        courseAssignments: [
          { courseId: 'CRS001', courseRole: 'core', order: 1 },
          { courseId: 'CRS002', courseRole: 'reminder', order: 2 },
        ],
        renewalSchedule: {
          autoRenewalEnabled: true,
          renewalIntervalDays: 45,
          intervalDays: 45,
        },
      });

      // Add a member
      const group = inMemoryStore.getGroupById(testGroup.id);
      if (group) {
        group.traineeIds = ['usr_trainee_001'];
      }
    });

    it('persists and retrieves custom day interval across store operations', () => {
      const retrieved = inMemoryStore.getGroupById(testGroup.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.renewalSchedule?.autoRenewalEnabled).toBe(true);
      expect(retrieved?.renewalSchedule?.renewalIntervalDays).toBe(45);
      expect(retrieved?.renewalSchedule?.intervalDays).toBe(45);

      // Update interval to 17 days
      const updated = inMemoryStore.updateGroup(testGroup.id, {
        renewalSchedule: {
          autoRenewalEnabled: true,
          renewalIntervalDays: 17,
          intervalDays: 17,
        },
      });
      expect(updated.renewalSchedule?.renewalIntervalDays).toBe(17);
      expect(updated.renewalSchedule?.intervalDays).toBe(17);
    });

    it('does not trigger automatic renewal before the scheduled renewal date is reached', () => {
      // Check auto renewal on Nov 15, 2026 (only 14 days passed; interval is 45 days, due on Dec 16)
      const earlyDate = new Date('2026-11-15T00:00:00.000Z');
      const result = inMemoryStore.checkAndProcessAutoRenewal(testGroup.id, earlyDate);

      expect(result.renewed).toBe(false);
      expect(result.cycle).toBeUndefined();
    });

    it('triggers automatic renewal when the scheduled renewal date is reached', () => {
      // Group start is 2026-11-01. 45 days later = 2026-12-16.
      // Call checkAndProcessAutoRenewal on 2026-12-17 (due)
      const dueDate = new Date('2026-12-17T10:00:00.000Z');
      const result = inMemoryStore.checkAndProcessAutoRenewal(testGroup.id, dueDate);

      expect(result.renewed).toBe(true);
      expect(result.cycle).toBeDefined();
      expect(result.cycle?.cycleNumber).toBe(2);

      // Verify scheduled start date is Nov 1 + 45 days = Dec 16
      const cycleStart = new Date(result.cycle!.startDateTime);
      expect(cycleStart.getUTCMonth()).toBe(11); // Dec (0-indexed 11)
      expect(cycleStart.getUTCDate()).toBe(16);

      // Verify cycle deadline is Dec 16 + 45 days = Jan 30, 2027
      const cycleDeadline = new Date(result.cycle!.deadlineDateTime);
      expect(cycleDeadline.getUTCFullYear()).toBe(2027);
      expect(cycleDeadline.getUTCMonth()).toBe(0); // Jan
      expect(cycleDeadline.getUTCDate()).toBe(30);

      // Previous active cycle should be sealed as completed
      const allCycles = inMemoryStore.getGroupCycles(testGroup.id);
      const cycle1 = allCycles.find((c) => c.cycleNumber === 1);
      expect(cycle1?.status).toBe('completed');
      expect(cycle1?.completedAt).toBeDefined();

      // New cycle should be active
      const cycle2 = allCycles.find((c) => c.cycleNumber === 2);
      expect(cycle2?.status).toBe('active');
    });

    it('preserves course roles (core vs reminder) and synchronization on renewed cycle', () => {
      const dueDate = new Date('2026-12-17T10:00:00.000Z');
      const result = inMemoryStore.checkAndProcessAutoRenewal(testGroup.id, dueDate);
      expect(result.renewed).toBe(true);

      const cycleCourses = result.cycle!.courses;
      expect(cycleCourses.length).toBe(2);

      const crs1 = cycleCourses.find((c) => c.courseId === 'CRS001');
      expect(crs1?.courseRole).toBe('core');

      const crs2 = cycleCourses.find((c) => c.courseId === 'CRS002');
      expect(crs2?.courseRole).toBe('reminder');
    });

    it('provisions fresh unstarted CourseAttempts with attemptNumber null and 0% progress', () => {
      const dueDate = new Date('2026-12-17T10:00:00.000Z');
      const result = inMemoryStore.checkAndProcessAutoRenewal(testGroup.id, dueDate);
      expect(result.renewed).toBe(true);

      const newCycleId = result.cycle!.id;
      const stats = inMemoryStore.getCourseAttemptStatsForTrainee('usr_trainee_001', 'CRS001', newCycleId);

      // Trainee has unstarted fresh attempt
      expect(stats.hasStartedCurrentAttempt).toBe(false);
      expect(stats.currentAttemptNumber).toBeNull();
      expect(stats.currentAttempt?.status).toBe('not_started');
      expect(stats.currentAttempt?.progressPercent).toBe(0);
      expect(stats.currentAttempt?.startedAt).toBeNull();
    });

    it('guarantees idempotency: repeated processing of a due interval creates exactly one cycle', () => {
      const dueDate = new Date('2026-12-17T10:00:00.000Z');

      // First run: renews
      const firstRun = inMemoryStore.checkAndProcessAutoRenewal(testGroup.id, dueDate);
      expect(firstRun.renewed).toBe(true);

      // Second run immediately or on repeated page visit: NO duplicate cycle!
      const secondRun = inMemoryStore.checkAndProcessAutoRenewal(testGroup.id, dueDate);
      expect(secondRun.renewed).toBe(false);
      expect(secondRun.cycle).toBeUndefined();

      // Third run hours later on same day: still NO duplicate cycle!
      const laterSameDay = new Date('2026-12-17T18:00:00.000Z');
      const thirdRun = inMemoryStore.checkAndProcessAutoRenewal(testGroup.id, laterSameDay);
      expect(thirdRun.renewed).toBe(false);

      // Total cycles must remain exactly 2 (Cycle 1 + Cycle 2)
      const allCycles = inMemoryStore.getGroupCycles(testGroup.id);
      expect(allCycles.length).toBe(2);
    });

    it('handles overdue periods deterministically without flooding store with multiple cycles', () => {
      // Fast forward to far future (several intervals overdue)
      const farFutureDate = new Date('2027-06-01T00:00:00.000Z');
      const result = inMemoryStore.checkAndProcessAutoRenewal(testGroup.id, farFutureDate);
      expect(result.renewed).toBe(true);

      // Calling again on the same far-future date does not spawn further cycles
      const followUp = inMemoryStore.checkAndProcessAutoRenewal(testGroup.id, farFutureDate);
      expect(followUp.renewed).toBe(false);

      // Verify the updated nextScheduledRenewalDate is safely set beyond farFutureDate
      const updatedGroup = inMemoryStore.getGroupById(testGroup.id);
      expect(updatedGroup?.renewalSchedule?.nextScheduledRenewalDate).toBeDefined();
      expect(
        new Date(updatedGroup!.renewalSchedule!.nextScheduledRenewalDate!).getTime()
      ).toBeGreaterThan(farFutureDate.getTime());
    });
  });

  describe('5. UI Integration & Form Validation (GroupEditorPage)', () => {
    const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => {
      server.resetHandlers();
      authStorage.clearSession();
      inMemoryStore.reset({ seedReviewDemo: false });
    });
    afterAll(() => server.close());

    beforeEach(() => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });
    });

    it('renders auto-renewal toggle and toggles interval controls', async () => {
      render(<AppRouter initialEntries={['/admin/groups/new']} />);

      await waitFor(() => {
        expect(screen.getByTestId('auto-renewal-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('auto-renewal-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      // Interval input should not be shown initially when disabled
      expect(screen.queryByTestId('renewal-interval-days-input')).not.toBeInTheDocument();

      // Toggle ON
      fireEvent.click(toggle);
      expect(toggle.checked).toBe(true);

      // Now interval input and presets appear
      expect(screen.getByTestId('renewal-interval-days-input')).toBeInTheDocument();
      expect(screen.getByTestId('preset-interval-30')).toBeInTheDocument();
      expect(screen.getByTestId('preset-interval-60')).toBeInTheDocument();
      expect(screen.getByTestId('preset-interval-90')).toBeInTheDocument();
    });

    it('preset buttons update the same numeric input field', async () => {
      render(<AppRouter initialEntries={['/admin/groups/new']} />);

      await waitFor(() => {
        expect(screen.getByTestId('auto-renewal-toggle')).toBeInTheDocument();
      });

      // Enable auto renewal
      fireEvent.click(screen.getByTestId('auto-renewal-toggle'));

      const input = screen.getByTestId('renewal-interval-days-input') as HTMLInputElement;

      // Click 60 days preset
      fireEvent.click(screen.getByTestId('preset-interval-60'));
      expect(input.value).toBe('60');

      // Click 90 days preset
      fireEvent.click(screen.getByTestId('preset-interval-90'));
      expect(input.value).toBe('90');

      // Click 30 days preset
      fireEvent.click(screen.getByTestId('preset-interval-30'));
      expect(input.value).toBe('30');
    });

    it('custom input updates numeric field and recalculates live preview', async () => {
      render(<AppRouter initialEntries={['/admin/groups/new']} />);

      await waitFor(() => {
        expect(screen.getByTestId('auto-renewal-toggle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('auto-renewal-toggle'));
      const input = screen.getByTestId('renewal-interval-days-input') as HTMLInputElement;

      // Type custom interval: 45
      fireEvent.change(input, { target: { value: '45' } });
      expect(input.value).toBe('45');

      // Live preview appears
      await waitFor(() => {
        expect(screen.getByTestId('calculated-next-renewal-date-preview')).toBeInTheDocument();
      });
      expect(screen.getByText(/تاريخ التجديد الآلي القادم المحتسب/i)).toBeInTheDocument();
      expect(screen.getByText(/45 يوماً/i)).toBeInTheDocument();
    });

    it('shows Arabic validation error when interval is empty or invalid on submit', async () => {
      render(<AppRouter initialEntries={['/admin/groups/new']} />);

      await waitFor(() => {
        expect(screen.getByTestId('save-group-btn')).toBeInTheDocument();
      });

      // Fill basic required group fields
      fireEvent.change(screen.getByTestId('group-name-input'), {
        target: { value: 'مجموعة تجريبية لاختبار التحقق' },
      });
      fireEvent.change(screen.getByTestId('group-desc-input'), {
        target: { value: 'وصف المجموعة التدريبية المعتمد للاختبار' },
      });

      // Enable auto renewal and clear interval
      fireEvent.click(screen.getByTestId('auto-renewal-toggle'));
      const input = screen.getByTestId('renewal-interval-days-input');
      fireEvent.change(input, { target: { value: '' } });

      // Submit
      fireEvent.click(screen.getByTestId('save-group-btn'));

      // Validation error appears
      await waitFor(() => {
        expect(screen.getByTestId('renewal-interval-error')).toBeInTheDocument();
        expect(screen.getByText('يرجى إدخال عدد أيام فترة التجديد الدوري')).toBeInTheDocument();
      });
    });
  });
});
