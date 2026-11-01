import React from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/app/layouts/AppLayout';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CoursesCatalogPage } from '@/pages/CoursesCatalogPage';
import { CourseDetailPage } from '@/pages/CourseDetailPage';
import { DesignSystemPreviewPage } from '@/pages/DesignSystemPreviewPage';
import { LearningPlayerPage } from '@/pages/LearningPlayerPage';
import { MyCoursesPage } from '@/pages/MyCoursesPage';
import { TraineeGroupsPage } from '@/pages/TraineeGroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { LecturerCoursesPage } from '@/pages/LecturerCoursesPage';
import { CourseBuilderPage } from '@/pages/CourseBuilderPage';
import { ApprovalsPage } from '@/pages/ApprovalsPage';
import { CourseReviewPage } from '@/pages/CourseReviewPage';
import { AdminGroupsPage } from '@/pages/AdminGroupsPage';
import { GroupEditorPage } from '@/pages/GroupEditorPage';
import { GroupMonitoringPage } from '@/pages/GroupMonitoringPage';
import { JoinGroupPage } from '@/pages/JoinGroupPage';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { UserDetailsPage } from '@/pages/UserDetailsPage';
import { PermissionsMatrixPage } from '@/pages/PermissionsMatrixPage';
import { SecurityAuditPage } from '@/pages/SecurityAuditPage';
import { DepartmentTracksPage } from '@/pages/DepartmentTracksPage';
import { CommentModerationPage } from '@/pages/CommentModerationPage';
import { CoursePerformancePage } from '@/pages/CoursePerformancePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { UnexpectedErrorPage } from '@/pages/UnexpectedErrorPage';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { ErrorBoundary } from '@/shared/ui/Error';
import { useAuth } from '@/features/auth/hooks/useAuth';

const AdminReviewParamRedirect: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  return <Navigate to={`/admin/review/${courseId ?? ''}`} replace />;
};

const AdminMonitoringParamRedirect: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  return <Navigate to={`/admin/groups/${groupId ?? ''}/monitoring`} replace />;
};

const GroupsAdaptiveRedirect: React.FC = () => {
  const { user } = useAuth();
  if (
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'developer' ||
    user?.role === 'assistant_admin'
  ) {
    return <Navigate to="/admin/groups" replace />;
  }
  return <Navigate to="/my-groups" replace />;
};


// eslint-disable-next-line react-refresh/only-export-components
export const DeveloperRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || user?.role !== 'developer') {
    return <NotFoundPage standalone />;
  }
  return <>{children}</>;
};

