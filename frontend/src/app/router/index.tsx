import React from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
  Navigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { AuthProvider } from '@/core/auth/AuthContext';
import { RolePreviewProvider } from '@/core/auth/RolePreviewContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/app/layouts/AppLayout';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { UnexpectedErrorPage } from '@/pages/UnexpectedErrorPage';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { ErrorBoundary } from '@/shared/ui/Error';
import { LoadingScreen, PageLoading } from '@/shared/ui/Loading';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useRolePreview } from '@/core/auth/useRolePreview';

// Route-level Code Splitting: lazy-load feature & admin workspaces on demand
const CoursesCatalogPage = React.lazy(() =>
  import('@/pages/CoursesCatalogPage').then((m) => ({ default: m.CoursesCatalogPage }))
);
const CourseDetailPage = React.lazy(() =>
  import('@/pages/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage }))
);
const CourseQrJoinPage = React.lazy(() =>
  import('@/pages/CourseQrJoinPage').then((m) => ({ default: m.CourseQrJoinPage }))
);
const DesignSystemPreviewPage = React.lazy(() =>
  import('@/pages/DesignSystemPreviewPage').then((m) => ({ default: m.DesignSystemPreviewPage }))
);
const LearningPlayerPage = React.lazy(() =>
  import('@/pages/LearningPlayerPage').then((m) => ({ default: m.LearningPlayerPage }))
);
const MyCoursesPage = React.lazy(() =>
  import('@/pages/MyCoursesPage').then((m) => ({ default: m.MyCoursesPage }))
);
const TraineeGroupsPage = React.lazy(() =>
  import('@/pages/TraineeGroupsPage').then((m) => ({ default: m.TraineeGroupsPage }))
);
const GroupDetailPage = React.lazy(() =>
  import('@/pages/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage }))
);
const ProfilePage = React.lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const MemberProfilePage = React.lazy(() =>
  import('@/pages/MemberProfilePage').then((m) => ({ default: m.MemberProfilePage }))
);
const NotificationsPage = React.lazy(() =>
  import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const LecturerCoursesPage = React.lazy(() =>
  import('@/pages/LecturerCoursesPage').then((m) => ({ default: m.LecturerCoursesPage }))
);
const CourseBuilderPage = React.lazy(() =>
  import('@/pages/CourseBuilderPage').then((m) => ({ default: m.CourseBuilderPage }))
);
const ApprovalsPage = React.lazy(() =>
  import('@/pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage }))
);
const CourseReviewPage = React.lazy(() =>
  import('@/pages/CourseReviewPage').then((m) => ({ default: m.CourseReviewPage }))
);
const AdminGroupsPage = React.lazy(() =>
  import('@/pages/AdminGroupsPage').then((m) => ({ default: m.AdminGroupsPage }))
);
const GroupEditorPage = React.lazy(() =>
  import('@/pages/GroupEditorPage').then((m) => ({ default: m.GroupEditorPage }))
);
const GroupMonitoringPage = React.lazy(() =>
  import('@/pages/GroupMonitoringPage').then((m) => ({ default: m.GroupMonitoringPage }))
);
const JoinGroupPage = React.lazy(() =>
  import('@/pages/JoinGroupPage').then((m) => ({ default: m.JoinGroupPage }))
);
const UserManagementPage = React.lazy(() =>
  import('@/pages/UserManagementPage').then((m) => ({ default: m.UserManagementPage }))
);
const AddUserPage = React.lazy(() =>
  import('@/pages/AddUserPage').then((m) => ({ default: m.AddUserPage }))
);
const UserDetailsPage = React.lazy(() =>
  import('@/pages/UserDetailsPage').then((m) => ({ default: m.UserDetailsPage }))
);
const OrganizationCatalogPage = React.lazy(() =>
  import('@/pages/OrganizationCatalogPage').then((m) => ({ default: m.OrganizationCatalogPage }))
);
const PermissionsMatrixPage = React.lazy(() =>
  import('@/pages/PermissionsMatrixPage').then((m) => ({ default: m.PermissionsMatrixPage }))
);
const SecurityAuditPage = React.lazy(() =>
  import('@/pages/SecurityAuditPage').then((m) => ({ default: m.SecurityAuditPage }))
);
const DepartmentTracksPage = React.lazy(() =>
  import('@/pages/DepartmentTracksPage').then((m) => ({ default: m.DepartmentTracksPage }))
);
const CommentModerationPage = React.lazy(() =>
  import('@/pages/CommentModerationPage').then((m) => ({ default: m.CommentModerationPage }))
);
const CoursePerformancePage = React.lazy(() =>
  import('@/pages/CoursePerformancePage').then((m) => ({ default: m.CoursePerformancePage }))
);

const LazyPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <React.Suspense fallback={<PageLoading />}>{children}</React.Suspense>
);

const AdminReviewParamRedirect: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  return <Navigate to={`/admin/review/${courseId ?? ''}`} replace />;
};

const AdminMonitoringParamRedirect: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  return <Navigate to={`/admin/groups/${groupId ?? ''}/monitoring`} replace />;
};

const BuilderParamRedirect: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  return <Navigate to={`/lecturer/builder/${courseId ?? ''}`} replace />;
};

