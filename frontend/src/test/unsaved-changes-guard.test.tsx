import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
  Link,
  NavLink,
} from 'react-router-dom';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { authStorage } from '@/core/auth/authStorage';
import { CourseBuilderPage } from '@/pages/CourseBuilderPage';
import { builderApi } from '@/features/course-builder/services/builderApi';
import type { Course } from '@/core/courses/types';
import type { User } from '@/core/auth/types';

const mockLecturer: User = {
  id: 'usr-lec-1',
  email: 'mohamed@metro.local',
  name: 'م. محمد السيد',
  role: 'lecturer',
  department: 'هندسة الإشارات والتحكم',
  jobTitle: 'محاضر معتمد',
  initials: 'MS',
};

const mockInitialCourse: Course = {
  id: 'crs-guard-test',
  title: 'دورة هندسة الإشارات التجريبية',
  description: 'وصف الدورة التجريبية للاختبار الشامل',
  level: 'متوسط',
  status: 'draft',
  lecturerId: 'usr-lec-1',
  lecturerName: 'م. محمد السيد',
  estimatedHours: 4,
  rating: 5,
  ratingCount: 1,
  enrollmentCount: 10,
  chapters: [
    {
      id: 'ch-1',
      title: 'الفصل الأول: أنظمة التحكم',
      order: 1,
      items: [
        {
          id: 'itm-1',
          title: 'الدرس الأول: مقدمة في الإشارات',
          type: 'video',
          duration: '10:00',
        },
      ],
    },
  ],
};

