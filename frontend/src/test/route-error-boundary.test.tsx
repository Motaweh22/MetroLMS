import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RouteErrorBoundary } from '@/app/router/RouteErrorBoundary';
import { ApiError } from '@/core/api/apiClient';

let mockRouteError: unknown = null;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useRouteError: () => mockRouteError,
  };
});

describe('RouteErrorBoundary client vs server error distinction', () => {
  beforeEach(() => {
    mockRouteError = null;
  });

  it('displays server HTTP 500 title only for actual ApiError 500 responses', () => {
    mockRouteError = new ApiError('Internal Server Error', 500);

    render(
      <MemoryRouter>
        <RouteErrorBoundary />
      </MemoryRouter>
    );

    expect(screen.getByText('خطأ في استجابة الخادم (500)')).toBeTruthy();
  });

  it('displays client UI error title instead of fake 500 for uncaught JS runtime errors', () => {
    mockRouteError = new TypeError("Cannot read properties of undefined (reading 'trim')");

    render(
      <MemoryRouter>
        <RouteErrorBoundary />
      </MemoryRouter>
    );

    expect(screen.getByText('حدث خطأ غير متوقع في الواجهة')).toBeTruthy();
    expect(screen.queryByText(/خطأ في استجابة الخادم \(500\)/)).toBeNull();
  });
});
