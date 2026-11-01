import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { server } from '@/mocks/server';
import { AuthProvider } from '@/core/auth/AuthContext';
import { authStorage } from '@/core/auth/authStorage';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { LecturerCoursesPage } from '@/pages/LecturerCoursesPage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  inMemoryStore.reset({ seedReviewDemo: false });
});
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedReviewDemo: false });
});
afterAll(() => server.close());

const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

const MockPerformanceScreen = () => {
  const { courseId } = useParams<{ courseId: string }>();
  return <div data-testid="performance-screen">تقرير الأداء لمقرر {courseId}</div>;
};

const renderWorkspaceWithUser = (user: User | null, initialRoute = '/lecturer/courses') => {
  if (user) {
    authStorage.setSession({
      token: `mock_jwt_${user.id}_test`,
      user,
      expiresAt: Date.now() + 3600000,
    });
  } else {
    authStorage.clearSession();
  }

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/lecturer/courses" element={<LecturerCoursesPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-screen">لوحة القيادة</div>} />
          <Route path="/lecturer/builder/:courseId" element={<div data-testid="builder-screen">منشئ المقرر</div>} />
          <Route path="/lecturer/performance/:courseId" element={<MockPerformanceScreen />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
};

describe('Increment 8 & 11: Lecturer Workspace & Course Management (/lecturer/courses)', () => {

  it('renders assigned courses for authenticated lecturer with performance action', async () => {
    renderWorkspaceWithUser(lecturerUser);

    // Header
    expect(screen.getByText('مساحة عمل المحاضر والمدرب المعتمد')).toBeInTheDocument();

    // Verify assigned courses are loaded
    await waitFor(() => {
      expect(screen.getByTestId('workspace-course-card-CRS001')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-course-card-CRS002')).toBeInTheDocument();
    });

    // Check course metrics and buttons
    expect(screen.getByTestId('edit-builder-btn-CRS001')).toBeInTheDocument();
    expect(screen.getByTestId('preview-course-btn-CRS001')).toBeInTheDocument();
    expect(screen.getByTestId('course-performance-btn-CRS001')).toBeInTheDocument();
    expect(screen.getByTestId('course-performance-btn-CRS001')).toHaveTextContent('تقرير الأداء');
  });

  it('navigates to course performance report when clicking تقرير الأداء button', async () => {
    renderWorkspaceWithUser(lecturerUser);

    await waitFor(() => {
      expect(screen.getByTestId('course-performance-btn-CRS001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('course-performance-btn-CRS001'));

    await waitFor(() => {
      expect(screen.getByTestId('performance-screen')).toBeInTheDocument();
      expect(screen.getByText('تقرير الأداء لمقرر CRS001')).toBeInTheDocument();
    });
  });

  it('renders performance report button for administrator across all courses', async () => {
    renderWorkspaceWithUser(adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('workspace-course-card-CRS001')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-course-card-CRS003')).toBeInTheDocument();
    });

    expect(screen.getByTestId('course-performance-btn-CRS001')).toBeInTheDocument();
    expect(screen.getByTestId('course-performance-btn-CRS003')).toBeInTheDocument();
  });

  it('strictly isolates performance action by user ID and ignores identical display names', async () => {
    // Promote USR005 to lecturer and assign as instructor for CRS002
    inMemoryStore.updateUserRole('USR005', 'lecturer');
    const crs002 = inMemoryStore.getCourseById('CRS002');
    if (crs002) {
      crs002.lecturerId = 'USR005';
    }

    // Give USR005 the exact display name of CRS001's instructor ('م. خالد إبراهيم')
    const spoofedLecturer: User = {
      id: 'USR005',
      name: 'م. خالد إبراهيم', // Name matches CRS001's instructor
      email: 'samir.elngar@cairo-metro.com',
      role: 'lecturer',
      department: 'إدارة التدريب',
      jobTitle: 'كبير مدربين',
      initials: 'س.ن',
    };

    renderWorkspaceWithUser(spoofedLecturer);

    await waitFor(() => {
      // USR005's assigned course is loaded
      expect(screen.getByTestId('workspace-course-card-CRS002')).toBeInTheDocument();
    });

    // Performance action is rendered for USR005's assigned course CRS002
    expect(screen.getByTestId('course-performance-btn-CRS002')).toBeInTheDocument();

    // CRS001 is NOT assigned to USR005, so neither card nor performance button should exist for CRS001
    expect(screen.queryByTestId('workspace-course-card-CRS001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('course-performance-btn-CRS001')).not.toBeInTheDocument();
  });

  it('preserves performance button access for assigned lecturer when name is renamed', async () => {
    // Assigned lecturer usr_lect_002 with completely renamed display name
    const renamedLecturer: User = {
      ...lecturerUser,
      name: 'اسم تجريبي غير مسبوق في المنظومة',
    };

    renderWorkspaceWithUser(renamedLecturer);

    await waitFor(() => {
      expect(screen.getByTestId('workspace-course-card-CRS001')).toBeInTheDocument();
    });

    // Performance button is still rendered because identity is strictly ID-based
    expect(screen.getByTestId('course-performance-btn-CRS001')).toBeInTheDocument();
  });

  it('allows administrator to view all system courses in workspace', async () => {
    renderWorkspaceWithUser(adminUser);

    await waitFor(() => {
      expect(screen.getByTestId('workspace-course-card-CRS001')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-course-card-CRS003')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-course-card-CRS004')).toBeInTheDocument();
    });
  });

  it('strictly blocks trainee from accessing lecturer workspace (403 Access Denied)', async () => {
    renderWorkspaceWithUser(traineeUser);

    await waitFor(() => {
      expect(screen.getByTestId('lecturer-access-denied')).toBeInTheDocument();
      expect(
        screen.getByText('غير مصرح بالدخول إلى مساحة المحاضرين')
      ).toBeInTheDocument();
    });
  });

  it('filters courses by status tabs (all, published, draft, pending)', async () => {
    renderWorkspaceWithUser(lecturerUser);

    await waitFor(() => {
      expect(screen.getByTestId('workspace-course-card-CRS001')).toBeInTheDocument();
    });

    // Click Draft tab (lecturer currently has only published courses)
    fireEvent.click(screen.getByTestId('tab-draft'));
    expect(screen.queryByTestId('workspace-course-card-CRS001')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-empty-state')).toBeInTheDocument();

    // Click All tab
    fireEvent.click(screen.getByTestId('tab-all'));
    expect(screen.getByTestId('workspace-course-card-CRS001')).toBeInTheDocument();
  });

  it('filters courses using the live search input', async () => {
    renderWorkspaceWithUser(lecturerUser);

    await waitFor(() => {
      expect(screen.getByTestId('workspace-course-card-CRS001')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-course-card-CRS002')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('workspace-search-input');
    fireEvent.change(searchInput, { target: { value: 'سلامة' } });

    expect(screen.getByTestId('workspace-course-card-CRS001')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-course-card-CRS002')).not.toBeInTheDocument();
  });

  it('opens simple course creation modal and creates a new course', async () => {
    renderWorkspaceWithUser(lecturerUser);

    await waitFor(() => {
      expect(screen.getByTestId('create-course-btn')).toBeInTheDocument();
    });

    // Open creation modal
    fireEvent.click(screen.getByTestId('create-course-btn'));
    expect(screen.getByTestId('course-creation-modal')).toBeInTheDocument();

    // Fill form
    const titleInput = screen.getByTestId('creation-title-input');
    const descInput = screen.getByTestId('creation-desc-input');

    fireEvent.change(titleInput, { target: { value: 'دورة هندسة الإشارات المتقدمة' } });
    fireEvent.change(descInput, { target: { value: 'شرح مفصل لنظم SCADA والتحكم' } });

    // Click Intermediate level
    fireEvent.click(screen.getByTestId('creation-level-متوسط'));

    // Submit
    const submitBtn = screen.getByTestId('creation-submit-btn');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    // Verify navigation to builder screen for the newly created course
    await waitFor(() => {
      expect(screen.getByTestId('builder-screen')).toBeInTheDocument();
    });
  });
});