describe('Comprehensive Unsaved Changes Navigation Guard & Data Router Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authStorage.setSession({
      token: 'mock_jwt_lecturer_test',
      user: mockLecturer,
      expiresAt: Date.now() + 3600000,
    });

    vi.spyOn(builderApi, 'getCourseForEditing').mockResolvedValue(
      JSON.parse(JSON.stringify(mockInitialCourse))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const renderBuilderWithDataRouter = (initialRoute = '/lecturer/builder/crs-guard-test') => {
    // Navigation bar with standard Link and NavLink representing Sidebar and Navbar
    const NavigationShell = () => (
      <div>
        <nav data-testid="test-nav">
          <Link to="/dashboard" data-testid="nav-dashboard-link">
            الرئيسية
          </Link>
          <NavLink to="/lecturer/courses" data-testid="nav-courses-link">
            المقررات التدريبية
          </NavLink>
          <Link to="/profile" data-testid="nav-profile-link">
            الملف الشخصي
          </Link>
        </nav>
      </div>
    );

    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <div>
              <NavigationShell />
              <div data-testid="route-outlet">
                <CourseBuilderPage />
              </div>
            </div>
          ),
          children: [
            {
              path: 'lecturer/builder/:courseId',
              element: <CourseBuilderPage />,
            },
          ],
        },
        {
          path: '/lecturer/courses',
          element: (
            <div>
              <NavigationShell />
              <div data-testid="lecturer-courses-destination">صفحة المقررات التدريبية</div>
            </div>
          ),
        },
        {
          path: '/dashboard',
          element: (
            <div>
              <NavigationShell />
              <div data-testid="dashboard-destination">لوحة المتابعة الرئيسية</div>
            </div>
          ),
        },
        {
          path: '/profile',
          element: (
            <div>
              <NavigationShell />
              <div data-testid="profile-destination">الملف الشخصي للمستخدم</div>
            </div>
          ),
        },
      ],
      {
        initialEntries: [initialRoute],
      }
    );

    const utils = render(
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    );

    return { ...utils, router };
  };

  it('navigates immediately without warning when there are NO unsaved changes', async () => {
    const { router } = renderBuilderWithDataRouter();

    await waitFor(() => {
      expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
    });

    // 1. Click Builder Back Button
    const backBtn = screen.getByTestId('builder-back-btn');
    fireEvent.click(backBtn);

    // Should immediately navigate without showing confirmation dialog
    expect(screen.queryByTestId('unsaved-leave-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('lecturer-courses-destination')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/lecturer/courses');
  });

  it('intercepts Sidebar/NavLink navigation when course has unsaved modifications', async () => {
    const { router } = renderBuilderWithDataRouter();

    await waitFor(() => {
      expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
    });

    // Make an edit in the course title
    const titleInput = screen.getByTestId('builder-title-input');
    fireEvent.change(titleInput, { target: { value: 'دورة هندسة الإشارات (معدلة)' } });

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    // Attempt to navigate via Sidebar / NavLink to courses
    const navLink = screen.getByTestId('nav-courses-link');
    fireEvent.click(navLink);

    // Blocker must intercept: dialog appears and user stays on builder
    await waitFor(() => {
      expect(screen.getByTestId('unsaved-leave-dialog')).toBeInTheDocument();
    });
    expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('تعديلات غير محفوظة');
    expect(screen.getByText(/لديك تعديلات غير محفوظة في منشئ المحتوى/)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-cancel-btn')).toHaveTextContent('البقاء والمتابعة');
    expect(screen.getByTestId('confirm-delete-btn')).toHaveTextContent('مغادرة وتجاهل التعديلات');

    // Page must remain in builder
    expect(router.state.location.pathname).toBe('/lecturer/builder/crs-guard-test');
    expect(screen.queryByTestId('lecturer-courses-destination')).not.toBeInTheDocument();
  });

  it('intercepts Navbar / Brand link navigation when dirty and cancels cleanly', async () => {
    const { router } = renderBuilderWithDataRouter();

    await waitFor(() => {
      expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
    });

    // Make an edit
    const titleInput = screen.getByTestId('builder-title-input');
    fireEvent.change(titleInput, { target: { value: 'دورة تم تعديلها' } });

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    // Click Navbar brand / dashboard link
    fireEvent.click(screen.getByTestId('nav-dashboard-link'));

    // Verify dialog appears
    await waitFor(() => {
      expect(screen.getByTestId('unsaved-leave-dialog')).toBeInTheDocument();
    });

    // Click "البقاء والمتابعة" (Cancel)
    fireEvent.click(screen.getByTestId('confirm-cancel-btn'));

    // Dialog should close, and user stays on builder with edits preserved
    await waitFor(() => {
      expect(screen.queryByTestId('unsaved-leave-dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/lecturer/builder/crs-guard-test');
    expect(screen.getByDisplayValue('دورة تم تعديلها')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-destination')).not.toBeInTheDocument();
  });

  it('proceeds with navigation and discards in-memory edits when user explicitly confirms leaving', async () => {
    const { router } = renderBuilderWithDataRouter();

    await waitFor(() => {
      expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
    });

    // Make an edit
    const titleInput = screen.getByTestId('builder-title-input');
    fireEvent.change(titleInput, { target: { value: 'تعديلات ستُهمل' } });

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    // Click profile link in navigation
    fireEvent.click(screen.getByTestId('nav-profile-link'));

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-leave-dialog')).toBeInTheDocument();
    });

    // Confirm discarding changes: click "مغادرة وتجاهل التعديلات"
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    // Should complete transition to profile
    await waitFor(() => {
      expect(screen.getByTestId('profile-destination')).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/profile');

    // Local emergency draft must be cleaned up on explicit discard
    expect(localStorage.getItem('metro_builder_draft_crs-guard-test')).toBeNull();
  });

  it('handles multiple navigation attempts while dialog is open without duplicate dialogs', async () => {
    const { router } = renderBuilderWithDataRouter();

    await waitFor(() => {
      expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
    });

    // Make dirty
    const titleInput = screen.getByTestId('builder-title-input');
    fireEvent.change(titleInput, { target: { value: 'تغيير غير محفوظ' } });

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    // First navigation attempt to dashboard
    fireEvent.click(screen.getByTestId('nav-dashboard-link'));
    await waitFor(() => {
      expect(screen.getByTestId('unsaved-leave-dialog')).toBeInTheDocument();
    });

    // While dialog is open, click another link (profile)
    fireEvent.click(screen.getByTestId('nav-profile-link'));

    // Exactly ONE dialog must remain open
    expect(screen.getAllByTestId('unsaved-leave-dialog')).toHaveLength(1);

    // Confirm departure
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    // Should proceed to destination
    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe('/lecturer/builder/crs-guard-test');
    });
  });

  it('reverting modifications back to initial snapshot clears dirty state and permits immediate exit', async () => {
    const { router } = renderBuilderWithDataRouter();

    await waitFor(() => {
      expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
    });

    const titleInput = screen.getByTestId('builder-title-input');

    // 1. Change title (becomes dirty)
    fireEvent.change(titleInput, { target: { value: 'تعديل مؤقت' } });
    await waitFor(() => {
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    // 2. Change title back to exact initial value (reverts to clean snapshot)
    fireEvent.change(titleInput, { target: { value: 'دورة هندسة الإشارات التجريبية' } });
    await waitFor(() => {
      expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument();
    });

    // 3. Attempt navigation via Builder Back Button
    fireEvent.click(screen.getByTestId('builder-back-btn'));

    // Must navigate immediately with no confirmation dialog
    expect(screen.queryByTestId('unsaved-leave-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('lecturer-courses-destination')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/lecturer/courses');
  });

  it('switching tabs within CourseBuilderPage does NOT trigger unsaved changes confirmation', async () => {
    renderBuilderWithDataRouter();

    await waitFor(() => {
      expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
    });

    // Make dirty
    const titleInput = screen.getByTestId('builder-title-input');
    fireEvent.change(titleInput, { target: { value: 'تعديل نشط' } });
    await waitFor(() => {
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    // Switch to Curriculum tab
    const curriculumTab = screen.getByTestId('builder-tab-curriculum');
    fireEvent.click(curriculumTab);

    // Verify no unsaved dialog was opened by tab switching
    expect(screen.queryByTestId('unsaved-leave-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('curriculum-tree-editor')).toBeInTheDocument();

    // Switch to Downloads tab
    const downloadsTab = screen.getByTestId('builder-tab-downloads');
    fireEvent.click(downloadsTab);
    expect(screen.queryByTestId('unsaved-leave-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('download-policies-editor')).toBeInTheDocument();

    // Switch back to Metadata tab
    const metadataTab = screen.getByTestId('builder-tab-metadata');
    fireEvent.click(metadataTab);
    expect(screen.queryByTestId('unsaved-leave-dialog')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('تعديل نشط')).toBeInTheDocument();
  });

  it('successful draft save clears dirtiness and allows immediate navigation, whereas failed save keeps guard active', async () => {
    const { router } = renderBuilderWithDataRouter();

    await waitFor(() => {
      expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
    });

    const titleInput = screen.getByTestId('builder-title-input');
    fireEvent.change(titleInput, { target: { value: 'عنوان جديد بعد الحفظ' } });

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    // Mock save failure first
    vi.spyOn(builderApi, 'saveCourseDraft').mockRejectedValueOnce(new Error('فشل مؤقت في الخادم'));

    const saveBtn = screen.getByTestId('save-draft-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('فشل مؤقت في الخادم')).toBeInTheDocument();
    });

    // Unsaved badge must still be present because save failed
    expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();

    // Navigation must STILL be blocked because save failed
    fireEvent.click(screen.getByTestId('builder-back-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('unsaved-leave-dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-cancel-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('unsaved-leave-dialog')).not.toBeInTheDocument();
    });

    // Now mock save success
    const updatedCourse = {
      ...mockInitialCourse,
      title: 'عنوان جديد بعد الحفظ',
    };
    vi.spyOn(builderApi, 'saveCourseDraft').mockResolvedValueOnce({
      course: updatedCourse,
      isPublishedPreserved: true,
    });

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/تم حفظ المسودة بنجاح/)).toBeInTheDocument();
    });

    // Dirtiness badge must be gone
    expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument();

    // Navigation should now proceed immediately without dialog
    fireEvent.click(screen.getByTestId('builder-back-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('unsaved-leave-dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('lecturer-courses-destination')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/lecturer/courses');
    });
  });

  it('triggers browser beforeunload event with preventDefault when dirty', async () => {
    renderBuilderWithDataRouter();

    await waitFor(() => {
      expect(screen.getByTestId('builder-title-input')).toBeInTheDocument();
    });

    // Clean state: beforeunload event should not be prevented
    const cleanEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(cleanEvent, 'preventDefault');
    window.dispatchEvent(cleanEvent);
    expect(preventDefaultSpy).not.toHaveBeenCalled();

    // Make dirty
    const titleInput = screen.getByTestId('builder-title-input');
    fireEvent.change(titleInput, { target: { value: 'تعديل غير محفوظ للاختبار' } });

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument();
    });

    // Dirty state: beforeunload event MUST call preventDefault and set returnValue
    const dirtyEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    const dirtyPreventDefaultSpy = vi.spyOn(dirtyEvent, 'preventDefault');
    window.dispatchEvent(dirtyEvent);
    expect(dirtyPreventDefaultSpy).toHaveBeenCalled();
  });
});