const PerformanceParamRedirect: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  return <Navigate to={`/lecturer/performance/${courseId ?? ''}`} replace />;
};

const GroupsAdaptiveRedirect: React.FC = () => {
  const { user } = useAuth();
  const { effectiveUiRole, isPreviewing } = useRolePreview();
  const currentRole = isPreviewing ? effectiveUiRole : user?.role;
  if (
    currentRole === 'admin' ||
    currentRole === 'super_admin' ||
    currentRole === 'developer' ||
    currentRole === 'assistant_admin'
  ) {
    return <Navigate to="/admin/groups" replace />;
  }
  return <Navigate to="/my-groups" replace />;
};


export interface DeveloperRouteGuardProps {
  children: React.ReactNode;
  /**
   * Optional flag: if true, unauthenticated visitors are redirected to /login (preserving return location).
   * If false or omitted, unauthenticated visitors receive standard NotFoundPage (404) for uniform INV-R8 non-disclosure.
   */
  redirectUnauthenticated?: boolean;
}

// Re-export RolePreviewProvider for convenient centralized router-level imports
// eslint-disable-next-line react-refresh/only-export-components
export { RolePreviewProvider } from '@/core/auth/RolePreviewContext';

// eslint-disable-next-line react-refresh/only-export-components
export const DeveloperRouteGuard: React.FC<DeveloperRouteGuardProps> = ({
  children,
  redirectUnauthenticated = false,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <LoadingScreen
        message="جارٍ التحقق من صلاحيات الوصول..."
        subtitle="يرجى الانتظار لحظات للتحقق وتجهيز البيانات..."
      />
    );
  }

  if (!isAuthenticated) {
    if (redirectUnauthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <NotFoundPage standalone />;
  }

  if (user?.role !== 'developer') {
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
        <DeveloperRouteGuard redirectUnauthenticated={true}>
          <LazyPage>
            <DesignSystemPreviewPage />
          </LazyPage>
        </DeveloperRouteGuard>
      }
      errorElement={<RouteErrorBoundary />}
    />

    {/* Protected Application Shell */}
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <LazyPage>
            <AppLayout />
          </LazyPage>
        </ProtectedRoute>
      }
      errorElement={<RouteErrorBoundary />}
    >
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="courses" element={<CoursesCatalogPage />} />
      <Route path="courses/join/:token" element={<CourseQrJoinPage />} />
      <Route path="courses/:courseId" element={<CourseDetailPage />} />
      <Route path="courses/:courseId/learn" element={<LearningPlayerPage />} />
      <Route path="courses/:courseId/learn/:itemId" element={<LearningPlayerPage />} />
      <Route path="my-courses" element={<MyCoursesPage />} />
      <Route path="my-groups" element={<TraineeGroupsPage />} />
      <Route path="my-groups/:groupId" element={<GroupDetailPage />} />
      <Route path="groups" element={<GroupsAdaptiveRedirect />} />
      <Route path="groups/join" element={<JoinGroupPage />} />
      <Route path="groups/:groupId" element={<GroupDetailPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="users/:userId" element={<MemberProfilePage />} />
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
        path="admin/users/new"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}>
            <AddUserPage />
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
      <Route
        path="admin/organization"
        element={
          <ProtectedRoute allowedRoles={['developer', 'super_admin', 'admin']}>
            <OrganizationCatalogPage />
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
            <BuilderParamRedirect />
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
      <Route path="performance/:courseId" element={<PerformanceParamRedirect />} />
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
          <RolePreviewProvider>
            <RouterProvider router={routerInstance} />
          </RolePreviewProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default AppRouter;
