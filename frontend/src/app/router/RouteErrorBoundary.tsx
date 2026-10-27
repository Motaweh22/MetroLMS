import React from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { UnexpectedErrorPage } from '@/pages/UnexpectedErrorPage';
import { ApiError } from '@/core/api/apiClient';

/**
 * Route-Level Error Boundary for React Router Data Router
 *
 * Catches route exceptions, data loading errors, and uncaught render issues.
 * Intelligently surfaces 404, 403, network, and unexpected 500 states.
 */
export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }
    if (error.status === 403) {
      return <ForbiddenPage />;
    }
    return (
      <UnexpectedErrorPage
        status={error.status}
        error={error.statusText || error.data}
      />
    );
  }

  if (error instanceof ApiError) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }
    if (error.status === 403) {
      return <ForbiddenPage />;
    }
    return (
      <UnexpectedErrorPage
        status={error.status}
        error={error.message}
      />
    );
  }

  return <UnexpectedErrorPage error={error} />;
};

export default RouteErrorBoundary;
