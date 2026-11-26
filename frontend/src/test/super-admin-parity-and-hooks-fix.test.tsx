import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { canDownloadItem, canDownloadCourseZip } from '@/core/courses/downloadPolicy';
import { isStaffLearningRole } from '@/core/domain/progress';
import { useLearningPlayer } from '@/features/learning-player/hooks/useLearningPlayer';
import { CourseCommentsSection } from '@/features/comments/components/CourseCommentsSection';
import { MyCoursesPage } from '@/pages/MyCoursesPage';
import { PermissionsMatrixPage } from '@/pages/PermissionsMatrixPage';
import { commentsApi } from '@/features/comments/services/commentsApi';
import { coursesApi } from '@/features/courses/services/coursesApi';
import { permissionsApi } from '@/features/permissions/services/permissionsApi';
import { ToastProvider } from '@/shared/ui/Toast/ToastProvider';
import type { Course, ChapterItem } from '@/core/courses/types';
import type { UserRole } from '@/core/auth/types';

let mockUserRole: UserRole = 'super_admin';
let mockPreviewRole: string | null = null;

vi.mock('@/core/auth/useAuthContext', () => ({
  useAuthContext: () => ({
    user: {
      id: '2',
      name: 'مستخدم الاختبار',
      username: '+201000000002',
      email: 'test@metro.local',
      role: mockUserRole,
      status: 'active',
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/core/auth/useRolePreview', () => ({
  useRolePreview: () => ({
    previewRole: mockPreviewRole,
  }),
}));

const samplePdfItem: ChapterItem = {
  id: 'itm-1',
  title: 'ملف إرشادي',
  type: 'pdf',
  downloadPolicy: 'never',
  canDownload: false,
  url: '/api/media/references/1/stream',
};

const sampleCourse = {
  id: 'crs-1',
  title: 'دورة اختبارية',
  courseZipPolicy: 'disabled',
  chapters: [
    {
      id: 'ch-1',
      title: 'الوحدة 1',
      order: 1,
      items: [
        { id: 'itm-1', title: 'درس 1', type: 'video' },
        { id: 'itm-2', title: 'درس 2', type: 'video' },
      ],
    },
  ],
} as unknown as Course;

describe('Super Admin & Developer role parity and MyCoursesPage hook stability', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUserRole = 'super_admin';
    mockPreviewRole = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grants download and ZIP privileges to super_admin, developer, assistant_admin, and lecturer', () => {
    for (const role of ['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer'] as const) {
      expect(isStaffLearningRole(role)).toBe(true);
      expect(canDownloadItem(samplePdfItem, false, false, false, role).allowed).toBe(true);
      expect(canDownloadCourseZip(sampleCourse, false, false, role).allowed).toBe(true);
    }

    expect(isStaffLearningRole('user')).toBe(false);
    expect(canDownloadItem(samplePdfItem, false, false, false, 'user').allowed).toBe(false);
    expect(canDownloadCourseZip(sampleCourse, false, false, 'user').allowed).toBe(false);
  });

  it('allows super_admin and developer to switch directly to any item in useLearningPlayer', () => {
    for (const role of ['super_admin', 'developer'] as const) {
      const { result } = renderHook(() =>
        useLearningPlayer({
          course: sampleCourse,
          progress: { completedItemIds: [], lastWatchedItemId: null } as never,
          userRole: role,
          initialItemId: 'itm-2',
        })
      );
      expect(result.current.currentItem?.id).toBe('itm-2');
      expect(result.current.currentItem?.isLocked).toBe(false);
      act(() => {
        expect(result.current.selectItem('itm-2')).toBe(true);
      });
    }
  });

  it('allows super_admin and developer to post and delete comments in CourseCommentsSection', async () => {
    vi.spyOn(commentsApi, 'getCourseComments').mockResolvedValue([
      {
        id: 'cmt-1',
        courseId: 'crs-1',
        userId: '99',
        authorName: 'متدرب',
        authorRole: 'user',
        text: 'استفسار فني',
        createdAt: '2026-11-26T06:00:00Z',
        time: 'الآن',
        commentsEnabled: true,
      },
    ] as never);

    for (const role of ['super_admin', 'developer'] as const) {
      mockUserRole = role;
      const { unmount } = render(
        <ToastProvider>
          <CourseCommentsSection courseId="crs-1" isEnrolled={false} />
        </ToastProvider>
      );

      expect(await screen.findByText('استفسار فني')).toBeTruthy();
      expect(screen.getByTestId('comment-input')).toBeTruthy();
      expect(screen.getByTestId('delete-comment-btn-cmt-1')).toBeTruthy();
      unmount();
    }
  });

  it('transitions MyCoursesPage smoothly across previewRole without Rules-of-Hooks crash', async () => {
    vi.spyOn(coursesApi, 'getMyEnrolledCourses').mockResolvedValue([]);

    const { rerender } = render(
      <MemoryRouter initialEntries={['/my-courses']}>
        <Routes>
          <Route path="/my-courses" element={<MyCoursesPage />} />
          <Route path="/my-groups" element={<div data-testid="redirected-groups">Groups</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('my-courses-page')).toBeTruthy();

    mockPreviewRole = 'assistant_lecturer';
    rerender(
      <MemoryRouter initialEntries={['/my-courses']}>
        <Routes>
          <Route path="/my-courses" element={<MyCoursesPage />} />
          <Route path="/my-groups" element={<div data-testid="redirected-groups">Groups</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('redirected-groups')).toBeTruthy();
  });

  it('does not call permissions API when PermissionsMatrixPage is rendered for an unauthorized role', async () => {
    mockUserRole = 'user';
    const permSpy = vi.spyOn(permissionsApi, 'getRolePermissions');

    render(
      <MemoryRouter>
        <ToastProvider>
          <PermissionsMatrixPage />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('unauthorized-permissions-view')).toBeTruthy();
    expect(permSpy).not.toHaveBeenCalled();
  });
});
