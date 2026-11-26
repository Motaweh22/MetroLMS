import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { ErrorBoundary } from '@/shared/ui/Error/ErrorBoundary';
import { ToastProvider } from '@/shared/ui/Toast/ToastProvider';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import {
  getUserInitials,
  mergeManagedUserUpdate,
  type ManagedUserDTO,
} from '@/core/user-management/types';

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '3',
      name: 'مدير النظام',
      username: '+201000000003',
      email: 'admin@metro.local',
      role: 'admin',
      status: 'active',
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

const lecturerFixture: ManagedUserDTO = {
  id: '5',
  name: 'محاضر الاختبار',
  nameEn: 'Test Lecturer',
  username: '+201000000005',
  email: 'lecturer@metro.local',
  phone: '+201000000005',
  jobTitle: 'محاضر فني',
  department: 'التشغيل',
  role: 'lecturer',
  status: 'active',
};

describe('Admin user suspend/activate status update crash regression', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('safe-merges partial/mixed-case DTO updates and computes safe initials without crashing', () => {
    expect(getUserInitials(undefined)).toBe('م');
    expect(getUserInitials('')).toBe('م');
    expect(getUserInitials('أحمد علي')).toBe('أ.ع');

    const merged = mergeManagedUserUpdate(lecturerFixture, {
      id: '5',
      status: 'Suspended' as unknown as ManagedUserDTO['status'],
    });
    expect(merged.name).toBe('محاضر الاختبار');
    expect(merged.status).toBe('suspended');
    expect(merged.email).toBe('lecturer@metro.local');
  });

  it('suspends and reactivates a user in UserManagementPage without triggering ErrorBoundary (500)', async () => {
    vi.spyOn(userManagementApi, 'getManagedUsers').mockResolvedValue([lecturerFixture]);
    const updateStatusSpy = vi
      .spyOn(userManagementApi, 'updateUserStatus')
      .mockResolvedValueOnce({
        id: '5',
        status: 'Suspended',
      } as unknown as ManagedUserDTO)
      .mockResolvedValueOnce({
        ...lecturerFixture,
        status: 'active',
      });

    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ToastProvider>
            <UserManagementPage />
          </ToastProvider>
        </ErrorBoundary>
      </MemoryRouter>
    );

    await screen.findByText('محاضر الاختبار');

    // 1. Suspend
    fireEvent.click(screen.getByTestId('suspend-user-btn-5'));
    fireEvent.click(await screen.findByTestId('confirm-suspend-btn'));

    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenNthCalledWith(1, '5', 'suspended', undefined);
    });

    // Must not crash to UnexpectedErrorPage / ErrorBoundary fallback
    expect(screen.queryByTestId('unexpected-error-page')).toBeNull();
    expect(screen.getByText('محاضر الاختبار')).toBeTruthy();

    // Status button flips to activate button after suspend
    const activateBtn = await screen.findByTestId('activate-user-btn-5');
    fireEvent.click(activateBtn);
    fireEvent.click(await screen.findByTestId('confirm-reactivate-btn'));

    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenNthCalledWith(2, '5', 'active', undefined);
    });

    expect(screen.queryByTestId('unexpected-error-page')).toBeNull();
    expect(await screen.findByTestId('suspend-user-btn-5')).toBeTruthy();
  });
});
