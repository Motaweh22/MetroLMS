import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SecurityAuditPage } from '@/pages/SecurityAuditPage';
import { ToastProvider } from '@/shared/ui/Toast/ToastProvider';
import { auditApi } from '@/features/permissions/services/auditApi';
import type { UserRole } from '@/core/auth/types';

let currentMockRole: UserRole = 'super_admin';

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: {
      id: '2',
      name: 'المستخدم الحالي',
      username: '+201000000002',
      email: 'user@metro.local',
      role: currentMockRole,
      status: 'active',
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

describe('SecurityAuditPage role authorization (BUG-020 / D-14)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<UserRole>(['super_admin', 'developer', 'admin', 'assistant_admin'])(
    'allows %s to render SecurityAuditPage and loads entries',
    async (role) => {
      currentMockRole = role;
      const auditSpy = vi.spyOn(auditApi, 'getAuditLogs').mockResolvedValue({
        entries: [
          {
            id: '101',
            timestamp: '2026-11-26T06:00:00Z',
            actorId: '2',
            actorName: 'مدير أعلى',
            actorRole: 'super_admin',
            action: 'user.status_changed',
            actionLabelAr: 'تغيير حالة حساب',
            severity: 'info',
            details: 'تحديث حالة المستخدم',
            outcome: 'success',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 15,
        totalPages: 1,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <SecurityAuditPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByTestId('security-audit-page')).toBeTruthy();
      expect(screen.queryByTestId('unauthorized-audit-view')).toBeNull();
      await waitFor(() => {
        expect(auditSpy).toHaveBeenCalledTimes(1);
      });
      expect(await screen.findByText('تغيير حالة حساب')).toBeTruthy();
    }
  );

  it.each<UserRole>(['lecturer', 'user'])(
    'blocks %s from viewing SecurityAuditPage without firing audit API requests',
    async (role) => {
      currentMockRole = role;
      const auditSpy = vi.spyOn(auditApi, 'getAuditLogs');

      render(
        <MemoryRouter>
          <ToastProvider>
            <SecurityAuditPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(await screen.findByTestId('unauthorized-audit-view')).toBeTruthy();
      expect(screen.queryByTestId('security-audit-page')).toBeNull();
      expect(auditSpy).not.toHaveBeenCalled();
    }
  );
});