/**
 * Centrally Managed Application Route Elements
 *
 * Routing Rules:
 * - /login: Standalone public authentication page (AuthLayout).
 * - /design-system: Developer-only visual laboratory guarded with 404 parity for non-developers (Surface 11).
 * - /: Protected application shell (AppLayout) with ProtectedRoute guard.
 *   Redirects unauthenticated visitors to /login.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const appRouteElements = (
  <>
    {/* Public Authentication Layout */}
    <Route element={<AuthLayout />} errorElement={<RouteErrorBoundary />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>

    {/* Standalone Error Routes */}
    <Route path="/404" element={<NotFoundPage standalone />} />
    <Route path="/403" element={<ForbiddenPage />} />
    <Route path="/500" element={<UnexpectedErrorPage />} />

    {/* Surface 11: Developer-Only Design System Route (404 parity for non-developers) */}
    <Route
      path="/design-system"
      element={
        <DeveloperRouteGuard>
          <DesignSystemPreviewPage />
        </DeveloperRouteGuard>
      }
      errorElement={<RouteErrorBoundary />}
    />

    {/* Protected Application Shell */}
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
      errorElement={<RouteErrorBoundary />}
    >
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="courses" element={<CoursesCatalogPage />} />
      <Route path="courses/:courseId" element={<CourseDetailPage />} />
      <Route path="courses/:courseId/learn" element={<LearningPlayerPage />} />
      <Route path="courses/:courseId/learn/:itemId" element={<LearningPlayerPage />} />
      <Route path="my-courses" element={<MyCoursesPage />} />
      <Route path="my-groups" element={<TraineeGroupsPage />} />
      <Route path="my-groups/:groupId" element={<GroupDetailPage />} />
      <Route path="groups" element={<GroupsAdaptiveRedirect />} />
      <Route path="groups/join" element={<JoinGroupPage />} />
      <Route path="groups/:groupId" element={<Navigate to="/my-groups/:groupId" replace />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      {/* Increment 10: Training Groups Management */}
      <Route
        path="admin/groups"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}>
            <AdminGroupsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/groups/new"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin']}>
            <GroupEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/groups/:groupId"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin']}>
            <GroupEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/groups/:groupId/edit"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin']}>
            <GroupEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/groups/:groupId/monitoring"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer']}>
            <GroupMonitoringPage />
          </ProtectedRoute>
        }
      />
      <Route path="admin/group-monitoring" element={<Navigate to="/admin/groups" replace />} />
      <Route path="admin/group-monitoring/:groupId" element={<AdminMonitoringParamRedirect />} />
      <Route
        path="admin/create-group"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin']}>
            <Navigate to="/admin/groups/new" replace />
          </ProtectedRoute>
        }
      />
      {/* Increment 11: Central User Directory & User Transcript */}
      <Route
        path="admin/users"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}>
            <UserManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="admin/users/:userId"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}>
            <UserDetailsPage />
          </ProtectedRoute>
        }
      />
      {/* Increment 11 Phase 4: Permissions Matrix & Governance */}
      <Route
        path="admin/permissions"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}>
            <PermissionsMatrixPage />
          </ProtectedRoute>
        }
      />
      {/* Increment 11 Phase 4D: System Security Audit Trail */}
      <Route
        path="admin/audit"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}>
            <SecurityAuditPage />
          </ProtectedRoute>
        }
      />
      {/* Increment 11 Phase 4E: Department Course-Track Configuration */}
      <Route
        path="admin/department-tracks"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}>
            <DepartmentTracksPage />
          </ProtectedRoute>
        }
      />
      {/* Increment 11 Phase 5B: Comment Moderation */}
      <Route
        path="admin/comment-moderation"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}>
            <CommentModerationPage />
          </ProtectedRoute>
        }
      />
      {/* Lecturer Workspace & Course Builder */}
      <Route
        path="lecturer/courses"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer']}>
            <LecturerCoursesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="lecturer/builder/new"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'lecturer']}>
            <Navigate to="/lecturer/courses?new=true" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="lecturer/builder/:courseId"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'lecturer']}>
            <CourseBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="builder"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'lecturer']}>
            <Navigate to="/lecturer/courses" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="builder/:courseId"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'lecturer']}>
            <Navigate to="/lecturer/builder/:courseId" replace />
          </ProtectedRoute>
        }
      />
      {/* Increment 11 Phase 5D: Lecturer Course Performance & Trainee Nudges */}
      <Route
        path="lecturer/performance/:courseId"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer']}>
            <CoursePerformancePage />
          </ProtectedRoute>
        }
      />
      <Route path="performance/:courseId" element={<Navigate to="/lecturer/performance/:courseId" replace />} />
      {/* Increment 9: Review & Quality Audit Workflow */}
      <Route
        path="approvals"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer']}>
            <ApprovalsPage />
          </ProtectedRoute>
        }
      />
      <Route path="audit" element={<Navigate to="/approvals" replace />} />
      <Route path="admin/approvals" element={<Navigate to="/approvals" replace />} />
      <Route path="admin/approvals/:courseId" element={<AdminReviewParamRedirect />} />
      <Route
        path="admin/review/:courseId"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}>
            <CourseReviewPage />
          </ProtectedRoute>
        }
      />
      {/* Error Routes within Application Shell */}
      <Route path="403" element={<ForbiddenPage />} />
      <Route path="500" element={<UnexpectedErrorPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </>
);

// eslint-disable-next-line react-refresh/only-export-components
export const appRoutes = createRoutesFromElements(appRouteElements);

/**
 * Factory for test environments requiring in-memory data routing.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const createTestRouter = (initialEntries: string[] = ['/']) =>
  createMemoryRouter(createRoutesFromElements(appRouteElements), { initialEntries });

/**
 * Creates or retrieves the appropriate Data Router.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const getAppRouter = (initialEntries?: string[]) => {
  if (initialEntries) {
    return createTestRouter(initialEntries);
  }
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') {
    return createTestRouter(['/']);
  }
  return createBrowserRouter(appRoutes);
};

/**
 * Centrally Managed Application Router Component
 *
 * Utilizes React Router Data Router (`createBrowserRouter` / `createMemoryRouter` + `RouterProvider`)
 * to enable navigation blocking (`useBlocker`) and unsaved changes protection.
 */
export const AppRouter: React.FC<{ initialEntries?: string[] }> = ({ initialEntries }) => {
  const routerInstance = React.useMemo(() => getAppRouter(initialEntries), [initialEntries]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={routerInstance} />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default AppRouter;
