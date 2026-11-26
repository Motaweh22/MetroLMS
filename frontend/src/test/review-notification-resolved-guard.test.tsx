import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { CourseReviewPage } from '@/pages/CourseReviewPage';
import { ToastProvider } from '@/shared/ui/Toast/ToastProvider';
import { reviewApi } from '@/features/course-review/api/reviewApi';
import type { NotificationItem } from '@/core/notifications/types';
import type { CourseReviewDataResponseDTO } from '@/core/courses/types';

let mockNotificationsList: NotificationItem[] = [];
const mockMarkAsRead = vi.fn(async () => undefined);

vi.mock('@/core/auth/useAuthContext', () => ({
  useAuthContext: () => ({
    user: {
      id: '2',
      name: 'المدير الأعلى',
      username: '+201000000002',
      email: 'super@metro.local',
      role: 'super_admin',
      status: 'active',
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/features/notifications', () => ({
  useNotifications: () => ({
    notifications: mockNotificationsList,
    unreadCount: mockNotificationsList.filter((n) => !n.read).length,
    isLoading: false,
    error: null,
    loadNotifications: vi.fn(),
    markAsRead: mockMarkAsRead,
    markAllAsRead: vi.fn(),
  }),
}));

vi.mock('@/core/auth/useRolePreview', () => ({
  useRolePreview: () => ({
    previewRole: null,
  }),
}));

describe('Resolved course review notification & direct review route guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockMarkAsRead.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows notice without navigating when clicking a resolved content_pending_review notification (Option B)', async () => {
    mockNotificationsList = [
      {
        id: '901',
        userId: '2',
        type: 'content_pending_review',
        title: 'مقرر جديد بانتظار المراجعة',
        message: 'قدّم «محاضر» المقرر للمراجعة والاعتماد.',
        courseId: '77',
        targetUrl: null,
        actionRequired: false,
        read: false,
        createdAt: '2026-11-26T06:00:00Z',
        metadata: {
          courseId: '77',
          resolved: true,
          reviewResolved: true,
          reviewOutcome: 'approved',
        },
      },
    ];

    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <ToastProvider>
          <Routes>
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/admin/review/:courseId" element={<div data-testid="review-route-reached">Review</div>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('notification-resolved-badge-901')).toBeTruthy();

    fireEvent.click(screen.getByTestId('notification-item-901'));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith('901');
    });
    expect(screen.queryByTestId('review-route-reached')).toBeNull();
    expect(await screen.findByTestId('resolved-review-notice')).toBeTruthy();
  });

  it('blocks CourseReviewPage when navigating directly to /admin/review/:courseId after decision', async () => {
    const resolvedReviewPayload: CourseReviewDataResponseDTO = {
      course: {
        id: '77',
        title: 'مقرر تم اعتماده',
        description: 'وصف',
        status: 'published',
        lecturerId: '10',
        lecturerName: 'محاضر',
        chapters: [],
      } as never,
      draft: null,
      effectiveContent: {
        id: '77',
        title: 'مقرر تم اعتماده',
        description: 'وصف',
        status: 'published',
        lecturerId: '10',
        lecturerName: 'محاضر',
        chapters: [],
      } as never,
      submission: {
        id: '55',
        reviewStatus: 'Approved',
      },
      hasPendingSubmission: false,
      reviewStatus: 'Approved',
      stagedEdits: null,
      activeReviewFeedback: null,
      auditLog: [],
      submissionType: 'update',
      isPublishedUpdate: false,
    };

    vi.spyOn(reviewApi, 'getCourseReviewData').mockResolvedValue(resolvedReviewPayload);
    vi.spyOn(reviewApi, 'getReviewerWorkingNotes').mockResolvedValue(null as never);

    render(
      <MemoryRouter initialEntries={['/admin/review/77']}>
        <Routes>
          <Route path="/admin/review/:courseId" element={<CourseReviewPage />} />
          <Route path="/approvals" element={<div data-testid="approvals-fallback">Approvals</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('review-already-decided')).toBeTruthy();
    expect(screen.queryByTestId('toggle-edit-mode-btn')).toBeNull();
    expect(screen.getByText(/تمت مراجعة هذا المقرر مسبقاً/)).toBeTruthy();
  });
});
