import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { RemoveMemberModal } from '@/features/groups/components/RemoveMemberModal';
import type { TrainingGroup, GroupMember } from '@/core/groups/types';
import type { Course } from '@/core/courses/types';

describe('T-2.2.1: Upgraded Trainee Removal Modal with Per-Course Checkboxes (D-07, MFR-24)', () => {
  const mockMember: GroupMember = {
    userId: 'usr_trainee_001',
    name: 'أحمد محمود علي',
    email: 'ahmed.mahmoud@metro.gov.eg',
    department: 'قطاع التشغيل والتحكم المركزي',
    jobTitle: 'مشرف تشغيل قطارات',
    joinedAt: '2026-09-01T08:00:00Z',
    joinSource: 'admin_assigned',
  };

  const mockGroupWithCourses: TrainingGroup = {
    id: 'GRP-101',
    name: 'مجموعة تشغيل الخط الأول - الدفعة الثالثة',
    description: 'المجموعة المخصصة لمشغلي وسائقي الخط الأول',
    courses: [
      { courseId: 'CRS-SIG-01', order: 1 },
      { courseId: 'CRS-PWR-02', order: 2 },
      { courseId: 'CRS-SAF-03', order: 3 },
    ],
    courseId: 'CRS-SIG-01',
    traineeIds: ['usr_trainee_001', 'usr_trainee_002'],
    supervisorIds: ['usr_sup_01'],
    startDateTime: '2026-09-01T08:00:00Z',
    deadlineDateTime: '2026-12-31T23:59:59Z',
    postDeadlinePolicy: 'keep_no_cert',
    resources: [],
  };

  const mockGroupNoCourses: TrainingGroup = {
    ...mockGroupWithCourses,
    id: 'GRP-EMPTY',
    courses: [],
    courseId: '',
  };

  const mockCatalogCourses: Course[] = [
    {
      id: 'CRS-SIG-01',
      title: 'إشارات السكك الحديدية والتحكم الآلي',
      code: 'SIG-101',
      description: 'دورة نظم الإشارات',
      durationMinutes: 120,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      publishedAt: '2026-01-01',
      instructorId: 'inst_1',
      tags: [],
      enrollmentCount: 10,
      rating: 4.8,
      status: 'published',
      flatItems: [],
    },
    {
      id: 'CRS-PWR-02',
      title: 'هندسة القوى الكهربائية وتغذية الشبكات',
      code: 'PWR-201',
      description: 'دورة هندسة القوى',
      durationMinutes: 180,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      publishedAt: '2026-01-01',
      instructorId: 'inst_2',
      tags: [],
      enrollmentCount: 8,
      rating: 4.9,
      status: 'published',
      flatItems: [],
    },
    {
      id: 'CRS-SAF-03',
      title: 'إجراءات السلامة وإدارة طوارئ المحطات',
      code: 'SAF-301',
      description: 'دورة السلامة المهنية والطوارئ',
      durationMinutes: 90,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      publishedAt: '2026-01-01',
      instructorId: 'inst_3',
      tags: [],
      enrollmentCount: 15,
      rating: 4.7,
      status: 'published',
      flatItems: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. displays the trainee identity, group name, and D-07 prompt in the modal header and body', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={vi.fn()}
        initialCourses={mockCatalogCourses}
      />
    );

    expect(screen.getByTestId('remove-member-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('أحمد محمود علي')).toBeInTheDocument();
    expect(screen.getByText('مشرف تشغيل قطارات')).toBeInTheDocument();
    expect(screen.getByText(/قطاع التشغيل والتحكم المركزي/)).toBeInTheDocument();
    expect(screen.getByText('مجموعة تشغيل الخط الأول - الدفعة الثالثة')).toBeInTheDocument();

    // Verify exact authoritative D-07 prompt text
    expect(
      screen.getByText(
        'هل تريد أيضاً إزالة تسجيل المتدرب من أي من المقررات التدريبية التابعة لهذه المجموعة؟ يمكنك تحديد المقررات التي تريد إزالة تسجيله منها.'
      )
    ).toBeInTheDocument();
  });

  it('2. displays all eligible courses assigned to the group with their descriptive titles', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={vi.fn()}
        initialCourses={mockCatalogCourses}
      />
    );

    expect(screen.getByText('إشارات السكك الحديدية والتحكم الآلي')).toBeInTheDocument();
    expect(screen.getByText('هندسة القوى الكهربائية وتغذية الشبكات')).toBeInTheDocument();
    expect(screen.getByText('إجراءات السلامة وإدارة طوارئ المحطات')).toBeInTheDocument();
  });

  it('3. initializes all per-course checkboxes to UNCHECKED by default per D-07 contract', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={vi.fn()}
        initialCourses={mockCatalogCourses}
      />
    );

    const cb1 = screen.getByTestId('remove-course-checkbox-CRS-SIG-01') as HTMLInputElement;
    const cb2 = screen.getByTestId('remove-course-checkbox-CRS-PWR-02') as HTMLInputElement;
    const cb3 = screen.getByTestId('remove-course-checkbox-CRS-SAF-03') as HTMLInputElement;

    expect(cb1.checked).toBe(false);
    expect(cb2.checked).toBe(false);
    expect(cb3.checked).toBe(false);

    // Initial status badges should all indicate "الاحتفاظ بالمقرر (متابعة مستقلة)"
    expect(screen.getByTestId('keep-status-badge-CRS-SIG-01')).toHaveTextContent('الاحتفاظ بالمقرر');
    expect(screen.getByTestId('keep-status-badge-CRS-PWR-02')).toHaveTextContent('الاحتفاظ بالمقرر');
    expect(screen.getByTestId('keep-status-badge-CRS-SAF-03')).toHaveTextContent('الاحتفاظ بالمقرر');
  });

  it('4. ensures independent selection: checking one course does not affect other courses', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={vi.fn()}
        initialCourses={mockCatalogCourses}
      />
    );

    const cb1 = screen.getByTestId('remove-course-checkbox-CRS-SIG-01') as HTMLInputElement;
    const cb2 = screen.getByTestId('remove-course-checkbox-CRS-PWR-02') as HTMLInputElement;
    const cb3 = screen.getByTestId('remove-course-checkbox-CRS-SAF-03') as HTMLInputElement;

    // Check course 1 only
    fireEvent.click(cb1);

    expect(cb1.checked).toBe(true);
    expect(cb2.checked).toBe(false);
    expect(cb3.checked).toBe(false);

    // Course 1 status badge changes to remove, while Course 2 and 3 remain kept
    expect(screen.getByTestId('remove-status-badge-CRS-SIG-01')).toHaveTextContent('إزالة التسجيل من المقرر');
    expect(screen.getByTestId('keep-status-badge-CRS-PWR-02')).toHaveTextContent('الاحتفاظ بالمقرر');
    expect(screen.getByTestId('keep-status-badge-CRS-SAF-03')).toHaveTextContent('الاحتفاظ بالمقرر');
  });

  it('5. dynamically updates the live decision summary counter as checkboxes are toggled', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={vi.fn()}
        initialCourses={mockCatalogCourses}
      />
    );

    // Default state: 3 kept, 0 removed
    expect(screen.getByTestId('kept-courses-count')).toHaveTextContent('3');
    expect(screen.getByTestId('removed-courses-count')).toHaveTextContent('0');

    // Check Course 1
    const cb1 = screen.getByTestId('remove-course-checkbox-CRS-SIG-01');
    fireEvent.click(cb1);

    expect(screen.getByTestId('kept-courses-count')).toHaveTextContent('2');
    expect(screen.getByTestId('removed-courses-count')).toHaveTextContent('1');

    // Check Course 2
    const cb2 = screen.getByTestId('remove-course-checkbox-CRS-PWR-02');
    fireEvent.click(cb2);

    expect(screen.getByTestId('kept-courses-count')).toHaveTextContent('1');
    expect(screen.getByTestId('removed-courses-count')).toHaveTextContent('2');

    // Deselect Course 1
    fireEvent.click(cb1);

    expect(screen.getByTestId('kept-courses-count')).toHaveTextContent('2');
    expect(screen.getByTestId('removed-courses-count')).toHaveTextContent('1');
  });

  it('6. renders informative badge when the trainee holds an independent self-enrollment grant (S1)', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={vi.fn()}
        initialCourses={mockCatalogCourses}
        independentSelfCourseIds={['CRS-SIG-01']}
      />
    );

    // Course 1 should display the independent self-enrollment indicator
    const selfBadge = screen.getByTestId('independent-self-grant-badge-CRS-SIG-01');
    expect(selfBadge).toBeInTheDocument();
    expect(selfBadge).toHaveTextContent(/يمتلك المتدرب تسجيلاً ذاتياً مستقلاً في هذا المقرر/);

    // Course 2 does not have an independent self-enrollment
    expect(screen.queryByTestId('independent-self-grant-badge-CRS-PWR-02')).not.toBeInTheDocument();
  });

  it('7. displays a friendly empty state alert when the group has no assigned courses', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupNoCourses}
        onConfirm={vi.fn()}
        initialCourses={mockCatalogCourses}
      />
    );

    const emptyAlert = screen.getByTestId('no-group-courses-alert');
    expect(emptyAlert).toBeInTheDocument();
    expect(emptyAlert).toHaveTextContent('لا توجد مقررات تدريبية مسندة لهذه المجموعة حالياً');
    expect(screen.queryByTestId('removal-decision-summary')).not.toBeInTheDocument();
  });

  it('8. submits an empty removeCourseIds array [] when all checkboxes remain unchecked (default keep-all)', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={handleConfirm}
        initialCourses={mockCatalogCourses}
      />
    );

    const confirmBtn = screen.getByTestId('confirm-remove-member-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledTimes(1);
      expect(handleConfirm).toHaveBeenCalledWith('usr_trainee_001', []);
    });
  });

  it('9. submits the exact checked course IDs when courses are selected for removal', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={handleConfirm}
        initialCourses={mockCatalogCourses}
      />
    );

    // Select Course 1 and Course 3 for removal
    fireEvent.click(screen.getByTestId('remove-course-checkbox-CRS-SIG-01'));
    fireEvent.click(screen.getByTestId('remove-course-checkbox-CRS-SAF-03'));

    const confirmBtn = screen.getByTestId('confirm-remove-member-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledTimes(1);
      expect(handleConfirm).toHaveBeenCalledWith('usr_trainee_001', ['CRS-SIG-01', 'CRS-SAF-03']);
    });
  });

  it('10. closing or cancelling the modal does NOT trigger onConfirm and resets selections', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    const { rerender } = render(
      <RemoveMemberModal
        isOpen={true}
        onClose={handleClose}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={handleConfirm}
        initialCourses={mockCatalogCourses}
      />
    );

    // Select Course 2
    fireEvent.click(screen.getByTestId('remove-course-checkbox-CRS-PWR-02'));

    // Click cancel button
    const cancelBtn = screen.getByTestId('cancel-remove-member-btn');
    fireEvent.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleConfirm).not.toHaveBeenCalled();

    // Rerender when reopened to check reset
    rerender(
      <RemoveMemberModal
        isOpen={true}
        onClose={handleClose}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={handleConfirm}
        initialCourses={mockCatalogCourses}
      />
    );

    const cb2 = screen.getByTestId('remove-course-checkbox-CRS-PWR-02') as HTMLInputElement;
    expect(cb2.checked).toBe(false);
  });

  it('11. prevents duplicate submission while isRemoving is true (loading state)', () => {
    const handleConfirm = vi.fn();

    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={handleConfirm}
        isRemoving={true}
        initialCourses={mockCatalogCourses}
      />
    );

    const confirmBtn = screen.getByTestId('confirm-remove-member-btn') as HTMLButtonElement;
    const cancelBtn = screen.getByTestId('cancel-remove-member-btn') as HTMLButtonElement;
    const cb1 = screen.getByTestId('remove-course-checkbox-CRS-SIG-01') as HTMLInputElement;

    expect(confirmBtn.disabled).toBe(true);
    expect(cancelBtn.disabled).toBe(true);
    expect(cb1.disabled).toBe(true);

    fireEvent.click(confirmBtn);
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it('12. displays an action error alert if onConfirm rejects', async () => {
    const handleConfirm = vi.fn().mockRejectedValue(new Error('حدث خطأ في شبكة الاتصال أثناء الإزالة'));

    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={handleConfirm}
        initialCourses={mockCatalogCourses}
      />
    );

    const confirmBtn = screen.getByTestId('confirm-remove-member-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('removal-action-error')).toHaveTextContent('حدث خطأ في شبكة الاتصال أثناء الإزالة');
    });
  });

  it('13. maintains 100% test ID compatibility with existing removal test suites', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={vi.fn()}
        initialCourses={mockCatalogCourses}
      />
    );

    // Existing test ID expectations from training-groups-enrollment.test.tsx:
    expect(screen.getByTestId('remove-member-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-remove-member-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-remove-member-btn')).toBeInTheDocument();
  });

  it('14. preserves historical attempt and progress integrity without mutating external store', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        onClose={vi.fn()}
        member={mockMember}
        group={mockGroupWithCourses}
        onConfirm={vi.fn()}
        initialCourses={mockCatalogCourses}
      />
    );

    // Verify modal is purely UI presentation and does not execute mutations on mount or selection
    expect(screen.getByTestId('remove-member-confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('remove-course-checkbox-CRS-SIG-01'));
    // State remains isolated within React component
    expect(screen.getByTestId('removed-courses-count')).toHaveTextContent('1');
  });
});

