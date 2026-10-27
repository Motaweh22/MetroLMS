import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthContext } from './useAuthContext';
import { LoadingScreen } from '@/shared/ui/Loading';
import type { UserRole } from './types';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  /** Optional allowed roles for role-based access control. If specified, unauthorized users are redirected to /403. */
  allowedRoles?: UserRole[];
}

/**
 * Route Guard enforcing authenticated and role-based access
 *
 * Behavior:
 * - If session is loading: renders an accessible LoadingScreen.
 * - If unauthenticated: redirects to /login and preserves requested path in location.state.
 * - If role check fails (user does not have one of allowedRoles): redirects to /403.
 * - If authenticated and authorized: renders Outlet or children.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuthContext();
  const location = useLocation();

  if (isLoading) {
    return (
      <LoadingScreen
        message="جارٍ التحقق من الجلسة التدريبية..."
        subtitle="يرجى الانتظار لحظات للتحقق وتجهيز البيانات..."
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
